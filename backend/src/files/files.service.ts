import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import * as crypto from 'crypto';
import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import { Types, isValidObjectId } from 'mongoose';
import * as path from 'path';
import * as XLSX from 'xlsx';

import { isTemplateType, type TemplateType } from '../common/constants/template-types';
import { AppLoggerService } from '../common/logger/app-logger.service';
import type { AppConfig } from '../config/configuration';
import {
  ProcessingJob,
  type ProcessingJobDocument,
  type ProcessingJobModel,
} from '../jobs/schemas/processing-job.schema';
import {
  PROCESSOR_SERVICE,
  type IProcessorService,
  type ProcessorResult,
} from '../processors/processor.interface';
import {
  asUserId,
  type UserDocument,
  type UserModel,
  User,
} from '../users/schemas/user.schema';
import {
  Membership,
  type MembershipModel,
} from '../organizations/schemas/membership.schema';
import { File, type FileDocument, type FileModel } from './schemas/file.schema';
import { SourceWorkbookParser } from './source-workbook-parser';
import { TransformationEnrichmentService } from './transformation-enrichment.service';
import { TransformationLockService } from './utils/transformation-lock';

interface UploadInput {
  file: Express.Multer.File;
  template: TemplateType;
  user: UserDocument;
  // Active org from X-Active-Org-Id header. Required for new uploads —
  // post-migration, every file belongs to an org. We reject the upload
  // when this is missing rather than orphan-creating a null-org file.
  activeOrgId: string | null;
}

interface HistoryQuery {
  limit?: number;
  offset?: number;
  status?: string;
  // Same header. For list endpoints we DON'T reject when null — we just
  // return an empty list. That keeps the frontend resilient during
  // log-in / org-switch transitions when the header may not yet be set.
  activeOrgId: string | null;
}

interface TemplateFilesQuery extends HistoryQuery {
  templateType: TemplateType;
}

@Injectable()
export class FilesService {
  private readonly uploadPath: string;

  constructor(
    @InjectModel(File.name) private readonly fileModel: FileModel,
    @InjectModel(ProcessingJob.name) private readonly jobModel: ProcessingJobModel,
    @InjectModel(User.name) private readonly userModel: UserModel,
    @InjectModel(Membership.name) private readonly membershipModel: MembershipModel,
    @Inject(PROCESSOR_SERVICE) private readonly processor: IProcessorService,
    private readonly enrichment: TransformationEnrichmentService,
    private readonly sourceParser: SourceWorkbookParser,
    private readonly lock: TransformationLockService,
    private readonly logger: AppLoggerService,
    configService: ConfigService<AppConfig, true>,
  ) {
    this.uploadPath = configService.get('files.uploadPath', { infer: true });
  }

  // ─── Org-scope helpers (Task 6) ────────────────────────────────────────────

  /**
   * Convert the X-Active-Org-Id header value into a Mongo ObjectId suitable
   * for `{ organizationId: ... }` filtering. Returns null when the caller
   * has no active org or sent a malformed value.
   *
   * Why null instead of throw: list endpoints want to degrade to an empty
   * list rather than 4xx, because the frontend transiently has no orgId
   * during login / org-switch. Detail endpoints check `null` themselves
   * and 404 — never reveal existence to a caller without an active org.
   */
  private parseOrgScope(activeOrgId: string | null): Types.ObjectId | null {
    if (!activeOrgId) return null;
    if (!isValidObjectId(activeOrgId)) return null;
    return new Types.ObjectId(activeOrgId);
  }

  /**
   * Convenience for the detail/download/delete paths: an org-scoped
   * `findOne` filter shape that combines userId + a strict organizationId
   * match. When the caller has no active org, returns null and callers
   * should treat it as "no file" — that's what protects pre-org (null
   * organizationId) files from being visible to users.
   */
  private userOrgFilter(
    user: UserDocument,
    activeOrgId: string | null,
  ): { userId: Types.ObjectId; organizationId: Types.ObjectId } | null {
    const orgObjectId = this.parseOrgScope(activeOrgId);
    if (!orgObjectId) return null;
    return { userId: user._id, organizationId: orgObjectId };
  }

