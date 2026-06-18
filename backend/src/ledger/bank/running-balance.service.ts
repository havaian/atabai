import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Types } from 'mongoose';

import {
  addDecimals,
  compareDecimals,
  subtractDecimals,
  toDecimalString,
} from '../decimal-arithmetic';
import {
  AccountBalance,
  type AccountBalanceModel,
} from '../schemas/account-balance.schema';
import {
  JournalEntryLine,
  type JournalEntryLineModel,
} from '../schemas/journal-entry-line.schema';
import {
  JournalEntry,
  type JournalEntryModel,
} from '../schemas/journal-entry.schema';

export interface RunningBalanceArgs {
  organizationId: Types.ObjectId;
  periodId: Types.ObjectId;
  accountCode: string;
  counterpartyId: Types.ObjectId;
}

/**
 * Document-scoped position lookup args (methodology §6.3). Sums BOTH accounts
 * of a counterparty position (e.g. payable 6010 + advance 4310) for ONE
 * document, since Filipp ruled settlement is strict per document: "да, строго
 * по тому документу по которому платеж/операция". The net across the two
 * accounts for that single document decides whether an incoming/outgoing
 * payment settles an open debt or lands as an advance.
 */
export interface DocumentPositionArgs {
  organizationId: Types.ObjectId;
  periodId: Types.ObjectId;
  counterpartyId: Types.ObjectId;
  /** The two accounts of the position, e.g. [6010, 4310] or [4010, 6310]. */
  accountCodes: [string, string];
  documentType: 'contract' | 'invoice';
  documentId: Types.ObjectId;
}

export interface RunningBalanceResult {
  /** Net amount on the debit side (positive). */
  debit: string;
  /** Net amount on the credit side (positive). */
  credit: string;
  /**
   * Net signed balance — debit-natural for active accounts, credit-natural
   * for passive ones. Positive = the natural side carries that much.
   * Caller decides how to interpret given the account's Вид.
   */
  net: string;
}

/**
 * Computes the running balance for one (counterparty, account, period) tuple
 * at the moment of the query.
 *
 * Two contributors:
 *   - The existing AccountBalance row for that key (opening + period totals
 *     materialized by the rollup).
 *   - All COMMITTED JournalEntryLine rows for that key in this period.
 *
 * Draft entries are deliberately excluded — the bank engine processes a
 * statement row by row and creates drafts as it goes. Including drafts in
 * its own running-balance lookup would mean each new row sees the postings
 * of the prior rows in the same batch, which is wrong: the algorithm
 * (bank ТЗ §6) refers to the balance "before the statement is posted."
 *
 * Returns the result as decimal strings — never JS numbers. Same precision
 * discipline as elsewhere on the ledger spine; arithmetic that needs more
 * than this read-only summing should use a Decimal library at the call site.
 */
@Injectable()
export class RunningBalanceService {
  constructor(
    @InjectModel(AccountBalance.name)
    private readonly balanceModel: AccountBalanceModel,
    @InjectModel(JournalEntryLine.name)
    private readonly lineModel: JournalEntryLineModel,
    @InjectModel(JournalEntry.name)
    private readonly entryModel: JournalEntryModel,
  ) {}

  async getBalance(args: RunningBalanceArgs): Promise<RunningBalanceResult> {
    // 1. Existing opening + period values from the materialized balance row.
    //    Aggregated across all subconto slots for this counterparty — the bank
    //    engine treats the counterparty as the primary subconto.
    const importedAgg = await this.balanceModel.aggregate<{
      _id: null;
      openingDebit: Types.Decimal128;
      openingCredit: Types.Decimal128;
      periodDebit: Types.Decimal128;
      periodCredit: Types.Decimal128;
    }>([
      {
        $match: {
          organizationId: args.organizationId,
          periodId: args.periodId,
          accountCode: args.accountCode,
          counterpartyId: args.counterpartyId,
        },
      },
      {
        $group: {
          _id: null,
          openingDebit: { $sum: '$openingDebit' },
          openingCredit: { $sum: '$openingCredit' },
          periodDebit: { $sum: '$periodDebit' },
          periodCredit: { $sum: '$periodCredit' },
        },
      },
    ]);
    const imported = importedAgg[0];

    // 2. Postings landed on this key from COMMITTED journal entries only.
    //    Drafts in flight don't count — see service docblock.
    const committedEntries = await this.entryModel
      .find({
        organizationId: args.organizationId,
        periodId: args.periodId,
        status: 'committed',
      })
      .select('_id')
      .lean();
    const committedEntryIds = committedEntries.map((e) => e._id);

    const postingAgg = await this.lineModel.aggregate<{
      _id: 'debit' | 'credit';
      total: Types.Decimal128;
    }>([
      {
        $match: {
          organizationId: args.organizationId,
          periodId: args.periodId,
          accountCode: args.accountCode,
          counterpartyId: args.counterpartyId,
          entryId: { $in: committedEntryIds },
        },
      },
      {
        $group: { _id: '$direction', total: { $sum: '$amount' } },
      },
    ]);
    const postingsDebit = postingAgg.find((g) => g._id === 'debit')?.total;
    const postingsCredit = postingAgg.find((g) => g._id === 'credit')?.total;

    const debitTotal = addDecimals(
      imported?.openingDebit,
      imported?.periodDebit,
      postingsDebit,
    );
    const creditTotal = addDecimals(
      imported?.openingCredit,
      imported?.periodCredit,
      postingsCredit,
    );

    return {
      debit: debitTotal,
      credit: creditTotal,
      net: subtractDecimals(debitTotal, creditTotal),
    };
  }

