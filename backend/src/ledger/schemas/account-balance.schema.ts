import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Model, Schema as MongooseSchema, Types } from 'mongoose';

export type AccountBalanceDocument = HydratedDocument<AccountBalance>;
export type AccountBalanceModel = Model<AccountBalance>;

/**
 * Where a balance row came from. The bank engine and the manual-entry engine
 * both write postings (JournalEntryLine rows) that are then *aggregated* into
 * a balance row — those are `posting_rollup`. `osv_import` is retained as a
 * historical provenance value on rows that pre-date the reframe; the ОСВ
 * import path itself has been removed (architecture doc §1.1, §4.3).
 */
export type BalanceSource =
  | 'osv_import' // Historical: rows imported before the reframe; importer removed.
  | 'posting_rollup' // Recomputed by aggregating JournalEntryLine rows.
  | 'manual'; // Operator override; audited via the calling service.

export const BALANCE_SOURCES: readonly BalanceSource[] = [
  'osv_import',
  'posting_rollup',
  'manual',
];

const decimalZero = (): Types.Decimal128 => Types.Decimal128.fromString('0');

/**
 * The universal currency of the ledger — architecture doc §3.2.
 *
 * Balance key: (organizationId, periodId, accountCode, level,
 *               subconto1Value, subconto2Value, subconto3Value).
 *
 * Single-layer: the old four-layer matrix collapsed to one posted balance
 * per key when the transformation pipeline was removed; there is no `layer`
 * dimension anymore.
 *
 * The subconto axis is MANDATORY (not optional). The bank engine's
 * per-counterparty running-balance check (bank ТЗ §6) operates at the
 * subconto grain — "account balance for account 6010" cannot answer "do we
 * owe this supplier?" and so cannot drive the posting choice between
 * 6010 (payable closing) and 4310 (advance issued).
 *
 * Accounts without any subconto declared on the ChartOfAccount carry
 * subconto1Value === subconto2Value === subconto3Value === null and become
 * flat single-row balances.
 *
 * Money uses Mongoose Decimal128 across the board. Accounting precision is
 * the product's reputational moat (doc §2 — "a single error gets the product
 * permanently dismissed"). Number-typed money would let 0.10 × 100 ≠ 10.0 land
 * in client-visible reports; that risk is not acceptable on the ledger spine.
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
export class AccountBalance {
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true, index: true })
  organizationId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'ReportingPeriod', required: true, index: true })
  periodId!: Types.ObjectId;

  // String account code (e.g. "0100", "0130.2"). Hierarchical via dot suffix.
  @Prop({ type: String, required: true, trim: true, index: true })
  accountCode!: string;

  /**
   * Account hierarchy depth: 0 = top-level account, 1 = sub-account, 2 =
   * sub-sub, … Part of the balance key so an account printed as BOTH a
   * rolled-up line and a deeper detail line under the same code can be stored
   * verbatim. Posting rollups sit at level 0, the account grain. (Inert for
   * bank postings, which never set it — retained per the reframe note that
   * `level` is harmless dead weight once OSV ingestion is gone.)
   */
  @Prop({ type: Number, default: 0 })
  level!: number;

  // Subconto VALUES — see ChartOfAccount.subcontoNNName for the DIMENSION name.
  // Stored as strings; counterparty / contract / bank-account refs are
  // stringified ObjectIds. Null when the slot is unused on this account.
  @Prop({ type: String, default: null, trim: true })
  subconto1Value!: string | null;

  @Prop({ type: String, default: null, trim: true })
  subconto2Value!: string | null;

  @Prop({ type: String, default: null, trim: true })
  subconto3Value!: string | null;

  /**
   * Denormalized pointer when one of the subconto slots resolves to a
   * Counterparty (typically slot 1 on receivable/payable accounts). Lets the
   * bank engine's running-balance check run as a single indexed read rather
   * than parsing subconto1Value and casting it back to an ObjectId.
   *
   * Service code MUST keep this in sync with the corresponding subconto slot.
   */
  @Prop({
    type: Types.ObjectId,
    ref: 'Counterparty',
    default: null,
    index: true,
  })
  counterpartyId!: Types.ObjectId | null;

  // ─── Money columns (Decimal128 throughout) ─────────────────────────────────

  @Prop({ type: MongooseSchema.Types.Decimal128, default: decimalZero })
  openingDebit!: Types.Decimal128;

  @Prop({ type: MongooseSchema.Types.Decimal128, default: decimalZero })
  openingCredit!: Types.Decimal128;

  @Prop({ type: MongooseSchema.Types.Decimal128, default: decimalZero })
  periodDebit!: Types.Decimal128;

  @Prop({ type: MongooseSchema.Types.Decimal128, default: decimalZero })
  periodCredit!: Types.Decimal128;

  @Prop({ type: MongooseSchema.Types.Decimal128, default: decimalZero })
  closingDebit!: Types.Decimal128;

  @Prop({ type: MongooseSchema.Types.Decimal128, default: decimalZero })
  closingCredit!: Types.Decimal128;

  // ─── Multi-currency + quantity (per ChartOfAccount flags) ──────────────────

  // Null when balance is in the org's base currency (the common case).
  // When set, all six money columns are in this currency; FX conversion to
  // baseCurrency happens at report time, not store time.
  @Prop({ type: String, default: null, uppercase: true, trim: true })
  currency!: string | null;

  // Quantity column for quantity-tracked accounts (ChartOfAccount.isQuantityTracked).
  // Null otherwise. Used by inventory accounts, capital construction, etc.
  @Prop({ type: MongooseSchema.Types.Decimal128, default: null })
  quantity!: Types.Decimal128 | null;

  // ─── Provenance ────────────────────────────────────────────────────────────

  @Prop({ type: String, enum: BALANCE_SOURCES, required: true, default: 'osv_import' })
  source!: BalanceSource;

  // Last time the row was (re)computed or imported. The materialized-view
  // freshness check vs JournalEntryLine writes is staleness = max(line.updatedAt) > recomputedAt.
  @Prop({ type: Date, default: () => new Date(), index: true })
  recomputedAt!: Date;
}

export const AccountBalanceSchema = SchemaFactory.createForClass(AccountBalance);

// THE balance key — unique per row. Nulls in subconto slots are treated as
// equal by MongoDB so accounts without subconto get exactly one row per
// (org, period, account, level). `level` distinguishes the same code printed
// at multiple tree depths (rollup + detail).
//
// MIGRATION NOTE: the previous balance_key included `layer`. Dropping a field
// from a same-named index is not applied automatically — the old index must be
// dropped once on the live DB before this definition can build, or Mongo will
// raise an index-spec conflict on boot. See the removal notes accompanying
// this change.
AccountBalanceSchema.index(
  {
    organizationId: 1,
    periodId: 1,
    accountCode: 1,
    level: 1,
    subconto1Value: 1,
    subconto2Value: 1,
    subconto3Value: 1,
  },
  { unique: true, name: 'balance_key' },
);

// Bank engine: "current payable / receivable balance for counterparty X on
// account 6010 in period P". Index covers the equality fields for this query.
AccountBalanceSchema.index(
  { organizationId: 1, periodId: 1, accountCode: 1, counterpartyId: 1 },
  { name: 'balance_by_counterparty' },
);

// Staleness sweep — find rows older than a posting batch.
AccountBalanceSchema.index({ organizationId: 1, recomputedAt: 1 });
