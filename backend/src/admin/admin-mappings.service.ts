import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { AppLoggerService } from '../common/logger/app-logger.service';
import {
  EquityMappingConfig,
  type EquityMappingConfigDocument,
} from '../mappings/schemas/equity-mapping-config.schema';
import { invalidateCache as invalidateMappingCache } from '../mappings/mapping-resolver';
import { MappingSeedService } from '../mappings/mapping-seed.service';
import {
  MappingSet,
  type MappingSetDocument,
  type ReportType,
  REPORT_TYPES,
} from '../mappings/schemas/mapping-set.schema';
import { RowMapping, type RowMappingDocument } from '../mappings/schemas/row-mapping.schema';

const ROW_BASED_TYPES: ReportType[] = ['balance_sheet', 'cash_flow', 'profit_loss_form2'];

function isReportType(value: string): value is ReportType {
  return (REPORT_TYPES as readonly string[]).includes(value);
}

/**
 * Admin-side mapping CRUD. Ported from backend/src/admin/mappings.controller.js
 * with the express req/res framing removed. Every endpoint the legacy
 * controller exposed has a corresponding method here, and every business rule
 * (immutable published sets, scope-aware archival, version monotonicity,
 * resolver-cache invalidation) is preserved.
 */
@Injectable()
export class AdminMappingsService {
  constructor(
    @InjectModel(MappingSet.name)
    private readonly mappingSetModel: Model<MappingSetDocument>,
    @InjectModel(RowMapping.name)
    private readonly rowMappingModel: Model<RowMappingDocument>,
    @InjectModel(EquityMappingConfig.name)
    private readonly equityConfigModel: Model<EquityMappingConfigDocument>,
    private readonly seed: MappingSeedService,
    private readonly logger: AppLoggerService,
  ) {}

  // ─── Reads ─────────────────────────────────────────────────────────────────

  async listMappingSets(): Promise<{
    success: true;
    sets: any[];
    grouped: Record<string, any[]>;
  }> {
    const sets = (await this.mappingSetModel
      .find()
      .sort({ reportType: 1, version: -1 })
      .populate('publishedBy', 'email name')
      .populate('createdBy', 'email name')
      .populate('assignedUsers', 'email name')
      .lean()) as any[];

    const setIds = sets.map((s) => s._id);
    const rowCounts = await this.rowMappingModel.aggregate<{ _id: unknown; count: number }>([
      { $match: { mappingSetId: { $in: setIds } } },
      { $group: { _id: '$mappingSetId', count: { $sum: 1 } } },
    ]);
    const countMap = new Map<string, number>(
      rowCounts.map((c) => [String(c._id), c.count]),
    );

    const equitySetIds = sets.filter((s) => s.reportType === 'equity').map((s) => s._id);
    if (equitySetIds.length > 0) {
      const equityConfigs = await this.equityConfigModel
        .find({ mappingSetId: { $in: equitySetIds } })
        .select('mappingSetId columns movementRows')
        .lean();
      for (const cfg of equityConfigs as any[]) {
        const count = (cfg.columns?.length ?? 0) + (cfg.movementRows?.length ?? 0);
        countMap.set(String(cfg.mappingSetId), count);
      }
    }

    const enriched = sets.map((s) => ({ ...s, itemCount: countMap.get(String(s._id)) ?? 0 }));
    const grouped = REPORT_TYPES.reduce<Record<string, any[]>>((acc, rt) => {
      acc[rt] = enriched.filter((s) => s.reportType === rt);
      return acc;
    }, {});
    return { success: true, sets: enriched, grouped };
  }

  async getPublishedSet(reportType: string) {
    if (!isReportType(reportType)) this.throwInvalidReportType();
    const set = await this.mappingSetModel.findOne({ reportType, status: 'published' });
    if (!set) {
      throw new NotFoundException({
        error: 'NO_PUBLISHED_SET',
        message: `No published mapping set for ${reportType}`,
      });
    }
    return { success: true as const, ...(await this.loadSetWithItems(set)) };
  }

  async getDraftSet(reportType: string) {
    if (!isReportType(reportType)) this.throwInvalidReportType();
    const set = await this.mappingSetModel.findOne({ reportType, status: 'draft' });
    if (!set) {
      throw new NotFoundException({
        error: 'NO_DRAFT',
        message: `No draft set for ${reportType}`,
      });
    }
    return { success: true as const, ...(await this.loadSetWithItems(set)) };
  }

