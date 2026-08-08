import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Types } from 'mongoose';

import { AppLoggerService } from '../../common/logger/app-logger.service';
import type { UserDocument } from '../../users/schemas/user.schema';
import {
  addDecimals,
  compareDecimals,
  negateDecimal,
  subtractDecimals,
  toDecimal128,
} from '../decimal-arithmetic';
import {
  OPENING_BALANCE_OFFSET_ACCOUNT,
  isOpeningBalanceAccount,
  openingLegDirection,
  type OpeningBalanceAccount,
} from '../constants/opening-balance';
import { DocumentsService, type DocumentKind } from '../documents/documents.service';
import { Counterparty, type CounterpartyModel } from '../schemas/counterparty.schema';
import { JournalEntry, type JournalEntryModel } from '../schemas/journal-entry.schema';
import {
  JournalEntryLine,
  type JournalEntryLineModel,
} from '../schemas/journal-entry-line.schema';
import { BalanceRollupService } from '../services/balance-rollup.service';
import { PeriodsService } from '../services/periods.service';
import type { CreateOpeningBalancesDto } from './dto/create-opening-balances.dto';

export interface OpeningBalancesResult {
  entryId: string;
  itemsPosted: number;
  offsetAccount: string;
  offsetDebit: string;
  offsetCredit: string;
  totalAmount: string;
  rolledUpKeys: number;
}

export interface OpeningBalanceLineView {
  accountCode: string;
  direction: 'debit' | 'credit';
  amount: string;
  counterpartyId: string | null;
  documentType: 'contract' | 'invoice' | null;
  documentId: string | null;
  description: string;
}

export interface OpeningBalanceEntryView {
  id: string;
  date: Date;
  description: string;
  totalAmount: string;
  items: OpeningBalanceLineView[];
}

/**
 * Opening-balance entry (methodology §6.2 — «ввод начальных остатков»).
 *
 * A company migrating onto ATABAI brings incoming counterparty balances. Filipp
 * confirmed (02.07.26) each is entered PER DOCUMENT (one open contract/invoice,
 * with its amount) because settlement is strict per document (§6.3): a later
 * payment gashes the exact document it was made against, so an opening debt
 * needs its document to be settleable.
 *
 * Recording model — WHY journal-entry lines, not a direct balance seed:
 *   - Per-document settlement (getDocumentPosition / RunningBalanceService)
 *     reads JournalEntryLine rows narrowed on (counterparty, documentType,
 *     documentId). AccountBalance is keyed per counterparty with no document
 *     dimension, so a balance seed could not be settled per document.
 *   - So each opening balance is posted as a line carrying counterparty +
 *     documentType/documentId on the debt/advance account (4010/4310/6010/6310),
 *     and the batch balances against the auxiliary account 0000. A later bank
 *     payment on the same documentId then nets against the opening debt with no
 *     double counting.
 *
 * The entry is created directly as `committed` (there is no account-picking
 * gate — the accounts are fixed by the position), then the same rollup the bank
 * and invoice engines use materializes the affected AccountBalance rows.
 *
 * Opening-vs-period presentation split: handled in BalanceRollupService, which
 * routes `opening_balance`-source postings into the AccountBalance opening
 * columns and everything else into period turnover (methodology дополнение
 * §1.5). This service just posts the entries with source='opening_balance';
 * the rollup does the column routing.
 */
@Injectable()
export class OpeningBalancesService {
  constructor(
    @InjectModel(JournalEntry.name)
    private readonly entryModel: JournalEntryModel,
    @InjectModel(JournalEntryLine.name)
    private readonly lineModel: JournalEntryLineModel,
    @InjectModel(Counterparty.name)
    private readonly counterpartyModel: CounterpartyModel,
    private readonly balanceRollup: BalanceRollupService,
    private readonly periods: PeriodsService,
    private readonly documents: DocumentsService,
    private readonly logger: AppLoggerService,
  ) {}

