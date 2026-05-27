import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {
  HydratedDocument,
  Model,
  Schema as MongooseSchema,
  Types,
} from 'mongoose';

import {
  ALL_BALANCE_LAYERS,
  type BalanceLayer,
} from '../constants/balance-layers';

export type JournalEntryDocument = HydratedDocument<JournalEntry>;
export type JournalEntryModel = Model<JournalEntry>;

/**
 * Where an entry originated. Drives both the human label in the audit trail
 * and the staging workflow — bank-engine entries land in 'draft' status,
 * adjustment entries require a specialist sign-off, reclass entries are
 * sign-symmetric, etc.
 */
export type JournalEntrySource =
  | 'bank_statement'   // Produced by the bank engine from a parsed statement row.
  | 'opening_balance'  // Seeded during first-time-adoption period creation.
  | 'reclassification' // Sign-symmetric move between accounts within RECLASSIFICATION layer.
  | 'adjustment'       // Overlay entry on ADJUSTMENT layer; carries adjustmentMeta.
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

/**
 * IFRS standards relevant to step 4 / step 7 of the methodology (architecture
 * doc §4.1). Open list — adjustments tagged with an unknown standard are
 * accepted but flagged for review by the analyst.
 */
export const IFRS_STANDARDS = {
  IAS_16: 'IAS 16',   // Property, Plant & Equipment
  IFRS_16: 'IFRS 16', // Leases — right-of-use recognition
  IFRS_9: 'IFRS 9',   // Financial Instruments — ECL / doubtful-debt provision
  IFRS_15: 'IFRS 15', // Revenue — control-transfer timing
  IAS_12: 'IAS 12',   // Income Taxes — deferred tax (derived adjustments)
} as const;

export type IfrsStandard = (typeof IFRS_STANDARDS)[keyof typeof IFRS_STANDARDS];

export const ALL_IFRS_STANDARDS: readonly IfrsStandard[] = Object.values(IFRS_STANDARDS);

const decimalZero = (): Types.Decimal128 => Types.Decimal128.fromString('0');

/**
 * Metadata required when an entry lives on the ADJUSTMENT layer. Empty/absent
 * on every other layer. The four fields trace directly to architecture doc §7.2:
 *
 *   "Each adjustment carries an IFRS standard tag (IAS 16 / IFRS 16 / IFRS 9 /
 *    IFRS 15), a human reason, its deferred-tax effect, and its disclosure text."
 *
 * Deferred tax is modeled as an amount + an Account code rather than a separate
 * adjustment entry — but in practice the deferred-tax engine (step 5) sweeps
 * temporary differences across all adjustments to emit IAS 12 entries. Both
 * approaches coexist: this field is the per-entry estimate, the sweep is the
 * authoritative IAS 12 derivation.
 */
@Schema({ _id: false })
class AdjustmentMeta {
  @Prop({ type: String, required: true, trim: true })
  standard!: string; // IfrsStandard string, but kept open for unknowns.

  @Prop({ type: String, required: true, trim: true, maxlength: 2000 })
  reason!: string;

  // Per-entry deferred-tax estimate. The sweep in step 5 is authoritative.
  @Prop({ type: MongooseSchema.Types.Decimal128, default: decimalZero })
  taxEffectAmount!: Types.Decimal128;

  // Free-text intended for the notes & disclosures section (step 7).
  // Projecting from the adjustment layer is how notes are auto-drafted.
  @Prop({ type: String, default: '', trim: true, maxlength: 4000 })
  disclosureText!: string;
}
const AdjustmentMetaSchema = SchemaFactory.createForClass(AdjustmentMeta);

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
  // upload-id + row-index. For opening seed: the ОСВ import job id. The
  // service layer is responsible for keeping this opaque-but-stable.
  @Prop({ type: String, default: null, trim: true, maxlength: 500 })
  sourceRef!: string | null;

  @Prop({ type: String, enum: ALL_BALANCE_LAYERS, required: true, index: true })
  layer!: BalanceLayer;

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

  // Required when `layer === 'adjustment'`, absent everywhere else. The
  // service-layer guard rejects an adjustment commit without populated meta.
  @Prop({ type: AdjustmentMetaSchema, default: null })
  adjustmentMeta!: AdjustmentMeta | null;

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

// Period + layer scans drive the balance-rollup recompute.
JournalEntrySchema.index({ organizationId: 1, periodId: 1, layer: 1, status: 1 });
JournalEntrySchema.index({ organizationId: 1, source: 1, status: 1, date: -1 });
// Bank-statement deduplication via sourceRef.
JournalEntrySchema.index(
  { organizationId: 1, sourceRef: 1 },
  { partialFilterExpression: { sourceRef: { $type: 'string' } } },
);