  async getSetById(setId: string) {
    const set = await this.mappingSetModel
      .findById(setId)
      .populate('publishedBy', 'email name')
      .populate('createdBy', 'email name')
      .populate('assignedUsers', 'email name');
    if (!set) {
      throw new NotFoundException({ error: 'SET_NOT_FOUND', message: 'Mapping set not found' });
    }
    return { success: true as const, ...(await this.loadSetWithItems(set)) };
  }

  // ─── Draft creation / fork / scope ─────────────────────────────────────────

  async createDraftFromPublished(reportType: string, adminId: Types.ObjectId) {
    if (!isReportType(reportType)) this.throwInvalidReportType();

    const existingDraft = await this.mappingSetModel.findOne({
      reportType,
      status: 'draft',
      assignedUsers: { $size: 0 },
    });
    if (existingDraft) {
      throw new ConflictException({
        error: 'DRAFT_EXISTS',
        message: 'A draft of the global set already exists for this report type',
        draftId: existingDraft._id,
      });
    }

    const published = await this.mappingSetModel.findOne({
      reportType,
      status: 'published',
      assignedUsers: { $size: 0 },
    });
    if (!published) {
      throw new NotFoundException({
        error: 'NO_PUBLISHED_SET',
        message: 'Cannot create draft: no published global set exists. Run seed first.',
      });
    }

    return this.cloneSetIntoNewDraft(published, adminId);
  }

  async forkSet(
    setId: string,
    adminId: Types.ObjectId,
    body: { assignedUsers?: string[]; label?: string },
  ) {
    const source = await this.mappingSetModel.findById(setId);
    if (!source) {
      throw new NotFoundException({ error: 'SET_NOT_FOUND', message: 'Source set not found' });
    }
    if (source.status === 'draft') {
      throw new BadRequestException({
        error: 'CANNOT_FORK_DRAFT',
        message: 'Cannot fork a draft — drafts are edited directly.',
      });
    }
    return this.cloneSetIntoNewDraft(source, adminId, {
      assignedUsersOverride: Array.isArray(body.assignedUsers) ? body.assignedUsers : null,
      labelOverride: typeof body.label === 'string' ? body.label : null,
    });
  }

  async createBlankDraft(
    reportType: string,
    adminId: Types.ObjectId,
    body: { assignedUsers?: string[]; label?: string },
  ) {
    if (!isReportType(reportType)) this.throwInvalidReportType();

    const assignedUsers = Array.isArray(body.assignedUsers) ? body.assignedUsers : [];
    if (assignedUsers.length === 0) {
      throw new BadRequestException({
        error: 'MISSING_ASSIGNED_USERS',
        message:
          'Blank drafts must be scoped to one or more users. To recreate the global set, use the seed flow.',
      });
    }

    const lastSet = await this.mappingSetModel.findOne({ reportType }).sort({ version: -1 });
    const newVersion = (lastSet?.version ?? 0) + 1;

    const draft = await this.mappingSetModel.create({
      reportType,
      version: newVersion,
      status: 'draft',
      assignedUsers: assignedUsers.map((id) => new Types.ObjectId(id)),
      label: body.label || '',
      notes: 'Created as blank user-specific draft',
      createdBy: adminId,
    });

    if (reportType === 'equity') {
      await this.equityConfigModel.create({
        mappingSetId: draft._id,
        columns: [],
        bsRowToEquityColumn: new Map(),
        movementRows: [],
        rowPatterns: [],
        columnPatterns: [],
      });
    }

    this.logger.info(`Blank draft created for ${reportType} v${newVersion}`, {
      adminId: adminId.toString(),
      draftId: draft._id.toString(),
      assignedUsers,
      category: 'admin',
    });

    return { success: true as const, draft: draft.toObject() };
  }