  /**
   * Org-scoped lean lookup. Returns null when:
   *   - the caller has no active org (header missing/malformed), OR
   *   - the fileId is not a valid ObjectId, OR
   *   - no file matches (userId, organizationId, _id).
   *
   * Callers should treat any null return as "404 FILE_NOT_FOUND". We
   * deliberately don't differentiate "wrong org" from "doesn't exist" so
   * the API doesn't leak existence of files in other orgs / pre-org files.
   */
  private async findUserFileLean(
    user: UserDocument,
    fileId: string,
    activeOrgId: string | null,
  ) {
    const scope = this.userOrgFilter(user, activeOrgId);
    if (!scope) return null;
    if (!isValidObjectId(fileId)) return null;
    return this.fileModel
      .findOne({ _id: new Types.ObjectId(fileId), ...scope })
      .lean();
  }

  /**
   * Same as findUserFileLean but returns a hydrated document so the caller
   * can mutate / .save() / delete. Use sparingly — most paths read-only.
   */
  private async findUserFileMutable(
    user: UserDocument,
    fileId: string,
    activeOrgId: string | null,
  ): Promise<FileDocument | null> {
    const scope = this.userOrgFilter(user, activeOrgId);
    if (!scope) return null;
    if (!isValidObjectId(fileId)) return null;
    return this.fileModel.findOne({ _id: new Types.ObjectId(fileId), ...scope });
  }

  // ─── Upload + dispatch ─────────────────────────────────────────────────────

  async uploadAndProcess({
    file,
    template,
    user,
    activeOrgId,
  }: UploadInput): Promise<{
    success: true;
    message: string;
    jobId: string;
    fileId: string;
    templateType: TemplateType;
  }> {
    if (!file) {
      throw new BadRequestException({ error: 'NO_FILE', message: 'No file uploaded' });
    }
    if (!template) {
      throw new BadRequestException({ error: 'NO_TEMPLATE', message: 'Template type is required' });
    }
    if (!isTemplateType(template)) {
      throw new BadRequestException({ error: 'INVALID_TEMPLATE', message: 'Invalid template type' });
    }

    // Task 6 — every new file must belong to an organization. Uploads
    // without a current org are rejected outright (rather than silently
    // creating an orphaned/legacy-shaped record) so the migration is one-
    // directional: post-migration files always have organizationId set,
    // null-org files only ever come from the pre-migration era.
    const orgObjectId = this.parseOrgScope(activeOrgId);
    if (!orgObjectId) {
      throw new BadRequestException({
        error: 'NO_ACTIVE_ORG',
        message: 'No active organization selected. Set up or pick an organization first.',
      });
    }
    // Verify the caller is an active member of the org they claim to be
    // uploading on behalf of. Without this check, anyone could spoof the
    // X-Active-Org-Id header and write files into someone else's tenant.
    const membership = await this.membershipModel
      .findOne({
        organizationId: orgObjectId,
        userId: user._id,
        status: 'active',
      })
      .lean();
    if (!membership) {
      throw new BadRequestException({
        error: 'NOT_A_MEMBER',
        message: 'You are not an active member of this organization',
      });
    }

    const jobId = crypto.randomUUID();

    // Preserve the legacy latin1→utf8 reinterpretation so Cyrillic / Uzbek
    // filenames render correctly (Multer reports them as latin1 by default).
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');

    const fileRecord = await this.fileModel.create({
      originalName,
      fileName: file.filename,
      filePath: file.filename,
      fileSize: file.size,
      mimeType: file.mimetype,
      templateType: template,
      userId: user._id,
      organizationId: orgObjectId,
      status: 'uploaded',
      jobId,
    });

    const processingJob = await this.jobModel.create({
      jobId,
      fileId: fileRecord._id,
      userId: user._id,
      templateType: template,
      status: 'pending',
      progress: 0,
    });

    // Fire-and-forget background processing — matches legacy semantics.
    void this.processFileAsync(fileRecord, processingJob).catch((err: Error) =>
      this.logger.error(err, { context: 'processFileAsync (unhandled)' }),
    );

    user.filesProcessedThisMonth += 1;
    await user.save();

    this.logger.info(`File uploaded successfully: ${originalName} by ${user.email}`);

    return {
      success: true,
      message: 'File uploaded and processing started',
      jobId,
      fileId: fileRecord._id.toString(),
      templateType: template,
    };
  }

