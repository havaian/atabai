import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Model, Types } from 'mongoose';

import { ALL_ACCOUNT_VIDS, type AccountVid } from '../constants/account-vid';

export type ChartOfAccountDocument = HydratedDocument<ChartOfAccount>;
export type ChartOfAccountModel = Model<ChartOfAccount>;

/**
 * NSBU chart of accounts row - per-organization. Seeded from the canonical
 * 1C "УЗ" export (507 accounts) but each org may carry custom sub-account
 * codes that 1C lets users add (e.g. 0130.2 "Рабочие машины и оборудование").
 *
 * Field shape follows the actual 1C TDSheet columns one-for-one (architecture
 * doc §4.3 and the analyst's `Chart of accounts.xlsx`):
 *   Код счета | Наименование счета | Субконто 1/2/3 | Вид | Вал. | Кол. | Подр. | НУ | Заб. | Быстрый выбор
 *
 * The Вид column carries the type+sign semantics - see constants/account-vid.ts
 * for the А/П/КА/КП/Т enum and the `naturalSide` / `reducesParent` helpers
 * that retire the legacy per-row `isNegative` flag.
 *
 * Subconto dimensions live as named strings (`subconto1Name`, etc.) - the
 * NAME of the dimension (e.g. "Контрагенты"), not the value. Values live on
 * AccountBalance / JournalEntryLine. Service code SHOULD reference the
 * constants in `subconto-dimensions.ts` rather than literal strings.
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
export class ChartOfAccount {
  @Prop({
    type: Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true,
  })
  organizationId!: Types.ObjectId;

  // Hierarchical code (e.g. "0100", "0130", "0130.2"). The dot suffix encodes
  // parentage - string-prefix matching gives the hierarchy.
  @Prop({ type: String, required: true, trim: true })
  code!: string;

  @Prop({ type: String, required: true, trim: true })
  name!: string;

  // Subconto dimension NAMES declared on this account (e.g. "Контрагенты",
  // "Договоры", "Банковские счета"). At most three slots per the 1C model;
  // unused slots are null. Order matters - slot 1 vs slot 2 distinguishes
  // primary from secondary analytics on a balance row.
  @Prop({ type: String, default: null, trim: true })
  subconto1Name!: string | null;

  @Prop({ type: String, default: null, trim: true })
  subconto2Name!: string | null;

  @Prop({ type: String, default: null, trim: true })
  subconto3Name!: string | null;

  @Prop({ type: String, enum: ALL_ACCOUNT_VIDS, required: true, index: true })
  vid!: AccountVid;

  // Flags mirroring the 1C "Вал./Кол./Подр./НУ/Заб." columns. Used by ingestion
  // to validate the shape of imported balance rows (e.g. a currency-tracked
  // account must carry a currency code on its balances).
  @Prop({ type: Boolean, default: false }) isCurrencyTracked!: boolean;
  @Prop({ type: Boolean, default: false }) isQuantityTracked!: boolean;
  @Prop({ type: Boolean, default: false }) isDepartmentTracked!: boolean;
  @Prop({ type: Boolean, default: false }) isTaxAccount!: boolean;
  @Prop({ type: Boolean, default: false }) isOffBalance!: boolean;

  // 1C "Быстрый выбор" - handy for fuzzy account lookup in the UI (e.g. "01202"
  // for "0120.2"). Dots stripped relative to `code`.
  @Prop({ type: String, default: null, trim: true })
  quickPick!: string | null;

  // True for accounts that exist in our seed but are not enabled for the org -
  // lets us preserve the canonical NSBU template while a client only uses a
  // subset of the chart.
  @Prop({ type: Boolean, default: true, index: true })
  isActive!: boolean;
}

export const ChartOfAccountSchema = SchemaFactory.createForClass(ChartOfAccount);

// Account code is unique within an org. Different orgs may share canonical
// codes (every NSBU shop has a "0100").
ChartOfAccountSchema.index({ organizationId: 1, code: 1 }, { unique: true });

// Fuzzy quick-pick search - case-insensitive prefix queries.
ChartOfAccountSchema.index({ organizationId: 1, quickPick: 1 });

// Vid-grouped scans (e.g. "give me all contra-active accounts in this org" for
// sign sanity-checks during transformation).
ChartOfAccountSchema.index({ organizationId: 1, vid: 1, isActive: 1 });
