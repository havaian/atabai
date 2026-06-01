import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {
  HydratedDocument,
  Model,
  Schema as MongooseSchema,
  Types,
} from 'mongoose';

export type JournalEntryDocument = HydratedDocument<JournalEntry>;
export type JournalEntryModel = Model<JournalEntry>;

/**
 * Where an entry originated. Drives both the human label in the audit trail
 * and the staging workflow — bank-engine entries land in 'draft' status, etc.
 *
 * `reclassification` and `adjustment` are DEPRECATED (architecture doc §4.2):
 * the transformation pipeline that produced them is removed, and the
 * adjustment mechanism is reframed as plain manual journal entries (source
 * `manual`). They remain in the enum so historical rows stay valid and any
 * in-flight code path keeps working until fully retargeted to `manual`.
 */
export type JournalEntrySource =
  | 'bank_statement'   // Produced by the bank engine from a parsed statement row.
  | 'opening_balance'  // Seeded during first-time-adoption period creation.
  | 'reclassification' // DEPRECATED — transformation reclass; pipeline removed.
  | 'adjustment'       // DEPRECATED — reframed as 'manual' (doc §4.2).
  | 'manual';          // Accountant-entered free-form posting.

export const JOURNAL_ENTRY_SOURCES: readonly JournalEntrySource[] = [
  'bank_statement',
  'opening_balance',
  'reclassification',
  'adjustment',
  'manual',
];

export type JournalEntryStatus = 'draft' | 'committed' | 'reversed';
export const JOURNAL_ENTRY_STATUSES: readonly JournalEntryStatus[] = [
  'draft',
  'committed',
  'reversed',
];

const decimalZero = (): Types.Decimal128 => Types.Decimal128.fromString('0');

/**
 * The transaction header. Lines live in JournalEntryLine, keyed by entryId.
 *
 * Why split header + lines instead of embedded array:
 *   - Multi-line entries (1 Dt against N Cr) are common in real ledgers.
 *   - Per-line aggregation queries ("all debits to account 6010 in Q1")
 *     stay simple as a flat collection scan with an index.
 *   - Embedded arrays in Mongo bloat the parent doc once volume grows.
 *
 * Sign convention: each line is unsigned (`amount >= 0`) plus `direction:
 * 'debit' | 'credit'`. Storing signed amounts looks tidier but loses the
 * Dt/Cr distinction needed for trial-balance projection.
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
export class JournalEntry {
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true, index: true })
  organizationId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'ReportingPeriod', required: true, index: true })
  periodId!: Types.ObjectId;

  // Business date the entry represents (not creation time — that's timestamps.createdAt).
  @Prop({ type: Date, required: true, index: true })
  date!: Date;

  @Prop({ type: String, default: '', trim: true, maxlength: 2000 })
  description!: string;

  @Prop({ type: String, enum: JOURNAL_ENTRY_SOURCES, required: true, index: true })
  source!: JournalEntrySource;

  // Free-form provenance pointer. For bank entries: the statement-row hash or
  // upload-id + row-index. The service layer is responsible for keeping this
  // opaque-but-stable.
  @Prop({ type: String, default: null, trim: true, maxlength: 500 })
  sourceRef!: string | null;

  @Prop({
    type: String,
    enum: JOURNAL_ENTRY_STATUSES,
    required: true,
    default: 'draft',
    index: true,
  })
  status!: JournalEntryStatus;

  // Sum of debits (== sum of credits — invariant the service must enforce
  // before flipping to 'committed'). Stored for query convenience.
  @Prop({ type: MongooseSchema.Types.Decimal128, default: decimalZero })
  totalAmount!: Types.Decimal128;

  // Audit pointers — who drafted, committed, reversed.
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy!: Types.ObjectId;

  @Prop({ type: Date, default: null })
  committedAt!: Date | null;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  committedBy!: Types.ObjectId | null;

  @Prop({ type: Date, default: null })
  reversedAt!: Date | null;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  reversedBy!: Types.ObjectId | null;

  // For reversal entries — points at the entry being reversed. The reversal
  // itself is a new entry (sign-flipped lines) so adjustments stay append-only.
  @Prop({ type: Types.ObjectId, ref: 'JournalEntry', default: null, index: true })
  reversesEntryId!: Types.ObjectId | null;
}

export const JournalEntrySchema = SchemaFactory.createForClass(JournalEntry);

// Period + status scans drive the balance-rollup recompute.
// MIGRATION NOTE: previously this index included `layer`. The old index
// (organizationId, periodId, layer, status) must be dropped once on the live
// DB; this unnamed index will otherwise be created alongside the stale one.
JournalEntrySchema.index({ organizationId: 1, periodId: 1, status: 1 });
JournalEntrySchema.index({ organizationId: 1, source: 1, status: 1, date: -1 });
// Bank-statement deduplication via sourceRef.
JournalEntrySchema.index(
  { organizationId: 1, sourceRef: 1 },
  { partialFilterExpression: { sourceRef: { $type: 'string' } } },
);