  async createOpeningBalances(args: {
    organizationId: Types.ObjectId;
    periodId: Types.ObjectId;
    dto: CreateOpeningBalancesDto;
    actor: UserDocument;
  }): Promise<OpeningBalancesResult> {
    const { organizationId: orgId, periodId, dto, actor } = args;

    // Period must exist and be open (throws PERIOD_LOCKED / not-found otherwise).
    // Also gives us the default entry date (the period's start).
    const period = await this.periods.assertWritable(orgId, periodId);

    const items = dto.items ?? [];
    if (items.length === 0) {
      throw new BadRequestException({
        error: 'NO_OPENING_ITEMS',
        message: 'At least one opening-balance item is required.',
      });
    }

    // Guard a fat-fingered duplicate WITHIN this payload: the same (counterparty,
    // account, document) twice would double the opening balance. documentId or
    // the trimmed documentNumber identifies the document within the batch.
    const seen = new Set<string>();
    for (const item of items) {
      const docKey = item.documentId ?? `#${(item.documentNumber ?? '').trim().toLowerCase()}`;
      const sig = [item.counterpartyId, item.account, item.documentType, docKey].join('|');
      if (seen.has(sig)) {
        throw new BadRequestException({
          error: 'DUPLICATE_OPENING_ITEM',
          message:
            'The same counterparty + account + document appears more than once in this batch.',
        });
      }
      seen.add(sig);
    }

    const date = dto.asOfDate ? new Date(dto.asOfDate) : period.startDate;

    // Build the counterparty legs, accumulating debit/credit sums so the single
    // balancing leg on 0000 can absorb the net.
    const lines: Array<Record<string, unknown>> = [];
    let debitSum = '0';
    let creditSum = '0';

    for (const item of items) {
      if (compareDecimals(item.amount, '0') <= 0) {
        throw new BadRequestException({
          error: 'NON_POSITIVE_OPENING_AMOUNT',
          message: `Opening amount must be greater than zero (got ${item.amount}).`,
        });
      }
      // Defensive — the DTO already restricts account to the four codes.
      if (!isOpeningBalanceAccount(item.account)) {
        throw new BadRequestException({
          error: 'INVALID_OPENING_ACCOUNT',
          message: `Account ${item.account} is not a valid opening-balance account.`,
        });
      }
      const account: OpeningBalanceAccount = item.account;
      const counterpartyId = new Types.ObjectId(item.counterpartyId);

      const cp = await this.counterpartyModel
        .findOne({ _id: counterpartyId, organizationId: orgId })
        .lean();
      if (!cp) {
        throw new NotFoundException({
          error: 'COUNTERPARTY_NOT_FOUND',
          message: `Counterparty ${item.counterpartyId} not found in this organization.`,
        });
      }

      // Resolve the document: an existing one (validated to belong to the org +
      // counterparty), or create it from a number (also the dummy fallback).
      const kind: DocumentKind = item.documentType;
      let documentId: Types.ObjectId;
      if (item.documentId) {
        const ref = await this.documents.assertExists(
          orgId,
          kind,
          new Types.ObjectId(item.documentId),
          counterpartyId,
        );
        documentId = new Types.ObjectId(ref.id);
      } else if (item.documentNumber && item.documentNumber.trim()) {
        const { ref } = await this.documents.findOrCreate({
          organizationId: orgId,
          counterpartyId,
          kind,
          number: item.documentNumber.trim(),
          date: item.documentDate ? new Date(item.documentDate) : null,
          // amount is invoice-only on the document; the opening figure lives on
          // the ledger line, not the document, so leave it null.
        });
        documentId = new Types.ObjectId(ref.id);
      } else {
        throw new BadRequestException({
          error: 'DOCUMENT_REQUIRED',
          message:
            'Each opening balance needs a document: pass documentId, or documentNumber to create one. Settlement is per document, so an opening debt cannot be documentless.',
        });
      }

      const direction = openingLegDirection(account);
      if (direction === 'debit') {
        debitSum = addDecimals(debitSum, item.amount);
      } else {
        creditSum = addDecimals(creditSum, item.amount);
      }

      lines.push({
        organizationId: orgId,
        periodId,
        date,
        accountCode: account,
        direction,
        amount: toDecimal128(item.amount),
        counterpartyId,
        subconto1Value: counterpartyId.toString(),
        documentType: kind,
        documentId,
        description: (item.description ?? '').trim(),
      });
    }

    // Balancing leg on the auxiliary account 0000 for the net of the counterparty
    // legs, so the batch is a valid double-entry. No counterparty / no document.
    const net = subtractDecimals(debitSum, creditSum); // debit - credit
    const cmp = compareDecimals(net, '0');
    let offsetDebit = '0';
    let offsetCredit = '0';
    if (cmp > 0) {
      // More debits than credits → the offset sits on the credit side.
      offsetCredit = net;
      lines.push({
        organizationId: orgId,
        periodId,
        date,
        accountCode: OPENING_BALANCE_OFFSET_ACCOUNT,
        direction: 'credit',
        amount: toDecimal128(net),
        counterpartyId: null,
        subconto1Value: null,
        documentType: null,
        documentId: null,
        description: 'Opening-balance offset',
      });
      creditSum = addDecimals(creditSum, net);
    } else if (cmp < 0) {
      const abs = negateDecimal(net); // |net|
      offsetDebit = abs;
      lines.push({
        organizationId: orgId,
        periodId,
        date,
        accountCode: OPENING_BALANCE_OFFSET_ACCOUNT,
        direction: 'debit',
        amount: toDecimal128(abs),
        counterpartyId: null,
        subconto1Value: null,
        documentType: null,
        documentId: null,
        description: 'Opening-balance offset',
      });
      debitSum = addDecimals(debitSum, abs);
    }

    // Hard balance gate — an imbalanced entry must never persist.
    if (compareDecimals(debitSum, creditSum) !== 0) {
      throw new BadRequestException({
        error: 'OPENING_ENTRY_IMBALANCED',
        message: `Opening-balance entry does not balance (Dt ${debitSum} vs Cr ${creditSum}).`,
      });
    }

    const now = new Date();
    const entry = await this.entryModel.create({
      organizationId: orgId,
      periodId,
      date,
      description: (dto.description ?? 'Ввод начальных остатков').substring(0, 1990),
      source: 'opening_balance',
      sourceRef: `opening:${now.getTime()}`,
      status: 'committed',
      totalAmount: toDecimal128(debitSum),
      createdBy: actor._id,
      committedAt: now,
      committedBy: actor._id,
    });

    // Stamp the entryId onto every line, then persist.
    for (const line of lines) {
      line.entryId = entry._id;
    }
    await this.lineModel.create(lines);

    // Materialize the affected AccountBalance rows — the same rollup the bank
    // and invoice engines use. rollupForEntries reads the lines by entryId (now
    // written) and recomputes each touched key.
    const rollup = await this.balanceRollup.rollupForEntries([entry]);

    this.logger.logAction('ledger.opening_balance.posted', {
      orgId: orgId.toString(),
      periodId: periodId.toString(),
      actor: actor._id.toString(),
      entryId: entry._id.toString(),
      itemsPosted: items.length,
      rolledUpKeys: rollup.affectedKeys.length,
    });

    return {
      entryId: entry._id.toString(),
      itemsPosted: items.length,
      offsetAccount: OPENING_BALANCE_OFFSET_ACCOUNT,
      offsetDebit,
      offsetCredit,
      totalAmount: debitSum,
      rolledUpKeys: rollup.affectedKeys.length,
    };
  }