  // ─── Background processing ──────────────────────────────────────────────────

  private async processFileAsync(
    fileRecord: FileDocument,
    job: ProcessingJobDocument,
  ): Promise<void> {
    try {
      this.logger.info(`Starting background processing for file: ${fileRecord.originalName}`);

      job.status = 'processing';
      job.progress = 10;
      await job.save();

      const filePath = path.join(this.uploadPath, fileRecord.filePath);
      const fileExt = path.extname(fileRecord.fileName).toLowerCase();
      let workbookPath = filePath;

      // .xls → .xlsx conversion preserved from legacy.
      if (fileExt === '.xls') {
        this.logger.info(`Converting .xls to .xlsx: ${fileRecord.originalName}`);
        const xlsWorkbook = XLSX.readFile(filePath);
        const xlsxPath = filePath.replace('.xls', '.xlsx');
        XLSX.writeFile(xlsWorkbook, xlsxPath, { bookType: 'xlsx' });
        workbookPath = xlsxPath;
        this.logger.info(`Conversion complete: ${xlsxPath}`);
      }

      // Read with ExcelJS — done here even though the processor re-reads
      // because the legacy controller did, and some processors expect the
      // file to have been touched first (NTFS lock release timing).
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(workbookPath);

      job.progress = 30;
      await job.save();

      const result = await this.processor.process(job.templateType, filePath, {
        userId: asUserId(job.userId),
      });

      job.progress = 70;
      await job.save();

      // Output file name = {originalUuid}_ifrs{ext}.
      const processedFilename = `${path.parse(fileRecord.fileName).name}_ifrs${path.extname(fileRecord.fileName)}`;
      const processedFullPath = path.join(this.uploadPath, processedFilename);

      await result.workbook.xlsx.writeFile(processedFullPath);

      // Sibling transformation.json for the before/after view.
      if (result.transformation) {
        const transformationPath = `${processedFullPath}.transformation.json`;
        try {
          await fsPromises.writeFile(
            transformationPath,
            JSON.stringify(result.transformation),
            'utf8',
          );
          this.logger.info(`Transformation JSON written: ${transformationPath}`);
        } catch (err) {
          this.logger.error(err, {
            context: 'processFileAsync.writeTransformationJson',
            transformationPath,
          });
        }
      }

      job.progress = 90;
      await job.save();

      fileRecord.status = 'completed';
      fileRecord.processedFilePath = processedFilename;
      Object.assign(fileRecord.result, result.summary);
      fileRecord.completedAt = new Date();
      await fileRecord.save();

      job.status = 'completed';
      job.progress = 100;
      Object.assign(job.result, result.summary);
      job.completedAt = new Date();
      await job.save();

      // Bump the per-month completed counter on the owning user.
      const user = await this.userModel.findById(fileRecord.userId);
      if (user) {
        user.filesCompletedThisMonth = (user.filesCompletedThisMonth || 0) + 1;
        await user.save();
      }

      this.logger.info(`File processing completed: ${fileRecord.originalName}`);
    } catch (error) {
      this.logger.error(error, {
        context: 'processFileAsync',
        file: fileRecord.originalName,
        jobId: job.jobId,
      });

      const errMessage = error instanceof Error ? error.message : String(error);
      const errStack = error instanceof Error ? error.stack : undefined;
      const errName = error instanceof Error ? error.name : undefined;
      // Extractor defensive layer can attach a structured `diagnostic` field —
      // preserve it for ops triage just like the legacy controller did.
      const diagnostic =
        typeof error === 'object' && error !== null && 'diagnostic' in error
          ? (error as { diagnostic?: unknown }).diagnostic
          : undefined;

      job.status = 'failed';
      job.error = {
        message: errMessage,
        stack: errStack,
        name: errName,
        details: diagnostic,
      };
      await job.save();

      fileRecord.status = 'failed';
      fileRecord.error = errMessage;
      await fileRecord.save();
    }
  }

