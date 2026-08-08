import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Types } from 'mongoose';

import { AppLoggerService } from '../../common/logger/app-logger.service';
import { addDecimals, netSides, toDecimal128, toDecimalString } from '../decimal-arithmetic';
import { AccountBalance, type AccountBalanceModel } from '../schemas/account-balance.schema';
import {
  JournalEntry,
  type JournalEntryDocument,
  type JournalEntryModel,
} from '../schemas/journal-entry.schema';
import { JournalEntryLine, type JournalEntryLineModel } from '../schemas/journal-entry-line.schema';

export interface RollupKey {
  accountCode: string;
  subconto1Value: string | null;
  subconto2Value: string | null;
  subconto3Value: string | null;
  counterpartyId: Types.ObjectId | null;
}

export interface RollupResult {
  recomputed: number;
  created: number;
  affectedKeys: RollupKey[];
}

/**
 * Materializes AccountBalance rows from the canonical posting history.
 *
 * The bank engine and the manual-entry engine both write JournalEntryLine
 * rows but those don't move balances on their own — balances are the
 * universal-currency materialized view (architecture doc §3.2). When an
 * entry flips to `committed`, we recompute every AccountBalance row whose
 * key matches one of the entry's lines.
 *
 * Algorithm per key:
 *   1. Aggregate sums of `amount` per direction across all COMMITTED
 *      JournalEntryLine rows for (org, period, accountCode, subconto1/2/3),
 *      SPLIT by the parent entry's `source` (methodology дополнение §1.5):
 *      `opening_balance` postings → `openingDebit` / `openingCredit`, all
 *      others → `periodDebit` / `periodCredit`.
 *   2. Look up the existing AccountBalance row for that key:
 *      a. Found → overwrite both opening and period columns from the fresh
 *         aggregation, recompute closing via `netSides(opening+period)`.
 *         Opening is derived, not preserved — the OSV importer is gone so
 *         postings are authoritative for both columns.
 *      b. Not found → create a fresh row from the aggregated opening + period
 *         totals. `source = 'posting_rollup'`.
 *
 * Single-layer note (architecture doc §3.2): the ledger is a general
 * ledger with one kind of figure — the real, posted balance. The old
 * four-layer matrix (nsbu_base → reclassification → adjustment → ifrs)
 * was a transformation overlay and has been removed; there is no longer
 * a `layer` dimension on the key, and no derived IFRS layer to compute.
 *
 * What the rollup does NOT do:
 *   - Hold a lock. Two concurrent rollups on the same key race; in
 *     practice the bank-engine commit is operator-driven and one-at-a-
 *     time per period. If that assumption breaks, wrap each key update
 *     in a session/transaction.
 */
@Injectable()
export class BalanceRollupService {
  constructor(
    @InjectModel(AccountBalance.name)
    private readonly balanceModel: AccountBalanceModel,
    @InjectModel(JournalEntryLine.name)
    private readonly lineModel: JournalEntryLineModel,
    @InjectModel(JournalEntry.name)
    private readonly entryModel: JournalEntryModel,
    private readonly logger: AppLoggerService,
  ) {}

  /**
   * Recompute balances for a set of explicit keys. Used by the bank engine
   * after committing a batch — the caller passes the union of line-keys
   * across the committed entries.
   */
  async rollupKeys(
    organizationId: Types.ObjectId,
    periodId: Types.ObjectId,
    keys: RollupKey[],
  ): Promise<RollupResult> {
    const uniqueKeys = this.dedupe(keys);
    let recomputed = 0;
    let created = 0;
    const now = new Date();

    for (const key of uniqueKeys) {
      const sums = await this.aggregateCommittedPostings(organizationId, periodId, key);

      const existing = await this.balanceModel.findOne({
        organizationId,
        periodId,
        accountCode: key.accountCode,
        level: 0,
        subconto1Value: key.subconto1Value,
        subconto2Value: key.subconto2Value,
        subconto3Value: key.subconto3Value,
      });

      // Opening comes from opening_balance-source postings, period from all
      // other committed postings (methodology дополнение §1.5). Closing is
      // their net. Opening is now DERIVED from postings, not preserved from a
      // prior osv_import value — the OSV importer is removed and postings are
      // ground truth, so a fresh recompute is authoritative for both columns.
      const grossDebit = addDecimals(sums.openingDebit, sums.periodDebit);
      const grossCredit = addDecimals(sums.openingCredit, sums.periodCredit);
      const closing = netSides(grossDebit, grossCredit);
      const contributed =
        sums.openingDebit !== '0' ||
        sums.openingCredit !== '0' ||
        sums.periodDebit !== '0' ||
        sums.periodCredit !== '0';

      if (existing) {
        existing.openingDebit = toDecimal128(sums.openingDebit);
        existing.openingCredit = toDecimal128(sums.openingCredit);
        existing.periodDebit = toDecimal128(sums.periodDebit);
        existing.periodCredit = toDecimal128(sums.periodCredit);
        existing.closingDebit = toDecimal128(closing.closingDebit);
        existing.closingCredit = toDecimal128(closing.closingCredit);
        existing.recomputedAt = now;
        // Source flips to 'posting_rollup' only when this rollup actually
        // contributed figures. A pre-existing osv_import row with zero
        // matching postings stays labelled osv_import so the audit trail
        // preserves the import-derived provenance.
        if (contributed) {
          existing.source = 'posting_rollup';
        }
        await existing.save();
        recomputed++;
      } else {
        await this.balanceModel.create({
          organizationId,
          periodId,
          accountCode: key.accountCode,
          level: 0,
          subconto1Value: key.subconto1Value,
          subconto2Value: key.subconto2Value,
          subconto3Value: key.subconto3Value,
          counterpartyId: key.counterpartyId,
          openingDebit: toDecimal128(sums.openingDebit),
          openingCredit: toDecimal128(sums.openingCredit),
          periodDebit: toDecimal128(sums.periodDebit),
          periodCredit: toDecimal128(sums.periodCredit),
          closingDebit: toDecimal128(closing.closingDebit),
          closingCredit: toDecimal128(closing.closingCredit),
          currency: null,
          quantity: null,
          source: 'posting_rollup',
          recomputedAt: now,
        });
        created++;
      }
    }

    if (uniqueKeys.length > 0) {
      this.logger.logAction('ledger.balance.rolled_up', {
        orgId: organizationId.toString(),
        periodId: periodId.toString(),
        recomputed,
        created,
        affectedKeys: uniqueKeys.length,
      });
    }

    return { recomputed, created, affectedKeys: uniqueKeys };
  }