  /**
   * List the opening-balance entries already posted in a period, each with its
   * counterparty legs (the 0000 offset leg is omitted — it is bookkeeping
   * plumbing, not something the operator entered). Lets the onboarding UI show
   * what has been entered so far.
   */
  async listOpeningBalances(
    organizationId: Types.ObjectId,
    periodId: Types.ObjectId,
  ): Promise<{ entries: OpeningBalanceEntryView[] }> {
    const entries = await this.entryModel
      .find({ organizationId, periodId, source: 'opening_balance' })
      .sort({ date: -1 })
      .lean();

    const out: OpeningBalanceEntryView[] = [];
    for (const entry of entries) {
      const lines = await this.lineModel
        .find({
          entryId: entry._id,
          accountCode: { $ne: OPENING_BALANCE_OFFSET_ACCOUNT },
        })
        .lean();
      out.push({
        id: entry._id.toString(),
        date: entry.date,
        description: entry.description,
        totalAmount: entry.totalAmount.toString(),
        items: lines.map((l) => ({
          accountCode: l.accountCode,
          direction: l.direction,
          amount: l.amount.toString(),
          counterpartyId: l.counterpartyId?.toString() ?? null,
          documentType: l.documentType,
          documentId: l.documentId?.toString() ?? null,
          description: l.description,
        })),
      });
    }
    return { entries: out };
  }
}
