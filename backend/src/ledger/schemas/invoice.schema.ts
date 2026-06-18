import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Model, Types } from 'mongoose';

export type InvoiceDocument = HydratedDocument<Invoice>;
export type InvoiceModel = Model<Invoice>;

/**
 * Invoice — the second settlement-document type (methodology §7.1,
 * "Контрагент → Инвойс", the rest-of-world model). Belongs to exactly one
 * counterparty and is the unit against which payments are matched when the
 * counterparty's settlement depth resolves to `invoice`.
 *
 * Deliberately FLAT and independent of Contract: Filipp ruled the
 * invoice↔contract hierarchy out for accounting purposes. A counterparty is
 * tracked by invoices OR contracts, not a nested combination.
 *
 * Created on the bank preview screen (pick existing or create new), never
 * auto-created silently — see Contract docblock and methodology §7.2.
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
export class Invoice {
  @Prop({
    type: Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true,
  })
  organizationId!: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'Counterparty',
    required: true,
    index: true,
  })
  counterpartyId!: Types.ObjectId;

  // Invoice number — verbatim / parsed from payment purpose. Matching
  // normalizes separately.
  @Prop({ type: String, required: true, trim: true, maxlength: 200 })
  number!: string;

  // Invoice date. Optional for the same reason as Contract.date.
  @Prop({ type: Date, default: null })
  date!: Date | null;

  /**
   * Invoice amount, when known, as a Decimal128 string. Money on the ledger is
   * always Decimal128 (never a JS float) — stored via the schema's Decimal128
   * type. Null when the invoice was created from a payment that didn't state
   * the full invoice total. Currency follows the org's base / the counterparty
   * context; a dedicated currency field can be added if multi-currency
   * invoicing is needed later.
   */
  @Prop({ type: Types.Decimal128, default: null })
  amount!: Types.Decimal128 | null;

  @Prop({ type: String, default: null, trim: true, maxlength: 1000 })
  description!: string | null;

  @Prop({ type: Boolean, default: true, index: true })
  isActive!: boolean;
}

export const InvoiceSchema = SchemaFactory.createForClass(Invoice);

InvoiceSchema.index(
  { organizationId: 1, counterpartyId: 1, number: 1 },
  { unique: true },
);

InvoiceSchema.index({ organizationId: 1, counterpartyId: 1, isActive: 1 });
