import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Model, Types } from 'mongoose';

import { TEMPLATE_TYPES, type TemplateType } from '../../common/constants/template-types';

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
export type JobPriority = 'low' | 'normal' | 'high';

export type ProcessingJobDocument = HydratedDocument<ProcessingJob, IJobMethods>;
export type ProcessingJobModel = Model<ProcessingJob, Record<string, never>, IJobMethods> &
  IJobStatics;

@Schema({ _id: false })
class WorksheetSummary {
  @Prop({ type: String }) name?: string;
  @Prop({ type: Number }) originalRows?: number;
  @Prop({ type: Number }) processedRows?: number;
  @Prop({ type: Number }) changes?: number;
}
const WorksheetSummarySchema = SchemaFactory.createForClass(WorksheetSummary);

@Schema({ _id: false })
class JobWarning {
  @Prop({ type: String }) message?: string;
  @Prop({ type: Number }) row?: number;
  @Prop({ type: String }) column?: string;
  @Prop({ type: String, enum: ['info', 'warning', 'error'], default: 'warning' })
  severity!: 'info' | 'warning' | 'error';
}
const JobWarningSchema = SchemaFactory.createForClass(JobWarning);

@Schema({ _id: false })
class JobResult {
  @Prop({ type: Number, default: 0 }) transformations!: number;
  @Prop({ type: Number, default: 0 }) changes!: number;
  @Prop({ type: Number, default: 0 }) originalRows!: number;
  @Prop({ type: Number, default: 0 }) processedRows!: number;
  @Prop({ type: [WorksheetSummarySchema], default: [] }) worksheets!: WorksheetSummary[];
  @Prop({ type: String }) summary?: string;
  @Prop({ type: [JobWarningSchema], default: [] }) warnings!: JobWarning[];
}
const JobResultSchema = SchemaFactory.createForClass(JobResult);

@Schema({ _id: false })
class JobError {
  @Prop({ type: String }) message?: string;
  @Prop({ type: String }) stack?: string;
  @Prop({ type: String }) name?: string;
  @Prop({ type: Object }) details?: unknown;
}
const JobErrorSchema = SchemaFactory.createForClass(JobError);

@Schema({
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
})
export class ProcessingJob {
  @Prop({ type: String, required: true, unique: true, index: true })
  jobId!: string;

  @Prop({ type: Types.ObjectId, ref: 'File', required: true, index: true })
  fileId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ type: String, required: true, enum: TEMPLATE_TYPES })
  templateType!: TemplateType;

  @Prop({ type: Map, of: SchemaFactory.createForClass(class {}).obj, default: () => new Map() })
  options!: Map<string, unknown>;

  @Prop({
    type: String,
    required: true,
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
    default: 'pending',
    index: true,
  })
  status!: JobStatus;

  @Prop({ type: Number, default: 0, min: 0, max: 100 })
  progress!: number;

  @Prop({ type: JobResultSchema, default: () => ({}) })
  result!: JobResult;

  @Prop({ type: JobErrorSchema, default: null })
  error?: JobError | null;

  @Prop({ type: Number, default: 0, min: 0, max: 5 })
  retryCount!: number;

  @Prop({ type: Number, default: 3, min: 0, max: 5 })
  maxRetries!: number;

  @Prop({ type: Date, default: null })
  startedAt!: Date | null;

  @Prop({ type: Date, default: null })
  completedAt!: Date | null;

  @Prop({ type: Number, default: null })
  processingTime!: number | null;

  @Prop({ type: Number, default: null })
  memoryUsage!: number | null;

  @Prop({ type: String, enum: ['low', 'normal', 'high'], default: 'normal' })
  priority!: JobPriority;

  @Prop({ type: Date, default: Date.now })
  scheduledFor!: Date;
}

export const ProcessingJobSchema = SchemaFactory.createForClass(ProcessingJob);

ProcessingJobSchema.index({ userId: 1, createdAt: -1 });
ProcessingJobSchema.index({ status: 1, scheduledFor: 1 });
ProcessingJobSchema.index({ templateType: 1, status: 1 });
ProcessingJobSchema.index({ jobId: 1, userId: 1 });

ProcessingJobSchema.virtual('duration').get(function (this: ProcessingJobDocument) {
  if (this.completedAt && this.startedAt) return this.completedAt.getTime() - this.startedAt.getTime();
  if (this.startedAt && this.status === 'processing') return Date.now() - this.startedAt.getTime();
  return null;
});

ProcessingJobSchema.virtual('statusDisplay').get(function (this: ProcessingJobDocument) {
  const map: Record<JobStatus, string> = {
    pending: 'Pending',
    processing: 'Processing',
    completed: 'Completed',
    failed: 'Failed',
    cancelled: 'Cancelled',
  };
  return map[this.status] ?? this.status;
});

ProcessingJobSchema.virtual('canRetry').get(function (this: ProcessingJobDocument) {
  return this.status === 'failed' && this.retryCount < this.maxRetries;
});

ProcessingJobSchema.pre('save', function (next) {
  if (this.isModified('status') && this.status === 'processing' && !this.startedAt) {
    this.startedAt = new Date();
  }
  if (
    this.isModified('status') &&
    (['completed', 'failed', 'cancelled'] as JobStatus[]).includes(this.status) &&
    !this.completedAt
  ) {
    this.completedAt = new Date();
    if (this.startedAt) {
      this.processingTime = this.completedAt.getTime() - this.startedAt.getTime();
    }
  }
  next();
});

// ─── Instance methods ────────────────────────────────────────────────────────

