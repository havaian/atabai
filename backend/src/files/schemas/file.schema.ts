import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Model, Types } from 'mongoose';

import { TEMPLATE_TYPES, type TemplateType } from '../../common/constants/template-types';

export type FileStatus = 'uploaded' | 'processing' | 'completed' | 'failed';

export type FileDocument = HydratedDocument<File, IFileMethods>;
export type FileModel = Model<File, Record<string, never>, IFileMethods> & IFileStatics;

@Schema({ _id: false })
class FileWarning {
  @Prop({ type: String }) message?: string;
  @Prop({ type: Number }) row?: number;
  @Prop({ type: String }) column?: string;
  @Prop({ type: String, enum: ['info', 'warning', 'error'], default: 'warning' })
  severity!: 'info' | 'warning' | 'error';
}
const FileWarningSchema = SchemaFactory.createForClass(FileWarning);

@Schema({ _id: false })
class FileResult {
  @Prop({ type: Number, default: 0 }) transformations!: number;
  @Prop({ type: Number, default: 0 }) changes!: number;
  @Prop({ type: Number, default: 0 }) originalRows!: number;
  @Prop({ type: Number, default: 0 }) processedRows!: number;
  @Prop({ type: [FileWarningSchema], default: [] }) warnings!: FileWarning[];
  @Prop({ type: String }) summary?: string;
}
const FileResultSchema = SchemaFactory.createForClass(FileResult);

@Schema({
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
})
export class File {
  @Prop({ type: String, required: true, trim: true, maxlength: 255 })
  originalName!: string;

  @Prop({ type: String, required: true, trim: true, maxlength: 255 })
  fileName!: string;

  @Prop({ type: String, required: true })
  filePath!: string;

  @Prop({ type: String, default: null })
  processedFilePath!: string | null;

  @Prop({ type: Number, required: true, min: 0 })
  fileSize!: number;

  @Prop({ type: String, required: true })
  mimeType!: string;

  @Prop({ type: String, required: true, enum: TEMPLATE_TYPES })
  templateType!: TemplateType;

  @Prop({
    type: String,
    required: true,
    enum: ['uploaded', 'processing', 'completed', 'failed'],
    default: 'uploaded',
  })
  status!: FileStatus;

  @Prop({ type: String, required: true, unique: true, index: true })
  jobId!: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  /**
   * Organization scope (Task 6 — migration to ledger-spine architecture).
   *
   * Nullable. Files uploaded BEFORE the migration to the org-scoped
   * architecture have this set to null. Files uploaded AFTER set this
   * to the caller's active org at upload time. The absence of this
   * field IS the legacy marker — we deliberately don't backfill it on
   * existing documents.
   *
   * Access semantics:
   *   - User-side list endpoints filter `organizationId: <currentOrgId>`,
   *     so legacy (null) files never appear there.
   *   - User-side detail / download endpoints reject when the file's
   *     `organizationId` doesn't match the caller's current org — this
   *     includes the null case (legacy files are not visible to users
   *     at all, no matter what file id they put in the URL).
   *   - Admin endpoints ignore `organizationId` entirely and continue
   *     to see / operate on every file, which is how legacy data
   *     remains usable retroactively.
   */
  @Prop({ type: Types.ObjectId, ref: 'Organization', default: null, index: true })
  organizationId!: Types.ObjectId | null;

  @Prop({ type: FileResultSchema, default: () => ({}) })
  result!: FileResult;

  @Prop({ type: String, default: null })
  error!: string | null;

  @Prop({ type: Number, default: 0, min: 0 })
  retryCount!: number;

  @Prop({ type: Date, default: null })
  completedAt!: Date | null;

  @Prop({
    type: Date,
    default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  })
  expiresAt!: Date;
}

export const FileSchema = SchemaFactory.createForClass(File);

FileSchema.index({ userId: 1, createdAt: -1 });
FileSchema.index({ status: 1, createdAt: -1 });
FileSchema.index({ templateType: 1, createdAt: -1 });
FileSchema.index({ jobId: 1, userId: 1 });
FileSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
// Org-scoped listing — the user-side list endpoints filter by (userId,
// organizationId) since after the Task 6 migration a user sees only the
// files belonging to their current org.
FileSchema.index({ organizationId: 1, userId: 1, createdAt: -1 });