  // ─── History ────────────────────────────────────────────────────────────────

  async getHistory(user: UserDocument, query: HistoryQuery) {
    const limit = Number(query.limit) || 50;
    const offset = Number(query.offset) || 0;

    // Task 6: user-side listing is org-scoped. No active org → empty list,
    // not an error. This keeps the frontend non-flapping while orgs/period
    // context resolves on app start or org switch.
    const orgObjectId = this.parseOrgScope(query.activeOrgId);
    if (!orgObjectId) {
      return { success: true, files: [], totalCount: 0, hasMore: false };
    }

    const filter: Record<string, unknown> = {
      userId: user._id,
      organizationId: orgObjectId,
    };
    if (query.status) filter.status = query.status;

    const [files, totalCount] = await Promise.all([
      this.fileModel.find(filter).sort({ createdAt: -1 }).skip(offset).limit(limit).lean(),
      this.fileModel.countDocuments(filter),
    ]);

    return {
      success: true,
      files: files.map((f) => ({
        id: f._id.toString(),
        originalName: f.originalName,
        templateType: f.templateType,
        status: f.status,
        fileSize: f.fileSize,
        createdAt: (f as unknown as { createdAt: Date }).createdAt,
        completedAt: f.completedAt,
        jobId: f.jobId,
        transformations: f.result?.transformations ?? 0,
        changes: f.result?.changes ?? 0,
      })),
      totalCount,
      hasMore: offset + files.length < totalCount,
    };
  }

