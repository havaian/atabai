import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Model, Types } from 'mongoose';

import {
  ALL_INVENTORY_VALUATIONS,
  ALL_LEAVE_RESERVES,
  ALL_PAYROLL_DETAILS,
  ALL_SETTLEMENT_DEPTHS,
  ALL_TAX_REGIMES,
  DEFAULT_ACCOUNTING_POLICY,
  DEFAULT_NON_MONETARY_ACCOUNTS,
  type InventoryValuation,
  type LeaveReserve,
  type PayrollDetail,
  type SettlementDepth,
  type TaxRegime,
} from '../constants/accounting-policy';

export type OrganizationProfileDocument = HydratedDocument<OrganizationProfile>;
export type OrganizationProfileModel = Model<OrganizationProfile>;

/**
 * One bank settlement account owned by the organization. Used by the bank
 * engine to identify whose statement is being uploaded (bank ТЗ §2). Some
 * banks encode movement direction by which of the org's accounts appears
 * in the row rather than by Dt/Cr — the engine must know our accounts to
 * resolve that.
 */
@Schema({ _id: false })
class OrgBankAccount {
  @Prop({ type: String, required: true, trim: true })
  accountNumber!: string;

  @Prop({ type: String, default: null, trim: true })
  bankCode!: string | null;

  @Prop({ type: String, default: null, trim: true })
  label!: string | null;

  @Prop({ type: String, default: 'UZS', trim: true, uppercase: true })
  currency!: string;

  /**
   * NSBU ledger account this settlement account posts to (e.g. 5110 for the
   * main sum current account, 5210 for a foreign-currency account, 5730 for
   * the FX-purchase transit account, 5530 for corporate cards). The bank
   * engine uses it to build the org-side leg of an internal-transfer posting:
   * when a statement row stays inside the company's own contour (own ИНН, or
   * the row's «Счёт» is one of these accounts), the engine posts between two
   * of these ledger accounts instead of resolving a counterparty (bank ТЗ §1).
   *
   * Optional so existing profiles created before this field keep loading;
   * when it is absent the bank engine flags the row for manual account
   * selection rather than guessing.
   */
  @Prop({ type: String, default: null, trim: true })
  ledgerAccount!: string | null;

  /**
   * Sub-account kept as its own field rather than baked into accountNumber
   * (bank ТЗ / methodology §3.5 — "субсчёт лучше вести отдельным полем …
   * чтобы на последующих шагах было легче разделять"). Free-form for now;
   * the subconto epic decides how it maps onto the synthetic-account
   * subconto value. Null when the account has no sub-account.
   */
  @Prop({ type: String, default: null, trim: true })
  subAccount!: string | null;

  /**
   * Closed accounts are flagged inactive, never deleted (methodology §3.5 —
   * "закрытие счёта = пометка «неактивный» … запись не удаляется, старые
   * проводки сохраняют ссылку"). New postings must not be made against an
   * inactive account; existing postings keep referencing it. Defaults to
   * active so accounts created before this field stay usable.
   */
  @Prop({ type: Boolean, default: true })
  isActive!: boolean;
}
const OrgBankAccountSchema = SchemaFactory.createForClass(OrgBankAccount);

/**
 * Accounting policy — the 6-block ruleset set at registration (methodology §9).
 * Structure + chosen options only; the posting-logic effect of each block is
 * later work (§9: "Логика влияния каждого блока на проводки — отдельно,
 * позже"). Enums + defaults live in constants/accounting-policy.ts.
 *
 * Block 3 (accounting currency) is intentionally NOT duplicated here — the
 * base reporting currency already lives on the profile as `baseCurrency`.
 */
@Schema({ _id: false })
class AccountingPolicy {
  // Block 1 — taxes.
  @Prop({ type: String, enum: ALL_TAX_REGIMES, default: DEFAULT_ACCOUNTING_POLICY.taxRegime })
  taxRegime!: TaxRegime;

  @Prop({ type: Boolean, default: DEFAULT_ACCOUNTING_POLICY.vatPayer })
  vatPayer!: boolean;

  // Percent; only meaningful when vatPayer is true, kept regardless so toggling
  // the payer flag off and on doesn't lose the configured rate.
  @Prop({ type: Number, default: DEFAULT_ACCOUNTING_POLICY.vatRate })
  vatRate!: number;

  // Block 2 — inventory valuation.
  @Prop({
    type: String,
    enum: ALL_INVENTORY_VALUATIONS,
    default: DEFAULT_ACCOUNTING_POLICY.inventoryValuation,
  })
  inventoryValuation!: InventoryValuation;

  // Block 4 — operational control: allow issuing stock into a negative balance.
  @Prop({ type: Boolean, default: DEFAULT_ACCOUNTING_POLICY.allowNegativeStock })
  allowNegativeStock!: boolean;

