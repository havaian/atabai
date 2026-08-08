import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {
  HydratedDocument,
  Model,
  Schema as MongooseSchema,
  Types,
} from 'mongoose';

export type JournalEntryLineDocument = HydratedDocument<JournalEntryLine>;
export type JournalEntryLineModel = Model<JournalEntryLine>;

export type LineDirection = 'debit' | 'credit';
export const LINE_DIRECTIONS: readonly LineDirection[] = ['debit', 'credit'];

/**
 * One leg of a double-entry posting. Lives in its own collection rather than
 * embedded on JournalEntry - see [[journal-entry]] for the rationale.
 *
 * The subconto/counterparty fields mirror those on AccountBalance so a
 * rollup is a straight group-by-(account, subconto1/2/3) aggregation with no
 * shape translation. organizationId/periodId are denormalized from the parent
 * JournalEntry so the rollup pipeline does not need a $lookup.
 *
 * `amount` is always non-negative (Decimal128.fromString('0').gte). Sign is
 * carried by `direction`. Storing signed amounts would lose Dt/Cr distinction
 * which the trial balance presentation needs.
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
export class JournalEntryLine {
  @Prop({
    type: Types.ObjectId,
    ref: 'JournalEntry',
    required: true,
    index: true,
  })
  entryId!: Types.ObjectId;

  // Denormalized from JournalEntry - copied at create time, never changed.
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true, index: true })
  organizationId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'ReportingPeriod', required: true, index: true })
  periodId!: Types.ObjectId;

  // Business date - usually === JournalEntry.date but explicit for line-level
  // aggregations that scan without joining the parent.
  @Prop({ type: Date, required: true, index: true })
  date!: Date;

  // ─── The posting itself ────────────────────────────────────────────────────

  @Prop({ type: String, required: true, trim: true, index: true })
  accountCode!: string;

  @Prop({ type: String, enum: LINE_DIRECTIONS, required: true })
  direction!: LineDirection;

  @Prop({
    type: MongooseSchema.Types.Decimal128,
    required: true,
    default: () => Types.Decimal128.fromString('0'),
  })
  amount!: Types.Decimal128;

  // ─── Subconto axis (mirrors AccountBalance) ────────────────────────────────

  @Prop({ type: String, default: null, trim: true })
  subconto1Value!: string | null;

  @Prop({ type: String, default: null, trim: true })
  subconto2Value!: string | null;

  @Prop({ type: String, default: null, trim: true })
  subconto3Value!: string | null;

  @Prop({
    type: Types.ObjectId,
    ref: 'Counterparty',
    default: null,
    index: true,
  })
  counterpartyId!: Types.ObjectId | null;

  // ─── Settlement document (methodology §6.3, §7) ────────────────────────────
  // Which contract/invoice this leg settles. Filipp: settlement is strict per
  // document - "да, строго по тому документу по которому платеж/операция" - so
  // the document the leg gashes is recorded on the leg, and the running-balance
  // search narrows to it. Null on legs with no document (e.g. bank-account
  // legs, internal transfers). `documentType` says which collection
  // `documentId` points at, since contracts and invoices are separate.
  @Prop({ type: String, enum: ['contract', 'invoice'], default: null })
  documentType!: 'contract' | 'invoice' | null;

  @Prop({ type: Types.ObjectId, default: null, index: true })
  documentId!: Types.ObjectId | null;

  // ─── Multi-currency + quantity ─────────────────────────────────────────────

  @Prop({ type: String, default: null, uppercase: true, trim: true })
  currency!: string | null;

  @Prop({ type: MongooseSchema.Types.Decimal128, default: null })
  quantity!: Types.Decimal128 | null;

  // ─── Free-text description (per line - separate from entry description) ────
  @Prop({ type: String, default: '', trim: true, maxlength: 1000 })
  description!: string;
}

export const JournalEntryLineSchema = SchemaFactory.createForClass(JournalEntryLine);

// THE rollup index - exactly the group key for recomputing AccountBalance.
// Scanned with $match on (org, period) and $group on the rest.
//
// MIGRATION NOTE: the previous line_rollup_key included `layer`. As with
// balance_key, the old index must be dropped once on the live DB before this
// definition can build (same-name index, different key spec).
JournalEntryLineSchema.index(
  {
    organizationId: 1,
    periodId: 1,
    accountCode: 1,
    subconto1Value: 1,
    subconto2Value: 1,
    subconto3Value: 1,
  },
  { name: 'line_rollup_key' },
);

// Bank engine: "all lines on account 6010 for counterparty X" - used during
// the running-balance check to decide between payable vs. advance.
JournalEntryLineSchema.index(
  { organizationId: 1, periodId: 1, accountCode: 1, counterpartyId: 1, date: 1 },
  { name: 'line_by_counterparty_timeline' },
);

// Per-document settlement (methodology §6.3): "all lines settling document D
// for counterparty X across the 43/63 (or 40/63) accounts". Gashing is strict
// per document, so the running-balance search narrows on (counterparty,
// document) and sums the relevant accounts.
JournalEntryLineSchema.index(
  {
    organizationId: 1,
    periodId: 1,
    counterpartyId: 1,
    documentType: 1,
    documentId: 1,
    accountCode: 1,
  },
  { name: 'line_by_document_settlement' },
);

// Audit drill-down from a UI balance row back to the lines that produced it.
JournalEntryLineSchema.index({ entryId: 1 });

// Account activity statement (ledger card).
JournalEntryLineSchema.index({ organizationId: 1, accountCode: 1, date: 1 });
