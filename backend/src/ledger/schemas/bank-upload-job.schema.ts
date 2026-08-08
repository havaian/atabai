import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Model, Types } from 'mongoose';

export type BankUploadJobDocument = HydratedDocument<BankUploadJob>;
export type BankUploadJobModel = Model<BankUploadJob>;

export type BankUploadJobStatus = 'processing' | 'completed' | 'failed';
export const BANK_UPLOAD_JOB_STATUSES: readonly BankUploadJobStatus[] = [
  'processing',
  'completed',
  'failed',
];

/**
 * Tracks one asynchronous bank-statement ingestion run so the client can poll
 * for completion instead of holding a request open.
 *
 * Why this exists: parsing a statement and creating a draft per row is a
 * multi-query-per-row job that can outlast the client's HTTP timeout. The
 * upload endpoint now validates the period, records this job as `processing`,
 * kicks off the work in the background, and returns immediately. The frontend
 * polls the job by id until it reaches `completed` (carrying the same
 * BankIngestionSummary the synchronous path used to return) or `failed`
 * (carrying the error message).
 *
 * There is no queue infrastructure - the work runs in-process after the
 * response is sent. The trade-off: a process restart mid-run leaves a job
 * stuck in `processing`. That is acceptable for now; a stale-job sweep can be
 * added later if it proves necessary. The drafts themselves are created
 * transactionally per row, so a stuck job never corrupts the ledger - at worst
 * the operator re-uploads.
 */
@Schema({
  timestamps: true,
  toJSON: {
    transform: (_doc, ret: Record<string, unknown>) => {
      delete ret.__v;
      return ret;
    },
  },
})
export class BankUploadJob {
  @Prop({
    type: Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true,
  })
  organizationId!: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'ReportingPeriod',
    required: true,
    index: true,
  })
  periodId!: Types.ObjectId;

  // The batch id embedded into every draft's sourceRef (`bank:{uploadId}:{row}`).
  // Lets the preview/batch screens find the drafts this job produced.
  @Prop({ type: String, required: true, index: true })
  uploadId!: string;

  @Prop({
    type: String,
    enum: BANK_UPLOAD_JOB_STATUSES,
    required: true,
    default: 'processing',
    index: true,
  })
  status!: BankUploadJobStatus;

  // Original filename as uploaded, for the operator's reference in the UI.
  @Prop({ type: String, default: null })
  fileName!: string | null;

  /**
   * The org's own settlement account this statement belongs to - the account
   * the file was exported for (bank ТЗ §1/§2). Chosen by the operator at
   * upload time from the org's registered accounts. It is the org-side leg of
   * every posting in this batch: for an internal transfer the engine posts
   * this account's ledgerAccount against the «Счёт»-side account; for a normal
   * counterparty row it is the 5110-style current-account leg.
   *
   * Stored as the raw account number (not an ObjectId) because settlement
   * accounts are embedded in OrganizationProfile.bankAccounts without their
   * own ids.
   */
  @Prop({ type: String, default: null })
  statementAccountNumber!: string | null;

  // Populated when status === 'completed'. Shape mirrors BankIngestionSummary
  // (draftsCreated, byColor, parseWarnings, rowsSkipped). Stored loosely so the
  // summary shape can evolve without a schema migration.
  @Prop({ type: Object, default: null })
  summary!: Record<string, unknown> | null;

  // Populated when status === 'failed' - a human-readable reason.
  @Prop({ type: String, default: null })
  error!: string | null;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy!: Types.ObjectId;
}

export const BankUploadJobSchema = SchemaFactory.createForClass(BankUploadJob);

// One job per uploadId within an org. The uploadId is a UUID minted per
// upload, so this is really a uniqueness guard rather than a lookup index.
BankUploadJobSchema.index({ organizationId: 1, uploadId: 1 }, { unique: true });

// Listing a period's recent jobs (newest first) for an upload-history view.
BankUploadJobSchema.index({ organizationId: 1, periodId: 1, createdAt: -1 });
