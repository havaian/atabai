import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { BALANCE_SHEET_MAPPING } from './balance-sheet.mapping';
import { CASH_FLOW_MAPPING } from './cash-flow.mapping';
import {
  BS_ROW_TO_EQUITY_COLUMN,
  EQUITY_COLUMNS,
  EQUITY_MOVEMENT_ROWS,
  FORM4_COLUMN_PATTERNS,
  FORM4_ROW_PATTERNS,
} from './equity.mapping';
import { FORM2_ROW_CODES } from './profit-loss-form2.mapping';
import {
  EquityMappingConfig,
  type EquityMappingConfigDocument,
} from './schemas/equity-mapping-config.schema';
import {
  MappingSet,
  type MappingSetDocument,
  type ReportType,
} from './schemas/mapping-set.schema';
import { RowMapping, type RowMappingDocument } from './schemas/row-mapping.schema';

export interface SeedResult {
  created: boolean;
  rowCount?: number;
  mappingSetId: string | null;
}

/**
 * Ports backend/src/admin/mappingSeed.js — populates the database with the
 * initial set of mappings from the file constants. Idempotent: if a report
 * type already has a published set, that type is skipped.
 *
 * Called automatically at server bootstrap (best-effort; errors logged but
 * never block startup) and on POST /api/admin/mappings/seed.
 */
@Injectable()
export class MappingSeedService {
  private readonly logger = new Logger(MappingSeedService.name);

  constructor(
    @InjectModel(MappingSet.name)
    private readonly mappingSetModel: Model<MappingSetDocument>,
    @InjectModel(RowMapping.name)
    private readonly rowMappingModel: Model<RowMappingDocument>,
    @InjectModel(EquityMappingConfig.name)
    private readonly equityConfigModel: Model<EquityMappingConfigDocument>,
  ) {}

  async seedRowBased(
    reportType: ReportType,
    sourceMap: Record<string, any>,
    userId: Types.ObjectId | null,
  ): Promise<SeedResult> {
    const existing = await this.mappingSetModel.findOne({ reportType, status: 'published' });
    if (existing) {
      return { created: false, rowCount: 0, mappingSetId: existing._id.toString() };
    }

    const set = await this.mappingSetModel.create({
      reportType,
      version: 1,
      status: 'published',
      publishedAt: new Date(),
      publishedBy: userId,
      createdBy: userId,
      notes: 'Initial seed from src/mappings/',
    });

    const rows = Object.entries(sourceMap).map(([nsbuRowCode, def]) => ({
      mappingSetId: set._id,
      nsbuRowCode,
      nsbuCodes: def.nsbuCodes || [],
      nsbuDescription: def.nsbuDescription || def.label || '',
      ifrsClassification: def.ifrsClassification || def.label || '',
      section: def.section || '',
      subsection: def.subsection || '',
      isNegative: !!def.isNegative,
      isCalculated: !!def.isCalculated,
      formula: def.formula ?? null,
      flowType: def.flowType ?? null,
      directMethod: typeof def.directMethod === 'boolean' ? def.directMethod : null,
      netCalculation: typeof def.netCalculation === 'boolean' ? def.netCalculation : null,
      plSection: def.section && reportType === 'profit_loss_form2' ? def.section : null,
      label: def.label || '',
      accountDetails: def.accountDetails || null,
      notes: '',
    }));

    if (rows.length > 0) {
      await this.rowMappingModel.insertMany(rows, { ordered: false });
    }
    return { created: true, rowCount: rows.length, mappingSetId: set._id.toString() };
  }

  async seedEquity(userId: Types.ObjectId | null): Promise<SeedResult> {
    const existing = await this.mappingSetModel.findOne({
      reportType: 'equity',
      status: 'published',
    });
    if (existing) {
      return { created: false, mappingSetId: existing._id.toString() };
    }

    const set = await this.mappingSetModel.create({
      reportType: 'equity',
      version: 1,
      status: 'published',
      publishedAt: new Date(),
      publishedBy: userId,
      createdBy: userId,
      notes: 'Initial seed from src/mappings/equity.mapping.ts',
    });

    await this.equityConfigModel.create({
      mappingSetId: set._id,
      columns: EQUITY_COLUMNS.map((col) => ({
        key: col.key,
        label: col.label,
        nsbuRows: col.nsbuRows || [],
        isNegative: !!col.isNegative,
        isCalculated: !!col.isCalculated,
      })),
      bsRowToEquityColumn: new Map(Object.entries(BS_ROW_TO_EQUITY_COLUMN)),
      movementRows: EQUITY_MOVEMENT_ROWS.map((r) => ({
        key: r.key,
        label: r.label,
        isTotal: !!r.isTotal,
      })),
      rowPatterns: FORM4_ROW_PATTERNS.map((p) => ({
        key: p.key,
        pattern: p.pattern.source,
        flags: p.pattern.flags || 'i',
      })),
      columnPatterns: FORM4_COLUMN_PATTERNS.map((p) => ({
        key: p.key,
        pattern: p.pattern.source,
        flags: p.pattern.flags || 'i',
      })),
      notes: '',
    });

    return { created: true, mappingSetId: set._id.toString() };
  }

  async runSeed({
    userId,
  }: { userId?: Types.ObjectId | null } = {}): Promise<Record<string, SeedResult>> {
    const u = userId ?? null;
    return {
      balance_sheet: await this.seedRowBased('balance_sheet', BALANCE_SHEET_MAPPING, u),
      cash_flow: await this.seedRowBased('cash_flow', CASH_FLOW_MAPPING, u),
      profit_loss_form2: await this.seedRowBased('profit_loss_form2', FORM2_ROW_CODES, u),
      equity: await this.seedEquity(u),
    };
  }

  async runSeedAtStartup(): Promise<void> {
    try {
      const results = await this.runSeed();
      const created = Object.entries(results)
        .filter(([, r]) => r.created)
        .map(([t]) => t);
      if (created.length > 0) {
        this.logger.log(`Mapping seed created sets for: ${created.join(', ')}`);
      }
    } catch (err) {
      this.logger.error(`Mapping seed at startup failed: ${(err as Error).message}`);
    }
  }
}