  async updateSetScope(
    setId: string,
    body: { assignedUsers?: string[]; label?: string },
  ) {
    const set = await this.mappingSetModel.findById(setId);
    if (!set) {
      throw new NotFoundException({ error: 'SET_NOT_FOUND', message: 'Set not found' });
    }
    if (set.status !== 'draft') {
      throw new BadRequestException({
        error: 'NOT_A_DRAFT',
        message:
          'Scope can only be edited on drafts. Publish creates a new immutable snapshot.',
      });
    }
    if (Array.isArray(body.assignedUsers)) {
      set.assignedUsers = body.assignedUsers.map((id) => new Types.ObjectId(id));
    }
    if (typeof body.label === 'string') set.label = body.label;
    await set.save();
    return { success: true as const, set: set.toObject() };
  }

  async publishDraft(
    setId: string,
    adminId: Types.ObjectId,
    adminEmail: string,
    notes?: string,
  ) {
    const draft = await this.mappingSetModel.findById(setId);
    if (!draft) {
      throw new NotFoundException({ error: 'SET_NOT_FOUND', message: 'Set not found' });
    }
    if (draft.status !== 'draft') {
      throw new BadRequestException({
        error: 'NOT_A_DRAFT',
        message: `Cannot publish a set with status '${draft.status}'`,
      });
    }

    const reportType = draft.reportType;
    const isUserSpecific = draft.assignedUsers.length > 0;

    // Scope-aware archival — preserved from legacy (no transaction; OK on
    // standalone Mongo deployments). See legacy controller comment for the
    // rationale and the rollback plan if/when we move to a replica set.
    if (isUserSpecific) {
      const overlapping = await this.mappingSetModel.find({
        reportType,
        status: 'published',
        assignedUsers: { $in: draft.assignedUsers, $ne: [] },
      });
      for (const set of overlapping) {
        set.status = 'archived';
        await set.save();
      }
    } else {
      const currentGlobal = await this.mappingSetModel.findOne({
        reportType,
        status: 'published',
        assignedUsers: { $size: 0 },
      });
      if (currentGlobal) {
        currentGlobal.status = 'archived';
        await currentGlobal.save();
      }
    }

    draft.status = 'published';
    draft.publishedAt = new Date();
    draft.publishedBy = adminId;
    if (notes) draft.notes = notes;
    await draft.save();

    this.logger.logSecurity(
      'Mapping set published',
      {
        adminId: adminId.toString(),
        adminEmail,
        setId: draft._id.toString(),
        reportType,
        version: draft.version,
        scope: isUserSpecific ? 'user-specific' : 'global',
        assignedUsersCount: draft.assignedUsers.length,
      },
      'info',
    );

    invalidateMappingCache(reportType);
    return { success: true as const, published: draft.toObject() };
  }

  async deleteSet(setId: string, adminId: Types.ObjectId) {
    const set = await this.mappingSetModel.findById(setId);
    if (!set) {
      throw new NotFoundException({ error: 'SET_NOT_FOUND', message: 'Set not found' });
    }
    if (set.status === 'published') {
      throw new BadRequestException({
        error: 'CANNOT_DELETE_PUBLISHED',
        message: 'Published sets cannot be deleted. Publish a new draft to supersede.',
      });
    }
    if (set.reportType === 'equity') {
      await this.equityConfigModel.deleteMany({ mappingSetId: set._id });
    } else {
      await this.rowMappingModel.deleteMany({ mappingSetId: set._id });
    }
    await set.deleteOne();
    this.logger.logSecurity(
      'Mapping set deleted',
      {
        adminId: adminId.toString(),
        setId,
        reportType: set.reportType,
        version: set.version,
        status: set.status,
      },
      'info',
    );
    invalidateMappingCache(set.reportType);
    return { success: true as const };
  }

  // ─── Row editing (row-based report types) ──────────────────────────────────