  /**
   * Convenience for the common case: roll up balances affected by a list of
   * just-committed journal entries.
   */
  async rollupForEntries(entries: JournalEntryDocument[]): Promise<RollupResult> {
    if (entries.length === 0) {
      return { recomputed: 0, created: 0, affectedKeys: [] };
    }
    const organizationId = entries[0].organizationId;
    const periodId = entries[0].periodId;
    const entryIds = entries.map((e) => e._id);

    const lines = await this.lineModel
      .find({ entryId: { $in: entryIds } })
      .select('accountCode subconto1Value subconto2Value subconto3Value counterpartyId')
      .lean();

    const keys: RollupKey[] = lines.map((l) => ({
      accountCode: l.accountCode,
      subconto1Value: l.subconto1Value,
      subconto2Value: l.subconto2Value,
      subconto3Value: l.subconto3Value,
      counterpartyId: l.counterpartyId,
    }));

    return this.rollupKeys(organizationId, periodId, keys);
  }

  // ─── Internal ─────────────────────────────────────────────────────────────

  private async aggregateCommittedPostings(
    organizationId: Types.ObjectId,
    periodId: Types.ObjectId,
    key: RollupKey,
  ): Promise<{
    openingDebit: string;
    openingCredit: string;
    periodDebit: string;
    periodCredit: string;
  }> {
    // Two-step: collect committed entry ids first, then sum lines. Sumtotal
    // pipelines that $lookup into the entries collection are doable but
    // less flexible (and the entry list is usually small).
    //
    // Split by JournalEntry.source (methodology дополнение §1.5): postings
    // seeded by «ввод начальных остатков» (source='opening_balance', §6.2)
    // are the OPENING position; everything else is period turnover. Without
    // this split the opening postings leaked into turnover and the opening
    // columns stayed zero.
    const committed = await this.entryModel
      .find({
        organizationId,
        periodId,
        status: 'committed',
      })
      .select('_id source')
      .lean();

    const openingIds = committed
      .filter((e) => e.source === 'opening_balance')
      .map((e) => e._id);
    const turnoverIds = committed
      .filter((e) => e.source !== 'opening_balance')
      .map((e) => e._id);

    const opening = await this.sumLinesByDirection(
      organizationId,
      periodId,
      key,
      openingIds,
    );
    const period = await this.sumLinesByDirection(
      organizationId,
      periodId,
      key,
      turnoverIds,
    );

    return {
      openingDebit: opening.debit,
      openingCredit: opening.credit,
      periodDebit: period.debit,
      periodCredit: period.credit,
    };
  }

  /**
   * Sum committed JournalEntryLine `amount` per direction for one balance key,
   * restricted to a given set of entry ids. Returns '0'/'0' for an empty id
   * set so the caller can treat "no opening postings" as a zero opening.
   */
  private async sumLinesByDirection(
    organizationId: Types.ObjectId,
    periodId: Types.ObjectId,
    key: RollupKey,
    entryIds: Types.ObjectId[],
  ): Promise<{ debit: string; credit: string }> {
    if (entryIds.length === 0) {
      return { debit: '0', credit: '0' };
    }

    const agg = await this.lineModel.aggregate<{
      _id: 'debit' | 'credit';
      total: Types.Decimal128;
    }>([
      {
        $match: {
          organizationId,
          periodId,
          accountCode: key.accountCode,
          subconto1Value: key.subconto1Value,
          subconto2Value: key.subconto2Value,
          subconto3Value: key.subconto3Value,
          entryId: { $in: entryIds },
        },
      },
      { $group: { _id: '$direction', total: { $sum: '$amount' } } },
    ]);

    const debit = agg.find((g) => g._id === 'debit')?.total;
    const credit = agg.find((g) => g._id === 'credit')?.total;
    return {
      debit: toDecimalString(debit),
      credit: toDecimalString(credit),
    };
  }

  private dedupe(keys: RollupKey[]): RollupKey[] {
    const seen = new Set<string>();
    const out: RollupKey[] = [];
    for (const k of keys) {
      const sig = [
        k.accountCode,
        k.subconto1Value ?? '',
        k.subconto2Value ?? '',
        k.subconto3Value ?? '',
      ].join('|');
      if (seen.has(sig)) continue;
      seen.add(sig);
      out.push(k);
    }
    return out;
  }
}
