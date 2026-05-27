import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Model, Types } from 'mongoose';

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
}
const OrgBankAccountSchema = SchemaFactory.createForClass(OrgBankAccount);

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

  // Settlement accounts the org owns. Bank statements are matched to the org
  // by comparing the statement's "Счёт" / org-side account against this list.
  @Prop({ type: [OrgBankAccountSchema], default: [] })
  bankAccounts!: OrgBankAccount[];
}

export const OrganizationProfileSchema = SchemaFactory.createForClass(OrganizationProfile);

OrganizationProfileSchema.index({ 'bankAccounts.accountNumber': 1 });
