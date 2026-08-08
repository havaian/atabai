import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {
  HydratedDocument,
  Model,
  Schema as MongooseSchema,
  Types,
} from 'mongoose';

import {
  ALL_INVOICE_DIRECTIONS,
  ALL_INVOICE_SUBTYPES,
  type InvoiceDirection,
  type InvoiceSubtype,
} from '../constants/invoice';

export type InvoiceDocument = HydratedDocument<Invoice>;
export type InvoiceModel = Model<Invoice>;

/**
 * One line of a Didox invoice (methodology §7.3). Captured verbatim from the
 * registry so the operator-account picker and the future ИКПУ directory (phase
 * 5) have the per-line detail. Amounts are Decimal128 - money on the ledger is
 * never a JS float. `vatRate` is the ONLY non-money numeric here: a plain
 * percent (e.g. 12), null on a 0 %/exempt line.
 *
 * Sub-document only - no `_id`: nothing references a line item by id (the
 * operator sets accounts on the JournalEntryLine legs, not here).
 */
@Schema({ _id: false })
export class InvoiceLineItem {
  // ИКПУ (МХИК) product/service classifier code + its human name.
  @Prop({ type: String, default: null, trim: true, maxlength: 60 })
  ikpuCode!: string | null;

  @Prop({ type: String, default: null, trim: true, maxlength: 1000 })
  ikpuName!: string | null;

  @Prop({ type: MongooseSchema.Types.Decimal128, default: null })
  quantity!: Types.Decimal128 | null;

  @Prop({ type: MongooseSchema.Types.Decimal128, default: null })
  price!: Types.Decimal128 | null;

  // Net (pre-VAT) line amount. Always present on a parsed line; defaulted to 0
  // so a subdoc never fails validation.
  @Prop({
    type: MongooseSchema.Types.Decimal128,
    required: true,
    default: () => Types.Decimal128.fromString('0'),
  })
  netAmount!: Types.Decimal128;

  // VAT percent (e.g. 12), NOT a money value. Null on a 0 %/exempt line.
  @Prop({ type: Number, default: null })
  vatRate!: number | null;

  @Prop({
    type: MongooseSchema.Types.Decimal128,
    required: true,
    default: () => Types.Decimal128.fromString('0'),
  })
  vatAmount!: Types.Decimal128;

  @Prop({
    type: MongooseSchema.Types.Decimal128,
    required: true,
    default: () => Types.Decimal128.fromString('0'),
  })
  grossAmount!: Types.Decimal128;
}
export const InvoiceLineItemSchema = SchemaFactory.createForClass(InvoiceLineItem);