  async addRow(setId: string, payload: any) {
    const set = await this.mappingSetModel.findById(setId);
    this.ensureDraftSet(set);
    if (!ROW_BASED_TYPES.includes(set!.reportType)) {
      throw new BadRequestException({
        error: 'WRONG_REPORT_TYPE',
        message: 'Row editing is not applicable for this report type',
      });
    }
    if (!payload?.nsbuRowCode || !payload?.ifrsClassification) {
      throw new BadRequestException({
        error: 'MISSING_FIELDS',
        message: 'nsbuRowCode and ifrsClassification are required',
      });
    }

    try {
      const row = await this.rowMappingModel.create({
        mappingSetId: set!._id,
        nsbuRowCode: payload.nsbuRowCode,
        nsbuCodes: payload.nsbuCodes || [],
        nsbuDescription: payload.nsbuDescription || '',
        ifrsClassification: payload.ifrsClassification,
        section: payload.section || '',
        subsection: payload.subsection || '',
        isNegative: !!payload.isNegative,
        isCalculated: !!payload.isCalculated,
        formula: payload.formula ?? null,
        flowType: payload.flowType ?? null,
        directMethod: typeof payload.directMethod === 'boolean' ? payload.directMethod : null,
        netCalculation:
          typeof payload.netCalculation === 'boolean' ? payload.netCalculation : null,
        plSection: payload.plSection ?? null,
        label: payload.label || '',
        accountDetails: payload.accountDetails ?? null,
        notes: payload.notes || '',
      });
      return { success: true as const, row };
    } catch (err) {
      if ((err as { code?: number }).code === 11000) {
        throw new ConflictException({
          error: 'DUPLICATE_ROW',
          message: 'A row with this nsbuRowCode already exists in this set',
        });
      }
      throw err;
    }
  }

  async updateRow(rowId: string, body: Record<string, any>) {
    const row = await this.rowMappingModel.findById(rowId);
    if (!row) throw new NotFoundException({ error: 'ROW_NOT_FOUND', message: 'Row not found' });
    const set = await this.mappingSetModel.findById(row.mappingSetId);
    this.ensureDraftSet(set);

    const editable: Array<keyof RowMapping | string> = [
      'nsbuRowCode',
      'nsbuCodes',
      'nsbuDescription',
      'ifrsClassification',
      'section',
      'subsection',
      'isNegative',
      'isCalculated',
      'formula',
      'flowType',
      'directMethod',
      'netCalculation',
      'plSection',
      'label',
      'accountDetails',
      'notes',
    ];
    for (const field of editable) {
      if (field in body) (row as any)[field] = body[field];
    }

    try {
      await row.save();
      return { success: true as const, row };
    } catch (err) {
      if ((err as { code?: number }).code === 11000) {
        throw new ConflictException({
          error: 'DUPLICATE_ROW',
          message: 'Another row with this nsbuRowCode already exists in this set',
        });
      }
      throw err;
    }
  }

  async deleteRow(rowId: string) {
    const row = await this.rowMappingModel.findById(rowId);
    if (!row) throw new NotFoundException({ error: 'ROW_NOT_FOUND', message: 'Row not found' });
    const set = await this.mappingSetModel.findById(row.mappingSetId);
    this.ensureDraftSet(set);
    await row.deleteOne();
    return { success: true as const };
  }

  // ─── Equity ─────────────────────────────────────────────────────────────────

  async updateEquityConfig(setId: string, body: any) {
    const set = await this.mappingSetModel.findById(setId);
    this.ensureDraftSet(set);
    if (set!.reportType !== 'equity') {
      throw new BadRequestException({
        error: 'WRONG_REPORT_TYPE',
        message: 'This endpoint is only for equity sets',
      });
    }

    const update: Record<string, unknown> = {};
    if (Array.isArray(body?.columns)) update.columns = body.columns;
    if (body?.bsRowToEquityColumn && typeof body.bsRowToEquityColumn === 'object') {
      update.bsRowToEquityColumn = new Map(Object.entries(body.bsRowToEquityColumn));
    }
    if (Array.isArray(body?.movementRows)) update.movementRows = body.movementRows;
    if (Array.isArray(body?.rowPatterns)) update.rowPatterns = body.rowPatterns;
    if (Array.isArray(body?.columnPatterns)) update.columnPatterns = body.columnPatterns;
    if (typeof body?.notes === 'string') update.notes = body.notes;

    // Validate regex patterns before persisting.
    const allPatterns = [
      ...((update.rowPatterns as Array<{ pattern: string; key: string; flags?: string }>) || []),
      ...((update.columnPatterns as Array<{ pattern: string; key: string; flags?: string }>) || []),
    ];
    for (const p of allPatterns) {
      try {
        new RegExp(p.pattern, p.flags || 'i');
      } catch (e) {
        throw new BadRequestException({
          error: 'INVALID_REGEX',
          message: `Pattern '${p.pattern}' for key '${p.key}' is not a valid regex: ${(e as Error).message}`,
        });
      }
    }

    const config = await this.equityConfigModel.findOneAndUpdate(
      { mappingSetId: set!._id },
      update,
      { new: true, upsert: true },
    );

    return { success: true as const, config };
  }