FileSchema.virtual('processingDuration').get(function (this: FileDocument) {
  if (this.completedAt && (this as unknown as { createdAt: Date }).createdAt) {
    return this.completedAt.getTime() - (this as unknown as { createdAt: Date }).createdAt.getTime();
  }
  return null;
});

FileSchema.virtual('fileSizeFormatted').get(function (this: FileDocument) {
  const bytes = this.fileSize;
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
});

FileSchema.virtual('statusDisplay').get(function (this: FileDocument) {
  const map: Record<FileStatus, string> = {
    uploaded: 'Uploaded',
    processing: 'Processing',
    completed: 'Completed',
    failed: 'Failed',
  };
  return map[this.status] ?? this.status;
});

FileSchema.pre('save', function (next) {
  if (this.status === 'completed' && !this.completedAt) {
    this.completedAt = new Date();
  }
  next();
});

// ─── Instance methods ────────────────────────────────────────────────────────

export interface IFileMethods {
  canBeDeleted(): boolean;
  canBeDownloaded(): boolean;
  canBeRetried(): boolean;
  getPublicData(): Record<string, unknown>;
}

FileSchema.methods.canBeDeleted = function (): boolean {
  return true;
};
FileSchema.methods.canBeDownloaded = function (this: FileDocument): boolean {
  return this.status === 'completed' && !!this.processedFilePath;
};
FileSchema.methods.canBeRetried = function (this: FileDocument): boolean {
  return this.status === 'failed';
};
FileSchema.methods.getPublicData = function (this: FileDocument) {
  return {
    id: this._id.toString(),
    originalName: this.originalName,
    templateType: this.templateType,
    status: this.status,
    statusDisplay: (this as unknown as { statusDisplay: string }).statusDisplay,
    fileSize: this.fileSize,
    fileSizeFormatted: (this as unknown as { fileSizeFormatted: string }).fileSizeFormatted,
    createdAt: (this as unknown as { createdAt: Date }).createdAt,
    updatedAt: (this as unknown as { updatedAt: Date }).updatedAt,
    completedAt: this.completedAt,
    processingDuration: (this as unknown as { processingDuration: number | null }).processingDuration,
    result: this.result,
    error: this.error,
    retryCount: this.retryCount,
    jobId: this.jobId,
  };
};

// ─── Statics ─────────────────────────────────────────────────────────────────

export interface IFileStatics {
  findByUserId(
    userId: string | Types.ObjectId,
    options?: {
      status?: FileStatus;
      templateType?: TemplateType;
      limit?: number;
      skip?: number;
      // When provided, restricts to files belonging to this org. The user-
      // side list endpoints always pass this; admin endpoints leave it
      // undefined to see every file (including legacy null-org ones).
      organizationId?: string | Types.ObjectId;
    },
  ): ReturnType<FileModel['find']>;
  findByJobId(jobId: string, userId: string | Types.ObjectId): ReturnType<FileModel['findOne']>;
  getProcessingStats(userId: string | Types.ObjectId): ReturnType<FileModel['aggregate']>;
}

const findByUserIdImpl = function (
  this: FileModel,
  userId: string | Types.ObjectId,
  options: {
    status?: FileStatus;
    templateType?: TemplateType;
    limit?: number;
    skip?: number;
    organizationId?: string | Types.ObjectId;
  } = {},
) {
  const query = this.find({ userId });
  if (options.organizationId) query.where({ organizationId: options.organizationId });
  if (options.status) query.where({ status: options.status });
  if (options.templateType) query.where({ templateType: options.templateType });
  query.sort({ createdAt: -1 });
  if (options.limit) query.limit(options.limit);
  if (options.skip) query.skip(options.skip);
  return query;
};
FileSchema.statics.findByUserId = findByUserIdImpl as unknown as IFileStatics['findByUserId'];

const findByJobIdImpl = function (this: FileModel, jobId: string, userId: string | Types.ObjectId) {
  return this.findOne({ jobId, userId });
};
FileSchema.statics.findByJobId = findByJobIdImpl as unknown as IFileStatics['findByJobId'];

const getProcessingStatsImpl = function (this: FileModel, userId: string | Types.ObjectId) {
  return this.aggregate([
    { $match: { userId: new Types.ObjectId(userId.toString()) } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalSize: { $sum: '$fileSize' },
      },
    },
  ]);
};
FileSchema.statics.getProcessingStats =
  getProcessingStatsImpl as unknown as IFileStatics['getProcessingStats'];
