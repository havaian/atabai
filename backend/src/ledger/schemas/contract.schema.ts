import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Model, Types } from 'mongoose';

export type ContractDocument = HydratedDocument<Contract>;
export type ContractModel = Model<Contract>;

/**
 * Contract — one of the two settlement-document types (methodology §7.1,
 * "Контрагент → Контракт", the CIS model). A contract belongs to exactly one
 * counterparty and is the unit against which payments are matched and debt is
 * settled when the counterparty's settlement depth resolves to `contract`.
 *
 * Deliberately FLAT: no link to invoices. Filipp ruled the invoice↔contract
 * hierarchy out ("это для бухгалтера лишнее. Тут учет либо по инвойсам либо по
 * договорам"). The two document types are independent; a counterparty is
 * tracked by one or the other, never both at once.
 *
 * Records are created on the bank preview screen — either picked from existing
 * contracts or created new there (methodology §7.2 as confirmed by Filipp:
 * "если программа не находит, она на превью листе должна предложить создать
 * или выбрать из списка"). They are never auto-created silently.
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
export class Contract {
  @Prop({
    type: Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true,
  })
  organizationId!: Types.ObjectId;

  // The counterparty this contract belongs to. Counterparty is always the base
  // axis (methodology §7.1) — every document hangs off one.
  @Prop({
    type: Types.ObjectId,
    ref: 'Counterparty',
    required: true,
    index: true,
  })
  counterpartyId!: Types.ObjectId;

  // Document number as it appears in the contract / parsed from payment
  // purpose text. Stored verbatim (trimmed); matching normalizes separately.
  @Prop({ type: String, required: true, trim: true, maxlength: 200 })
  number!: string;

  // Contract date. Optional — a payment purpose may carry a number without a
  // parseable date, and the accountant can fill it later.
  @Prop({ type: Date, default: null })
  date!: Date | null;

  // Free-form description / subject of the contract (optional).
  @Prop({ type: String, default: null, trim: true, maxlength: 1000 })
  description!: string | null;

  // Soft-delete equivalent — a contract no longer transacted against is marked
  // inactive rather than removed, so historical postings keep their reference
  // (same discipline as bank accounts §3.5 and counterparties).
  @Prop({ type: Boolean, default: true, index: true })
  isActive!: boolean;
}

export const ContractSchema = SchemaFactory.createForClass(Contract);

// A counterparty's contract numbers are unique within the org+counterparty.
// Prevents the same contract being created twice from two payments.
ContractSchema.index(
  { organizationId: 1, counterpartyId: 1, number: 1 },
  { unique: true },
);

// Listing a counterparty's contracts (preview dropdown, CRUD list).
ContractSchema.index({ organizationId: 1, counterpartyId: 1, isActive: 1 });