  // ─── Seed ──────────────────────────────────────────────────────────────────

  async manualSeed(adminId: Types.ObjectId, adminEmail: string) {
    const results = await this.seed.runSeed({ userId: adminId });
    this.logger.logSecurity(
      'Manual mapping seed run',
      { adminId: adminId.toString(), adminEmail, results },
      'info',
    );
    invalidateMappingCache();
    return { success: true as const, results };
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private async loadSetWithItems(
    set: MappingSetDocument | (Record<string, any> & { _id: unknown; reportType: ReportType }),
  ) {
    if (set.reportType === 'equity') {
      const config = await this.equityConfigModel.findOne({ mappingSetId: set._id }).lean();
      const plain = typeof (set as any).toObject === 'function' ? (set as any).toObject() : set;
      return { set: plain, config };
    }
    const rows = await this.rowMappingModel
      .find({ mappingSetId: set._id })
      .sort({ nsbuRowCode: 1 })
      .lean();
    const plain = typeof (set as any).toObject === 'function' ? (set as any).toObject() : set;
    return { set: plain, rows };
  }

  private async cloneSetIntoNewDraft(
    sourceSet: MappingSetDocument,
    adminId: Types.ObjectId,
    opts: { assignedUsersOverride?: string[] | null; labelOverride?: string | null } = {},
  ) {
    const reportType = sourceSet.reportType;
    const lastSet = await this.mappingSetModel.findOne({ reportType }).sort({ version: -1 });
    const newVersion = (lastSet?.version ?? 0) + 1;

    const draft = await this.mappingSetModel.create({
      reportType,
      version: newVersion,
      status: 'draft',
      assignedUsers:
        opts.assignedUsersOverride != null
          ? opts.assignedUsersOverride.map((id) => new Types.ObjectId(id))
          : sourceSet.assignedUsers,
      label: opts.labelOverride != null ? opts.labelOverride : sourceSet.label,
      notes: `Forked from v${sourceSet.version}`,
      createdBy: adminId,
    });

    if (reportType === 'equity') {
      const sourceConfig = await this.equityConfigModel
        .findOne({ mappingSetId: sourceSet._id })
        .lean();
      if (sourceConfig) {
        const { _id, createdAt, updatedAt, ...rest } = sourceConfig as Record<string, any>;
        void _id;
        void createdAt;
        void updatedAt;
        await this.equityConfigModel.create({ ...rest, mappingSetId: draft._id });
      }
    } else {
      const sourceRows = await this.rowMappingModel
        .find({ mappingSetId: sourceSet._id })
        .lean();
      if (sourceRows.length > 0) {
        const cloned = sourceRows.map((r) => {
          const { _id, createdAt, updatedAt, ...rest } = r as Record<string, any>;
          void _id;
          void createdAt;
          void updatedAt;
          return { ...rest, mappingSetId: draft._id };
        });
        await this.rowMappingModel.insertMany(cloned, { ordered: false });
      }
    }

    this.logger.info(`Draft created for ${reportType} v${newVersion}`, {
      adminId: adminId.toString(),
      draftId: draft._id.toString(),
      forkedFrom: sourceSet._id.toString(),
      assignedUsers: draft.assignedUsers,
      category: 'admin',
    });

    return { success: true as const, draft: draft.toObject() };
  }

  private ensureDraftSet(set: MappingSetDocument | null): asserts set is MappingSetDocument {
    if (!set) {
      throw new NotFoundException({ error: 'SET_NOT_FOUND', message: 'Set not found' });
    }
    if (set.status !== 'draft') {
      throw new BadRequestException({
        error: 'NOT_A_DRAFT',
        message: 'Only draft sets can be edited. Create a draft first.',
      });
    }
  }

  private throwInvalidReportType(): never {
    throw new BadRequestException({
      error: 'INVALID_REPORT_TYPE',
      message: `reportType must be one of: ${REPORT_TYPES.join(', ')}`,
    });
  }
}