/**
 * Invoice - the second settlement-document type (methodology §7.1,
 * «Контрагент → Инвойс», the rest-of-world model). Belongs to exactly one
 * counterparty and is the unit against which payments are matched when the
 * counterparty's settlement depth resolves to `invoice`.
 *
 * Deliberately FLAT and independent of Contract: Filipp ruled the
 * invoice↔contract hierarchy out for accounting purposes. A counterparty is
 * tracked by invoices OR contracts, not a nested combination.
 *
 * TWO creation paths, which is why every registry field below is optional:
 *   - Settlement-document stub - DocumentsService.create (bank preview «create
 *     new», or CRUD). Writes only number/date/description/amount; the Didox
 *     fields stay null/empty.
 *   - Full registry invoice - InvoiceIngestionService, one per «Подписан» row
 *     of a Didox Входящие/Исходящие export. Writes the direction, subtype,
 *     Didox ids, contract columns, line items and the net/VAT/gross totals, and
 *     (after posting) links `journalEntryId`.
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

  // The counterparty this invoice belongs to. Counterparty is always the base
  // axis (methodology §7.1) - every document hangs off one.
  @Prop({
    type: Types.ObjectId,
    ref: 'Counterparty',
    required: true,
    index: true,
  })
  counterpartyId!: Types.ObjectId;

  // Invoice number - verbatim / parsed from the registry (or payment purpose).
  // Matching normalizes separately.
  @Prop({ type: String, required: true, trim: true, maxlength: 200 })
  number!: string;

  // Invoice date (СФ date). Optional - a stub created from a payment may carry
  // a number without a parseable date, filled later.
  @Prop({ type: Date, default: null })
  date!: Date | null;

  /**
   * Invoice gross amount as a Decimal128 (never a JS float). For a registry
   * invoice this mirrors `grossTotal`; for a stub it may be the payment-stated
   * total or null. Currency follows the org's base currency.
   */
  @Prop({ type: MongooseSchema.Types.Decimal128, default: null })
  amount!: Types.Decimal128 | null;

  @Prop({ type: String, default: null, trim: true, maxlength: 1000 })
  description!: string | null;

  // ─── Didox registry fields (null on a settlement-document stub) ─────────────

  // Which registry file this came from - incoming (Входящие, we buy) or
  // outgoing (Исходящие, we sell). Drives the posting template (§7.3).
  @Prop({
    type: String,
    enum: ALL_INVOICE_DIRECTIONS,
    default: null,
    index: true,
  })
  direction!: InvoiceDirection | null;

  // standard / additional / corrected (§7.5). Null on a non-registry stub.
  @Prop({ type: String, enum: ALL_INVOICE_SUBTYPES, default: null })
  subtype!: InvoiceSubtype | null;

  // Registry document status verbatim (e.g. «Подписан»). Free text - only
  // «Подписан» rows are loaded, the rest are counted by the parser.
  @Prop({ type: String, default: null, trim: true, maxlength: 100 })
  documentStatus!: string | null;

  // Didox's own identifiers. `didoxId` is how a corrected/additional invoice
  // finds its original (its `oldInvoiceDidoxId` points at the original's
  // `didoxId`). `roumingId` is the Roaming (E-Faktura) id, kept for provenance.
  @Prop({ type: String, default: null, trim: true, maxlength: 200 })
  didoxId!: string | null;

  @Prop({ type: String, default: null, trim: true, maxlength: 200 })
  roumingId!: string | null;

  // The Didox id of the invoice THIS one corrects/supplements (§7.5). Null on a
  // standard invoice.
  @Prop({ type: String, default: null, trim: true, maxlength: 200 })
  oldInvoiceDidoxId!: string | null;

  // Contract columns off the registry - auto-linked to a Contract (§7.6). The
  // raw number/date are kept even when the Contract row is created separately.
  @Prop({ type: String, default: null, trim: true, maxlength: 200 })
  contractNumber!: string | null;

  @Prop({ type: Date, default: null })
  contractDate!: Date | null;

  @Prop({ type: Types.ObjectId, ref: 'Contract', default: null })
  contractId!: Types.ObjectId | null;

  // ─── Line items + totals (registry only) ────────────────────────────────────

  @Prop({ type: [InvoiceLineItemSchema], default: [] })
  lineItems!: InvoiceLineItem[];

  // Totals summed from the line items (never the registry's own total cell), so
  // the posting balances by construction. Null on a stub with no line items.
  @Prop({ type: MongooseSchema.Types.Decimal128, default: null })
  netTotal!: Types.Decimal128 | null;

  @Prop({ type: MongooseSchema.Types.Decimal128, default: null })
  vatTotal!: Types.Decimal128 | null;

  @Prop({ type: MongooseSchema.Types.Decimal128, default: null })
  grossTotal!: Types.Decimal128 | null;

  // ─── Provenance + posting link ──────────────────────────────────────────────

  // The upload batch this invoice was ingested in (uuid), mirroring the
  // uploadId embedded in each posting's sourceRef.
  @Prop({ type: String, default: null, trim: true })
  sourceUploadId!: string | null;

  /**
   * The JournalEntry this invoice posted to (phase 4). Lets a corrected /
   * additional invoice find the original's entry to reverse/repost, and lets
   * the preview read the subtype back per entry. Null until the invoice is
   * posted (a stub never posts).
   */
  @Prop({ type: Types.ObjectId, ref: 'JournalEntry', default: null, index: true })
  journalEntryId!: Types.ObjectId | null;

  // Soft-delete equivalent - an invoice no longer transacted against is marked
  // inactive rather than removed, so historical postings keep their reference
  // (same discipline as contracts §7 and bank accounts §3.5).
  @Prop({ type: Boolean, default: true, index: true })
  isActive!: boolean;
}

export const InvoiceSchema = SchemaFactory.createForClass(Invoice);

// A counterparty's invoice numbers are unique within the org+counterparty -
// prevents the same invoice being created twice (from a re-upload or a payment
// that names it). Corrected/additional invoices carry their own distinct
// numbers, so this does not collide with them.
InvoiceSchema.index(
  { organizationId: 1, counterpartyId: 1, number: 1 },
  { unique: true },
);

// Listing a counterparty's invoices (preview dropdown, CRUD list).
InvoiceSchema.index({ organizationId: 1, counterpartyId: 1, isActive: 1 });

// Corrected/additional lookup: find the original by its Didox id within the org
// (InvoiceIngestionService.ingestOneInvoice). Non-unique - stubs carry a null
// didoxId, and only real registry invoices set it.
InvoiceSchema.index({ organizationId: 1, didoxId: 1 });

// Preview: read the subtype/link for a batch's entries
// (listDraftsForUpload finds invoices by their journalEntryId). Non-unique -
// null until posted.
InvoiceSchema.index({ organizationId: 1, journalEntryId: 1 });