export interface IJobMethods {
  updateProgress(progress: number, status?: JobStatus): Promise<ProcessingJobDocument>;
  markAsCompleted(result?: Partial<JobResult>): Promise<ProcessingJobDocument>;
  markAsFailed(error: Error): Promise<ProcessingJobDocument>;
  markAsProcessing(): Promise<ProcessingJobDocument>;
  canBeRetried(): boolean;
  retry(): Promise<ProcessingJobDocument>;
  cancel(): Promise<ProcessingJobDocument>;
  getPublicData(): Record<string, unknown>;
}

ProcessingJobSchema.methods.updateProgress = function (
  this: ProcessingJobDocument,
  progress: number,
  status?: JobStatus,
) {
  this.progress = Math.max(0, Math.min(100, progress));
  if (status) this.status = status;
  return this.save();
};

ProcessingJobSchema.methods.markAsCompleted = function (
  this: ProcessingJobDocument,
  result: Partial<JobResult> = {},
) {
  this.status = 'completed';
  this.progress = 100;
  this.result = { ...this.result, ...result } as JobResult;
  return this.save();
};

ProcessingJobSchema.methods.markAsFailed = function (this: ProcessingJobDocument, error: Error) {
  this.status = 'failed';
  this.error = {
    message: error.message || 'Unknown error',
    stack: error.stack,
    name: error.name,
  } as JobError;
  return this.save();
};

ProcessingJobSchema.methods.markAsProcessing = function (this: ProcessingJobDocument) {
  this.status = 'processing';
  this.progress = 0;
  return this.save();
};

ProcessingJobSchema.methods.canBeRetried = function (this: ProcessingJobDocument): boolean {
  return (this as unknown as { canRetry: boolean }).canRetry;
};

ProcessingJobSchema.methods.retry = function (this: ProcessingJobDocument) {
  if (!(this as unknown as IJobMethods).canBeRetried()) {
    throw new Error('Job cannot be retried');
  }
  this.status = 'pending';
  this.progress = 0;
  this.retryCount += 1;
  this.error = undefined;
  this.startedAt = null;
  this.completedAt = null;
  this.processingTime = null;
  this.scheduledFor = new Date();
  return this.save();
};

ProcessingJobSchema.methods.cancel = function (this: ProcessingJobDocument) {
  if (['completed', 'cancelled'].includes(this.status)) {
    throw new Error('Cannot cancel completed or already cancelled job');
  }
  this.status = 'cancelled';
  return this.save();
};

ProcessingJobSchema.methods.getPublicData = function (this: ProcessingJobDocument) {
  return {
    id: this.jobId,
    status: this.status,
    statusDisplay: (this as unknown as { statusDisplay: string }).statusDisplay,
    progress: this.progress,
    progressDisplay: `${this.progress}%`,
    templateType: this.templateType,
    result: this.result,
    error: this.error?.message,
    retryCount: this.retryCount,
    canRetry: (this as unknown as { canRetry: boolean }).canRetry,
    duration: (this as unknown as { duration: number | null }).duration,
    createdAt: (this as unknown as { createdAt: Date }).createdAt,
    startedAt: this.startedAt,
    completedAt: this.completedAt,
  };
};

// ─── Statics ─────────────────────────────────────────────────────────────────

export interface IJobStatics {
  findByUserId(
    userId: string | Types.ObjectId,
    options?: { status?: JobStatus; templateType?: TemplateType; limit?: number; skip?: number },
  ): ReturnType<ProcessingJobModel['find']>;
  findPendingJobs(limit?: number): ReturnType<ProcessingJobModel['find']>;
  findByJobId(jobId: string, userId?: string | Types.ObjectId | null): ReturnType<ProcessingJobModel['findOne']>;
  getJobStats(userId?: string | Types.ObjectId | null): ReturnType<ProcessingJobModel['aggregate']>;
}

const findByUserId = function (
  this: ProcessingJobModel,
  userId: string | Types.ObjectId,
  options: { status?: JobStatus; templateType?: TemplateType; limit?: number; skip?: number } = {},
) {
  const query = this.find({ userId });
  if (options.status) query.where({ status: options.status });
  if (options.templateType) query.where({ templateType: options.templateType });
  query.sort({ createdAt: -1 });
  if (options.limit) query.limit(options.limit);
  if (options.skip) query.skip(options.skip);
  return query.populate('fileId', 'originalName fileSize');
};
ProcessingJobSchema.statics.findByUserId = findByUserId as unknown as IJobStatics['findByUserId'];

const findPendingJobs = function (this: ProcessingJobModel, limit = 10) {
  return this.find({
    status: 'pending',
    scheduledFor: { $lte: new Date() },
  })
    .sort({ priority: -1, scheduledFor: 1 })
    .limit(limit)
    .populate('fileId', 'originalName filePath templateType')
    .populate('userId', 'email name subscriptionType');
};
ProcessingJobSchema.statics.findPendingJobs = findPendingJobs as unknown as IJobStatics['findPendingJobs'];

const findByJobId = function (
  this: ProcessingJobModel,
  jobId: string,
  userId?: string | Types.ObjectId | null,
) {
  const query: Record<string, unknown> = { jobId };
  if (userId) query.userId = userId;
  return this.findOne(query).populate('fileId');
};
ProcessingJobSchema.statics.findByJobId = findByJobId as unknown as IJobStatics['findByJobId'];

const getJobStats = function (
  this: ProcessingJobModel,
  userId: string | Types.ObjectId | null = null,
) {
  const match: Record<string, unknown> = userId
    ? { userId: new Types.ObjectId(userId.toString()) }
    : {};
  return this.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        avgProcessingTime: { $avg: '$processingTime' },
        totalRetries: { $sum: '$retryCount' },
      },
    },
  ]);
};
ProcessingJobSchema.statics.getJobStats = getJobStats as unknown as IJobStatics['getJobStats'];
