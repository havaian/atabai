import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Model, Types } from 'mongoose';

export type TreasuryRuleDocument = HydratedDocument<TreasuryRule>;
export type TreasuryRuleModel = Model<TreasuryRule>;

/**
 * The learnable «Справочник правил казначейских платежей» from bank ТЗ §4.
 *
 * When a bank-statement row has counterparty ИНН == TREASURY_INN (201122919),
 * the actual record-account (НДФЛ, НДС, налог на прибыль, …) cannot be
 * inferred from ИНН alone. The treasury encodes the tax type as a long
 * structured account number that appears inside the "Назначение платежа"
 * free-text field.
 *
 * This collection is the rule book the bank engine searches against. When the
 * accountant manually fixes a RED row in the preview UI (bank ТЗ §7) and
 * clicks "Добавить в правила", a new TreasuryRule lands here so the next
 * occurrence resolves automatically. Per-org so each client's tax setup can
 * grow independently.
 *
 * Two flavors of match:
 *   - `EXACT`: full-string equality with `longAccountNumber` against an
 *      occurrence inside Назначение платежа. The ТЗ explicitly demands this.
 *   - `KEYWORD`: substring/regex fallback for ambiguous payments. Lower
 *     priority - only consulted when no EXACT match fires.
 *
 * Priority is integer: higher value wins on ties. Lets the accountant
 * disambiguate when several rules could apply.
 */
export type TreasuryRuleKind = 'exact' | 'keyword';
export const TREASURY_RULE_KINDS: readonly TreasuryRuleKind[] = [
  'exact',
  'keyword',
];

@Schema({
  timestamps: true,
  toJSON: {
    transform: (_doc, ret: Record<string, unknown>) => {
      delete ret.__v;
      return ret;
    },
  },
})
export class TreasuryRule {
  @Prop({
    type: Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true,
  })
  organizationId!: Types.ObjectId;

  @Prop({ type: String, enum: TREASURY_RULE_KINDS, required: true, default: 'exact' })
  kind!: TreasuryRuleKind;

  // For EXACT rules: the long structured account number (e.g.
  // "1000218602262873111103093"). For KEYWORD rules: a substring or regex
  // pattern. The service decides which interpretation applies via `kind`.
  @Prop({ type: String, required: true, trim: true })
  pattern!: string;

  // The record-account code to post against when this rule fires
  // (e.g. "6420" for НДС to be paid, "4420" for prepayment thereof).
  @Prop({ type: String, required: true, trim: true })
  recordAccountCode!: string;

  // Optional secondary counterparty override. Most treasury rules just resolve
  // the record account, but some rules need to attribute to a non-treasury
  // counterparty (e.g. specific tax authority). Null in the common case.
  @Prop({ type: Types.ObjectId, ref: 'Counterparty', default: null })
  counterpartyOverrideId!: Types.ObjectId | null;

  // Human label / explanation. Surfaced in the rule-management UI and in the
  // audit trail for adjustments made by the bank engine.
  @Prop({ type: String, default: '', trim: true, maxlength: 500 })
  description!: string;

  // Higher number = higher priority. The bank engine runs rules in priority
  // order and uses the first match. Defaults are deliberately spaced so the
  // accountant can insert overrides between them without a renumber.
  @Prop({ type: Number, default: 100, index: true })
  priority!: number;

  @Prop({ type: Boolean, default: true, index: true })
  isActive!: boolean;

  // Audit pointers - who introduced the rule (manual entry vs. learning loop).
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy!: Types.ObjectId;

  // True when the rule was created via the "Добавить в правила" button on
  // the bank-engine preview screen rather than typed manually. Distinguishes
  // learning-loop rules from operator-curated ones during rule review.
  @Prop({ type: Boolean, default: false })
  learnedFromBankReview!: boolean;
}

export const TreasuryRuleSchema = SchemaFactory.createForClass(TreasuryRule);

// Same pattern can't be registered twice for the same org+kind - the
// learning loop must update an existing rule, not duplicate it.
TreasuryRuleSchema.index(
  { organizationId: 1, kind: 1, pattern: 1 },
  { unique: true },
);

// The bank-engine hot path: scan active rules for an org, ordered by priority
// desc, kind asc (exact before keyword).
TreasuryRuleSchema.index({ organizationId: 1, isActive: 1, kind: 1, priority: -1 });