  async getTemplateFiles(user: UserDocument, query: TemplateFilesQuery) {
    if (!isTemplateType(query.templateType)) {
      throw new BadRequestException({ error: 'INVALID_TEMPLATE', message: 'Invalid template type' });
    }
    const limit = Number(query.limit) || 20;
    const offset = Number(query.offset) || 0;

    // Same org-scope rule as getHistory — no org, empty list.
    const orgObjectId = this.parseOrgScope(query.activeOrgId);
    if (!orgObjectId) {
      return {
        success: true,
        templateType: query.templateType,
        files: [],
        statusSummary: { total: 0, completed: 0, processing: 0, failed: 0, pending: 0 },
        pagination: { total: 0, limit, offset, hasMore: false },
      };
    }

    const filter: Record<string, unknown> = {
      userId: user._id,
      organizationId: orgObjectId,
      templateType: query.templateType,
    };
    if (query.status) filter.status = query.status;

    const [files, totalCount, statusCountsRaw] = await Promise.all([
      this.fileModel.find(filter).sort({ createdAt: -1 }).skip(offset).limit(limit).lean(),
      this.fileModel.countDocuments(filter),
      this.fileModel.aggregate<{ _id: string; count: number }>([
        {
          $match: {
            userId: user._id,
            organizationId: orgObjectId,
            templateType: query.templateType,
          },
        },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
    ]);

    const statusSummary = { total: totalCount, completed: 0, processing: 0, failed: 0, pending: 0 };
    for (const item of statusCountsRaw) {
      if (item._id in statusSummary) {
        (statusSummary as Record<string, number>)[item._id] = item.count;
      }
    }

    return {
      success: true,
      templateType: query.templateType,
      files: files.map((f) => ({
        id: f._id.toString(),
        originalName: f.originalName,
        status: f.status,
        fileSize: f.fileSize,
        createdAt: (f as unknown as { createdAt: Date }).createdAt,
        completedAt: f.completedAt,
        jobId: f.jobId,
        transformations: f.result?.transformations ?? 0,
        changes: f.result?.changes ?? 0,
        processedFilePath: f.processedFilePath,
        hasProcessedFile: !!f.processedFilePath,
      })),
      statusSummary,
      pagination: { total: totalCount, limit, offset, hasMore: offset + files.length < totalCount },
    };
  }

  // ─── Status + details ──────────────────────────────────────────────────────

  async getProcessingStatus(user: UserDocument, jobId: string, activeOrgId: string | null) {
    // Task 6 — the job belongs to a file, and the file is org-scoped. We
    // resolve the job AND verify the joined file's organizationId matches
    // the caller's claim. No active org → 404 (legacy jobs are admin-only).
    const orgObjectId = this.parseOrgScope(activeOrgId);
    if (!orgObjectId) {
      throw new NotFoundException({ error: 'JOB_NOT_FOUND', message: 'Processing job not found' });
    }
    const job = await this.jobModel.findOne({ jobId, userId: user._id }).populate('fileId');
    if (!job) {
      throw new NotFoundException({ error: 'JOB_NOT_FOUND', message: 'Processing job not found' });
    }
    // Cross-check: the populated file's organizationId must match. If the
    // file has null organizationId (legacy) or a different one (somehow
    // re-scoped), reject — keep pre-org jobs out of the user-side surface.
    const populated = job.fileId as unknown as
      | { _id?: { toString(): string }; originalName?: string; organizationId?: Types.ObjectId | null }
      | null;
    const fileOrgId = populated?.organizationId?.toString();
    if (!fileOrgId || fileOrgId !== orgObjectId.toString()) {
      throw new NotFoundException({ error: 'JOB_NOT_FOUND', message: 'Processing job not found' });
    }
    return {
      success: true,
      job: {
        id: job.jobId,
        fileId: populated?._id?.toString(),
        fileName: populated?.originalName,
        templateType: job.templateType,
        status: job.status,
        progress: job.progress,
        error: job.error,
        result: job.result,
        createdAt: (job as unknown as { createdAt: Date }).createdAt,
        completedAt: job.completedAt,
        retryCount: job.retryCount ?? 0,
      },
    };
  }

  async getFileDetails(user: UserDocument, fileId: string, activeOrgId: string | null) {
    const file = await this.findUserFileLean(user, fileId, activeOrgId);
    if (!file) {
      throw new NotFoundException({ error: 'FILE_NOT_FOUND', message: 'File not found' });
    }
    return {
      success: true,
      file: {
        id: file._id.toString(),
        originalName: file.originalName,
        templateType: file.templateType,
        status: file.status,
        fileSize: file.fileSize,
        createdAt: (file as unknown as { createdAt: Date }).createdAt,
        completedAt: file.completedAt,
        jobId: file.jobId,
        transformations: file.result?.transformations ?? 0,
        changes: file.result?.changes ?? 0,
        warnings: file.result?.warnings ?? [],
        hasProcessedFile: !!file.processedFilePath,
      },
    };
  }

  // ─── Download ───────────────────────────────────────────────────────────────

  async streamDownload(
    user: UserDocument,
    fileId: string,
    type: 'original' | 'processed',
    res: import('express').Response,
    activeOrgId: string | null,
  ): Promise<void> {
    const file = await this.findUserFileMutable(user, fileId, activeOrgId);
    if (!file) {
      throw new NotFoundException({ error: 'FILE_NOT_FOUND', message: 'File not found' });
    }

    let relPath: string;
    let downloadName: string;
    if (type === 'original') {
      relPath = file.filePath;
      downloadName = file.filePath;
    } else {
      if (!file.processedFilePath) {
        throw new BadRequestException({
          error: 'NO_PROCESSED_FILE',
          message: 'Processed file not available',
        });
      }
      relPath = file.processedFilePath;
      downloadName = file.processedFilePath;
    }

    const fullPath = path.join(this.uploadPath, relPath);
    try {
      await fsPromises.access(fullPath);
    } catch {
      throw new NotFoundException({
        error: 'FILE_NOT_ACCESSIBLE',
        message: 'File not found on server',
      });
    }

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
    fs.createReadStream(fullPath).pipe(res);

    this.logger.info(`File downloaded: ${downloadName} by ${user.email}`);
  }

  // ─── Delete ─────────────────────────────────────────────────────────────────

  async deleteFile(
    user: UserDocument,
    fileId: string,
    activeOrgId: string | null,
  ): Promise<{ success: true; message: string }> {
    const file = await this.findUserFileMutable(user, fileId, activeOrgId);
    if (!file) {
      throw new NotFoundException({ error: 'FILE_NOT_FOUND', message: 'File not found' });
    }

    const targets = [path.join(this.uploadPath, file.filePath)];
    if (file.processedFilePath) {
      const processed = path.join(this.uploadPath, file.processedFilePath);
      targets.push(processed);
      targets.push(`${processed}.transformation.json`);
    }

    await Promise.allSettled(
      targets.map(async (t) => {
        try {
          await fsPromises.unlink(t);
          this.logger.info(`Deleted file: ${t}`);
        } catch (err) {
          this.logger.warn(`Failed to delete file: ${t}: ${(err as Error).message}`);
        }
      }),
    );

    await this.jobModel.deleteOne({ fileId: file._id });
    await this.fileModel.deleteOne({ _id: file._id });

    return { success: true, message: 'File deleted successfully' };
  }

  // ─── Retry ─────────────────────────────────────────────────────────────────

  async retryProcessing(user: UserDocument, jobId: string, activeOrgId: string | null) {
    // Same org-cross-check as getProcessingStatus — the job's file must
    // belong to the caller's current org. Without this, a user could
    // re-trigger processing on a legacy / cross-tenant file.
    const orgObjectId = this.parseOrgScope(activeOrgId);
    if (!orgObjectId) {
      throw new NotFoundException({ error: 'JOB_NOT_FOUND', message: 'Processing job not found' });
    }
    const job = await this.jobModel.findOne({ jobId, userId: user._id }).populate('fileId');
    if (!job) {
      throw new NotFoundException({ error: 'JOB_NOT_FOUND', message: 'Processing job not found' });
    }
    const fileRef = job.fileId as unknown as FileDocument & {
      organizationId?: Types.ObjectId | null;
    };
    const fileOrgId = fileRef?.organizationId?.toString();
    if (!fileOrgId || fileOrgId !== orgObjectId.toString()) {
      throw new NotFoundException({ error: 'JOB_NOT_FOUND', message: 'Processing job not found' });
    }
    if (job.status !== 'failed') {
      throw new BadRequestException({
        error: 'INVALID_STATUS',
        message: 'Only failed jobs can be retried',
      });
    }

    job.status = 'pending';
    job.progress = 0;
    job.error = null;
    job.retryCount = (job.retryCount ?? 0) + 1;
    await job.save();

    void this.processFileAsync(fileRef, job).catch((err: Error) =>
      this.logger.error(err, { context: 'retryProcessing.processFileAsync' }),
    );

    return {
      success: true,
      message: 'Processing retry initiated',
      job: {
        id: job.jobId,
        status: job.status,
        progress: job.progress,
        retryCount: job.retryCount,
      },
    };
  }

  // ─── Transformation read ──────────────────────────────────────────────────

  async getTransformation(user: UserDocument, fileId: string, activeOrgId: string | null) {
    const file = await this.findUserFileLean(user, fileId, activeOrgId);
    if (!file) {
      throw new NotFoundException({ error: 'FILE_NOT_FOUND', message: 'File not found' });
    }
    if (file.status !== 'completed') {
      throw new BadRequestException({
        error: 'FILE_NOT_READY',
        message: 'File has not finished processing',
      });
    }
    if (!file.processedFilePath) {
      throw new BadRequestException({
        error: 'NO_PROCESSED_FILE',
        message: 'Processed file not available',
      });
    }

    const jsonPath = path.join(this.uploadPath, `${file.processedFilePath}.transformation.json`);
    let raw: string;
    try {
      raw = await fsPromises.readFile(jsonPath, 'utf8');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new NotFoundException({
          error: 'TRANSFORMATION_NOT_AVAILABLE',
          message: 'Transformation data not available — regenerate to produce it',
        });
      }
      throw err;
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch (err) {
      this.logger.error(err, { context: 'getTransformation parse', jsonPath });
      throw new BadRequestException({
        error: 'TRANSFORMATION_CORRUPT',
        message: 'Transformation data is corrupted — regenerate to rebuild',
      });
    }

    try {
      const enriched = this.enrichment.enrich(file.templateType, parsed);
      return { success: true, transformation: enriched };
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === 'TEMPLATE_NOT_SUPPORTED' || code === 'UNKNOWN_TEMPLATE') {
        throw new BadRequestException({
          error: 'TEMPLATE_NOT_SUPPORTED',
          message: (err as Error).message,
        });
      }
      throw err;
    }
  }

  // ─── Source workbook (Univer JSON) ──────────────────────────────────────────

  async getSourceWorkbook(user: UserDocument, fileId: string, activeOrgId: string | null) {
    const file = await this.findUserFileLean(user, fileId, activeOrgId);
    if (!file) {
      throw new NotFoundException({ error: 'FILE_NOT_FOUND', message: 'File not found' });
    }
    if (!file.filePath) {
      throw new BadRequestException({
        error: 'NO_SOURCE_FILE',
        message: 'No source file recorded for this entry',
      });
    }

    const sourcePath = path.join(this.uploadPath, file.filePath);
    try {
      await fsPromises.access(sourcePath);
    } catch {
      throw new NotFoundException({
        error: 'SOURCE_NOT_ACCESSIBLE',
        message: 'Source file not found on server',
      });
    }

    try {
      const workbook = await this.sourceParser.parse(sourcePath);
      return { success: true, workbook };
    } catch (err) {
      this.logger.error(err, { context: 'getSourceWorkbook', filePath: file.filePath });
      throw new BadRequestException({
        error: 'PARSE_FAILED',
        message: 'Could not parse source workbook',
      });
    }
  }

  // ─── Regenerate transformation ─────────────────────────────────────────────

  async regenerateTransformation(user: UserDocument, fileId: string, activeOrgId: string | null) {
    if (!this.lock.tryAcquire(fileId)) {
      throw new ConflictException({
        error: 'REGENERATION_IN_PROGRESS',
        message: 'Transformation is already being regenerated for this file',
      });
    }

    try {
      const file = await this.findUserFileMutable(user, fileId, activeOrgId);
      if (!file) {
        throw new NotFoundException({ error: 'FILE_NOT_FOUND', message: 'File not found' });
      }
      if (file.status !== 'completed') {
        throw new BadRequestException({
          error: 'FILE_NOT_READY',
          message: 'File has not finished processing',
        });
      }
      if (!file.processedFilePath) {
        throw new BadRequestException({
          error: 'NO_PROCESSED_FILE',
          message: 'Processed file not available',
        });
      }

      const supported = new Set<TemplateType>([
        'balanceSheet',
        'profitLossForm2',
        'cashFlow',
        'profitLoss',
        'equity',
      ]);
      if (!supported.has(file.templateType)) {
        throw new BadRequestException({
          error: 'TEMPLATE_NOT_SUPPORTED',
          message: `Template '${file.templateType}' does not support transformation regeneration yet`,
        });
      }

      const originalPath = path.join(this.uploadPath, file.filePath);
      try {
        await fsPromises.access(originalPath);
      } catch {
        throw new BadRequestException({
          error: 'ORIGINAL_FILE_MISSING',
          message: 'Original uploaded file is no longer available on the server',
        });
      }

      const result: ProcessorResult = await this.processor.process(file.templateType, originalPath, {
        userId: asUserId(file.userId),
      });

      if (!result.transformation) {
        throw new BadRequestException({
          error: 'REGENERATION_FAILED',
          message: 'Processor did not produce transformation data',
        });
      }

      // Atomic write — tmp + rename so a partial write can't be observed.
      const finalPath = path.join(this.uploadPath, `${file.processedFilePath}.transformation.json`);
      const tmpPath = `${finalPath}.tmp.${crypto.randomUUID()}`;
      await fsPromises.writeFile(tmpPath, JSON.stringify(result.transformation), 'utf8');
      await fsPromises.rename(tmpPath, finalPath);

      this.logger.info(`Transformation regenerated for file ${fileId}: ${finalPath}`);
      return { success: true, message: 'Transformation regenerated successfully' };
    } finally {
      this.lock.release(fileId);
    }
  }
}