  // Block 5 — counterparty settlement depth (contract / invoice; §7.1).
  @Prop({
    type: String,
    enum: ALL_SETTLEMENT_DEPTHS,
    default: DEFAULT_ACCOUNTING_POLICY.settlementDepth,
  })
  settlementDepth!: SettlementDepth;

  // Block 6 — payroll.
  @Prop({
    type: String,
    enum: ALL_PAYROLL_DETAILS,
    default: DEFAULT_ACCOUNTING_POLICY.payrollDetail,
  })
  payrollDetail!: PayrollDetail;

  @Prop({
    type: String,
    enum: ALL_LEAVE_RESERVES,
    default: DEFAULT_ACCOUNTING_POLICY.leaveReserve,
  })
  leaveReserve!: LeaveReserve;

  /**
   * Accounts the org treats as non-monetary — excluded from FX revaluation
   * (methodology дополнение §1.2 / §6). Manual per Filipp; seeded from the
   * default. The factory copies the default array so profiles don't share one
   * mutable instance.
   */
  @Prop({ type: [String], default: () => [...DEFAULT_NON_MONETARY_ACCOUNTS] })
  nonMonetaryAccounts!: string[];
}
const AccountingPolicySchema = SchemaFactory.createForClass(AccountingPolicy);

/**
 * Ledger-side profile for an Organization — architecture doc §8.1.
 *
 * Deliberately separate from the access-spine [[Organization]]: that one owns
 * tenancy, this one owns the ledger settings (transition date, base currency,
 * bank requisites). Doc §8.1 calls it "Organization requisites" and notes
 * they "attach here too — deliberately left off the access-spine Organization
 * to avoid scope creep."
 *
 * 1:1 with Organization, lazily created on first ledger interaction (or
 * eagerly on org creation; the service decides).
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
export class OrganizationProfile {
  @Prop({
    type: Types.ObjectId,
    ref: 'Organization',
    required: true,
    unique: true,
    index: true,
  })
  organizationId!: Types.ObjectId;

  // Legal name as registered (e.g. ""ODTI" Mas'uliyati Cheklangan Jamiyat") —
  // may differ from the access-spine Organization.name which is the user-facing
  // display name. Surfaced on rendered statements.
  @Prop({ type: String, default: null, trim: true, maxlength: 500 })
  legalName!: string | null;

  // The org's own ИНН — used to identify ownership of bank statements during
  // upload (bank ТЗ §2). Indexed for the statement-attribution lookup.
  @Prop({ type: String, default: null, trim: true, index: true })
  inn!: string | null;

  /**
   * First-time IFRS adoption transition date (architecture doc §7.3).
   *
   * Per the methodology: if the first reporting period is 2026, transitionDate
   * is 01.01.2025 (i.e. the start of the comparative year — equivalently the
   * "Входящий баланс на 01.01.2025 / на 31.12.2024" point). Null until the
   * org goes through the first-time-adoption setup.
   *
   * Once set, ReportingPeriod creation seeds three periods (opening,
   * comparative, reporting) anchored to this date.
   */
  @Prop({ type: Date, default: null })
  transitionDate!: Date | null;

  // Base reporting currency. UZS for Uzbek clients; left configurable for
  // multi-currency orgs (Decimal128 elsewhere is currency-neutral).
  @Prop({ type: String, default: 'UZS', trim: true, uppercase: true })
  baseCurrency!: string;

  // Contact requisites. Auto-filled from the orginfo lookup by ИНН
  // (methodology дополнение §2 — "наименование / адрес / телефон / имейл"),
  // editable afterwards. The р/с is deliberately NOT sourced here — it comes
  // from the bank statement. Null until filled.
  @Prop({ type: String, default: null, trim: true, maxlength: 500 })
  address!: string | null;

  @Prop({ type: String, default: null, trim: true, maxlength: 50 })
  phone!: string | null;

  @Prop({ type: String, default: null, trim: true, maxlength: 200 })
  email!: string | null;

  // Settlement accounts the org owns. Bank statements are matched to the org
  // by comparing the statement's "Счёт" / org-side account against this list.
  @Prop({ type: [OrgBankAccountSchema], default: [] })
  bankAccounts!: OrgBankAccount[];

  /**
   * Accounting policy — the 6-block ruleset set at registration (methodology
   * §9). Defaults to DEFAULT_ACCOUNTING_POLICY so every profile carries a
   * complete, valid policy even if the onboarding step is skipped; the client
   * adjusts it in onboarding or later on the profile screen.
   */
  @Prop({
    type: AccountingPolicySchema,
    default: () => ({
      ...DEFAULT_ACCOUNTING_POLICY,
      nonMonetaryAccounts: [...DEFAULT_ACCOUNTING_POLICY.nonMonetaryAccounts],
    }),
  })
  accountingPolicy!: AccountingPolicy;
}

export const OrganizationProfileSchema = SchemaFactory.createForClass(OrganizationProfile);

OrganizationProfileSchema.index({ 'bankAccounts.accountNumber': 1 });
