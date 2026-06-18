import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Types } from 'mongoose';

import {
  normalizeDocumentNumber,
  recognizeDocumentReferences,
} from './document-recognizer';
import {
  Contract,
  type ContractModel,
} from '../schemas/contract.schema';
import {
  Invoice,
  type InvoiceModel,
} from '../schemas/invoice.schema';

export type DocumentKind = 'contract' | 'invoice';

export interface DocumentRef {
  id: string;
  kind: DocumentKind;
  number: string;
  date: Date | null;
  description: string | null;
  isActive: boolean;
}

/**
 * A suggestion for the bank preview's mandatory document field (methodology
 * §7.2). `matched` carries documents that already exist for the counterparty
 * and equal a recognized number; `recognizedUnmatched` carries numbers parsed
 * from the purpose text that have NO stored document yet (the accountant can
 * one-click create them). When both are empty the accountant picks from the
 * full list or creates manually — a payment is never posted without a
 * document (Filipp: "без документа расчета … проводить не разрешаем").
 */
export interface DocumentSuggestion {
  kind: DocumentKind;
  matched: DocumentRef[];
  recognizedUnmatched: Array<{ number: string; date: Date | null }>;
}

/**
 * Contract/Invoice registry + recognition glue (methodology §7).
 *
 * Documents are flat and counterparty-bound; a counterparty is tracked by
 * contracts OR invoices (the effective kind comes from resolveSettlementDepth
 * at the call site — this service is told which kind to work with). Records are
 * created explicitly (preview create/pick), never silently auto-created.
 */
@Injectable()
export class DocumentsService {
  constructor(
    @InjectModel(Contract.name) private readonly contractModel: ContractModel,
    @InjectModel(Invoice.name) private readonly invoiceModel: InvoiceModel,
  ) {}

  private toRef(
    doc: {
      _id: Types.ObjectId;
      number: string;
      date: Date | null;
      description: string | null;
      isActive: boolean;
    },
    kind: DocumentKind,
  ): DocumentRef {
    return {
      id: doc._id.toString(),
      kind,
      number: doc.number,
      date: doc.date ?? null,
      description: doc.description ?? null,
      isActive: doc.isActive,
    };
  }

  /** List a counterparty's documents of the given kind (active first). */
  async listForCounterparty(
    organizationId: Types.ObjectId,
    counterpartyId: Types.ObjectId,
    kind: DocumentKind,
  ): Promise<DocumentRef[]> {
    const model = kind === 'contract' ? this.contractModel : this.invoiceModel;
    const docs = await model
      .find({ organizationId, counterpartyId })
      .sort({ isActive: -1, number: 1 })
      .lean();
    return docs.map((d) => this.toRef(d, kind));
  }

  /**
   * Look up a single document by counterparty + normalized number. Returns the
   * stored doc or null. Used both for matching and to enforce create-time
   * uniqueness beyond the DB index (so the error is friendly).
   */
  async findByNumber(
    organizationId: Types.ObjectId,
    counterpartyId: Types.ObjectId,
    kind: DocumentKind,
    number: string,
  ): Promise<DocumentRef | null> {
    const model = kind === 'contract' ? this.contractModel : this.invoiceModel;
    const target = normalizeDocumentNumber(number);
    // Numbers are stored verbatim; normalize both sides for the compare. The
    // candidate set per counterparty is small, so an in-memory match is fine
    // and avoids storing a duplicate normalized column.
    const docs = await model.find({ organizationId, counterpartyId }).lean();
    const hit = docs.find((d) => normalizeDocumentNumber(d.number) === target);
    return hit ? this.toRef(hit, kind) : null;
  }

  /**
   * Suggest documents for a payment-purpose string against one counterparty.
   * Runs the (code-based, swappable) recognizer, then splits recognized
   * numbers into those that already exist (matched) and those that don't
   * (recognizedUnmatched, offered as one-click create). `kind` is the
   * counterparty's effective settlement depth, resolved by the caller.
   */
  async suggestForPurpose(
    organizationId: Types.ObjectId,
    counterpartyId: Types.ObjectId,
    kind: DocumentKind,
    purpose: string | null | undefined,
  ): Promise<DocumentSuggestion> {
    const recognized = recognizeDocumentReferences(purpose, { prefer: kind });
    const refs = recognized[kind]; // only the kind this counterparty uses

    const matched: DocumentRef[] = [];
    const recognizedUnmatched: Array<{ number: string; date: Date | null }> = [];
    for (const r of refs) {
      const existing = await this.findByNumber(
        organizationId,
        counterpartyId,
        kind,
        r.number,
      );
      if (existing) matched.push(existing);
      else recognizedUnmatched.push({ number: r.number, date: r.date });
    }
    return { kind, matched, recognizedUnmatched };
  }

  /**
   * Create a document for a counterparty (preview "create new", or CRUD).
   * Rejects a duplicate number for the same counterparty with a friendly
   * error before hitting the unique index.
   */
  async create(args: {
    organizationId: Types.ObjectId;
    counterpartyId: Types.ObjectId;
    kind: DocumentKind;
    number: string;
    date?: Date | null;
    description?: string | null;
    amount?: string | null; // invoice only; Decimal128 string
  }): Promise<DocumentRef> {
    const number = args.number.trim();
    if (!number) {
      throw new BadRequestException({
        error: 'EMPTY_DOCUMENT_NUMBER',
        message: 'Document number is required.',
      });
    }
    const dup = await this.findByNumber(
      args.organizationId,
      args.counterpartyId,
      args.kind,
      number,
    );
    if (dup) {
      throw new BadRequestException({
        error: 'DUPLICATE_DOCUMENT',
        message: `A ${args.kind} numbered ${number} already exists for this counterparty.`,
      });
    }

    if (args.kind === 'contract') {
      const created = await this.contractModel.create({
        organizationId: args.organizationId,
        counterpartyId: args.counterpartyId,
        number,
        date: args.date ?? null,
        description: args.description ?? null,
      });
      return this.toRef(created, 'contract');
    }
    const created = await this.invoiceModel.create({
      organizationId: args.organizationId,
      counterpartyId: args.counterpartyId,
      number,
      date: args.date ?? null,
      description: args.description ?? null,
      amount: args.amount ? Types.Decimal128.fromString(args.amount) : null,
    });
    return this.toRef(created, 'invoice');
  }

  /**
   * Resolve a document by id + kind, asserting it belongs to the org (and,
   * when given, the counterparty). Used by the posting path to validate the
   * document a preview row points at before committing.
   */
  async assertExists(
    organizationId: Types.ObjectId,
    kind: DocumentKind,
    documentId: Types.ObjectId,
    counterpartyId?: Types.ObjectId,
  ): Promise<DocumentRef> {
    const model = kind === 'contract' ? this.contractModel : this.invoiceModel;
    const doc = await model.findOne({ _id: documentId, organizationId }).lean();
    if (!doc) {
      throw new NotFoundException({
        error: 'DOCUMENT_NOT_FOUND',
        message: `${kind} ${documentId.toString()} not found in this organization.`,
      });
    }
    if (counterpartyId && doc.counterpartyId?.toString() !== counterpartyId.toString()) {
      throw new BadRequestException({
        error: 'DOCUMENT_COUNTERPARTY_MISMATCH',
        message: 'The selected document belongs to a different counterparty.',
      });
    }
    return this.toRef(doc, kind);
  }
}