  /**
   * Convenience: "does this counterparty have an open payable on this
   * payable-side account?" Returns true if running credit exceeds running
   * debit (i.e. we owe). For Scenario A in bank ТЗ §6.
   */
  async hasOpenPayable(args: RunningBalanceArgs): Promise<boolean> {
    const bal = await this.getBalance(args);
    return compareDecimals(bal.credit, bal.debit) > 0;
  }

  /**
   * "Does this counterparty have an open receivable?" — true if running
   * debit exceeds running credit. For Scenario B in bank ТЗ §6.
   */
  async hasOpenReceivable(args: RunningBalanceArgs): Promise<boolean> {
    const bal = await this.getBalance(args);
    return compareDecimals(bal.debit, bal.credit) > 0;
  }

  /**
   * Combined position across BOTH accounts of a counterparty position for ONE
   * document (methodology §6.3). Sums committed postings on the two accounts
   * (e.g. payable + advance) filtered to a single (counterparty, document),
   * plus the materialized balance rows for the same key. Returns net debit /
   * credit as decimal strings.
   *
   * Drafts are excluded for the same reason as getBalance — the engine must
   * read the position "before the statement is posted".
   *
   * Note: this narrows on documentType+documentId, so only postings already
   * tagged with that document count. A brand-new document therefore starts at
   * a zero position (no debt, no advance), which is the correct behavior for
   * Filipp's per-document rule — a payment against a new document lands as an
   * advance unless that document already carries an opposing balance.
   */
  async getDocumentPosition(args: DocumentPositionArgs): Promise<RunningBalanceResult> {
    const { organizationId, periodId, counterpartyId, accountCodes, documentType, documentId } =
      args;

    // NOTE: AccountBalance is materialized at (account, subconto) grain and does
    // NOT carry documentType/documentId, so a document-scoped position cannot
    // read opening/period totals from it. We therefore sum COMMITTED LINES only
    // — which is authoritative for the in-period bank flow: every posting that
    // touches a document is a line tagged with it. Document-level OPENING
    // balances (carried across periods) would require the rollup to group by
    // document too; that is deferred and belongs with the §7.3 depth-migration
    // work, out of this pass's scope. For a new document the position is zero,
    // which is the correct per-document behavior (Filipp §6.3).
    const committedEntries = await this.entryModel
      .find({ organizationId, periodId, status: 'committed' })
      .select('_id')
      .lean();
    const committedEntryIds = committedEntries.map((e) => e._id);

    const postingAgg = await this.lineModel.aggregate<{
      _id: 'debit' | 'credit';
      total: Types.Decimal128;
    }>([
      {
        $match: {
          organizationId,
          periodId,
          counterpartyId,
          accountCode: { $in: accountCodes },
          documentType,
          documentId,
          entryId: { $in: committedEntryIds },
        },
      },
      { $group: { _id: '$direction', total: { $sum: '$amount' } } },
    ]);
    const postingsDebit = postingAgg.find((g) => g._id === 'debit')?.total;
    const postingsCredit = postingAgg.find((g) => g._id === 'credit')?.total;

    const debitTotal = addDecimals(postingsDebit);
    const creditTotal = addDecimals(postingsCredit);

    return {
      debit: debitTotal,
      credit: creditTotal,
      net: subtractDecimals(debitTotal, creditTotal),
    };
  }
}
