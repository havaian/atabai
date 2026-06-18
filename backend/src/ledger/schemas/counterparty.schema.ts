import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Model, Types } from 'mongoose';

import {
  ALL_COUNTERPARTY_SETTLEMENT_DEPTHS,
  COUNTERPARTY_SETTLEMENT_DEPTH,
  type CounterpartySettlementDepth,
} from '../constants/accounting-policy';

export type CounterpartyDocument = HydratedDocument<Counterparty>;
export type CounterpartyModel = Model<Counterparty>;

/**
 * One of a counterparty's bank accounts. The bank engine joins incoming
 * statement rows to existing counterparties primarily by ИНН, but the
 * counterparty's "Счёт" field on the row also gets recorded here as the
 * counterparty grows over time. Useful for ambiguous cases where the same
 * ИНН pays from different accounts.
 */
@Schema({ _id: false })
class CounterpartyAccount {
  @Prop({ type: String, required: true, trim: true })
  accountNumber!: string;

  @Prop({ type: String, default: null, trim: true })
  bankCode!: string | null;

  @Prop({ type: Date, default: () => new Date() })
  firstSeenAt!: Date;
}
const CounterpartyAccountSchema = SchemaFactory.createForClass(CounterpartyAccount);

/**
 * Counterparty registry — bank ТЗ §1, §3.
 *
 * Per-organization (each org maintains its own counterparty list). Auto-created
 * by the bank engine when a statement row carries an unknown ИНН. The bank
 * engine flags those rows YELLOW in the accountant preview screen so the
 * accountant verifies the auto-fill before committing.
 *
 * The treasury counterparty (ИНН 201122919) is special — see constants/treasury.ts.
 * It carries `isTreasury: true`, and statement rows joining to it route through
 * TreasuryRule's long-account-number lookup instead of the standard
 * payable/receivable algorithm.
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
export class Counterparty {
  @Prop({
    type: Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true,
  })
  organizationId!: Types.ObjectId;

  // Primary join key into bank statements. Treasury == TREASURY_INN constant.
  // May be null for synthetic counterparties (rare) — partial-unique index below.
  @Prop({ type: String, default: null, trim: true, index: true })
  inn!: string | null;

  @Prop({ type: String, required: true, trim: true, maxlength: 500 })
  name!: string;

  @Prop({ type: [CounterpartyAccountSchema], default: [] })
  accounts!: CounterpartyAccount[];

  // Cached against the TREASURY_INN constant so we don't string-compare on
  // every bank row. Set on create/update of `inn`.
  @Prop({ type: Boolean, default: false, index: true })
  isTreasury!: boolean;

  // True when the counterparty was auto-created from a bank-statement row
  // rather than manually entered. Drives the YELLOW row state in the preview
  // UI (bank ТЗ §7) and the "verify me" prompt on first appearance.
  @Prop({ type: Boolean, default: false, index: true })
  createdFromBankRow!: boolean;

  // Marks a counterparty as no longer transacted with; soft-delete equivalent.
  @Prop({ type: Boolean, default: true, index: true })
  isActive!: boolean;

  /**
   * Per-counterparty settlement depth (methodology §7.1 + Filipp's §5 ruling).
   * `inherit` (the default) means follow the company policy-level
   * `accountingPolicy.settlementDepth`. Never read this inline — resolve the
   * effective depth via resolveSettlementDepth() so the inherit fallback is
   * applied uniformly.
   */
  @Prop({
    type: String,
    enum: ALL_COUNTERPARTY_SETTLEMENT_DEPTHS,
    default: COUNTERPARTY_SETTLEMENT_DEPTH.INHERIT,
  })
  settlementDepth!: CounterpartySettlementDepth;
}

export const CounterpartySchema = SchemaFactory.createForClass(Counterparty);

// (org, inn) is unique when inn is set — handles the "two ИНН-bearing
// counterparties in same org" duplicate prevention.
CounterpartySchema.index(
  { organizationId: 1, inn: 1 },
  {
    unique: true,
    partialFilterExpression: { inn: { $type: 'string' } },
  },
);

// Name search (case-insensitive substring matches via collation later).
CounterpartySchema.index({ organizationId: 1, name: 1 });

// Account-number lookup for the rare case where a bank row has no ИНН but
// the account is recognized.
CounterpartySchema.index({ organizationId: 1, 'accounts.accountNumber': 1 });
