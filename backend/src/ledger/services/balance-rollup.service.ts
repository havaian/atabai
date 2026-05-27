import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Types } from 'mongoose';

import { AppLoggerService } from '../../common/logger/app-logger.service';
import {
  addDecimals,
  netSides,
  toDecimal128,
  toDecimalString,
} from '../decimal-arithmetic';
import {
  AccountBalance,
  type AccountBalanceModel,
} from '../schemas/account-balance.schema';
import {
  JournalEntry,
  type JournalEntryDocument,
  type JournalEntryModel,
} from '../schemas/journal-entry.schema';
import {
  JournalEntryLine,
  type JournalEntryLineModel,
} from '../schemas/journal-entry-line.schema';

export interface RollupKey {
  accountCode: string;
  layer: string;
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
 * The bank engine and adjustment engine both write JournalEntryLine rows
 * but those don't move balances on their own — balances are the
 * universal-currency materialized view (architecture doc §7.1). When an
 * entry flips to `committed`, we recompute every AccountBalance row whose
 * key matches one of the entry's lines.
 *
 * Algorithm per key:
 *   1. Aggregate sums of `amount` per direction across all COMMITTED
 *      JournalEntryLine rows for (org, period, layer, accountCode,
 *      subconto1/2/3) — yields `periodDebit`, `periodCredit`.
 *   2. Look up the existing AccountBalance row for that key:
 *      a. Found → preserve its imported `openingDebit` / `openingCredit`,
 *         replace `periodDebit` / `periodCredit` with the new sums,
 *         recompute closing via `netSides(opening+period)`.
 *      b. Not found → create a fresh row with opening = 0 and the new
 *         period totals. `source = 'posting_rollup'`.
 *
 * What the rollup does NOT do:
 *   - Touch ОСВ-imported balances whose key isn't in the affected set.
 *     `OsvIngestionService.ingestFromFile` already runs a full-replace
 *     within (org, period, NSBU_BASE) scope; this service is incremental
 *     and complements it.
 *   - Derive the IFRS layer. IFRS = NSBU + reclass + adjustments and is
 *     computed by a (not-yet-written) `IfrsDerivationService` that
 *     consumes the other layers as input.
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
      const sums = await this.aggregateCommittedPostings(
        organizationId,
        periodId,
        key,
      );

      const existing = await this.balanceModel.findOne({
        organizationId,
        periodId,
        accountCode: key.accountCode,
        layer: key.layer,
        subconto1Value: key.subconto1Value,
        subconto2Value: key.subconto2Value,
        subconto3Value: key.subconto3Value,
      });

      if (existing) {
        const grossDebit = addDecimals(existing.openingDebit, sums.debit);
        const grossCredit = addDecimals(existing.openingCredit, sums.credit);
        const closing = netSides(grossDebit, grossCredit);

        existing.periodDebit = toDecimal128(sums.debit);
        existing.periodCredit = toDecimal128(sums.credit);
        existing.closingDebit = toDecimal128(closing.closingDebit);
        existing.closingCredit = toDecimal128(closing.closingCredit);
        existing.recomputedAt = now;
        // Source flips to 'posting_rollup' only when this rollup actually
        // contributed turnover. A pre-existing osv_import row with zero
        // matching postings stays labelled osv_import so the audit trail
        // preserves the import-derived provenance.
        if (sums.debit !== '0' || sums.credit !== '0') {
          existing.source = 'posting_rollup';
        }
        await existing.save();
        recomputed++;
      } else {
        const closing = netSides(sums.debit, sums.credit);
        await this.balanceModel.create({
          organizationId,
          periodId,
          accountCode: key.accountCode,
          layer: key.layer,
          subconto1Value: key.subconto1Value,
          subconto2Value: key.subconto2Value,
          subconto3Value: key.subconto3Value,
          counterpartyId: key.counterpartyId,
          openingDebit: toDecimal128('0'),
          openingCredit: toDecimal128('0'),
          periodDebit: toDecimal128(sums.debit),
          periodCredit: toDecimal128(sums.credit),
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
      .select(
        'accountCode layer subconto1Value subconto2Value subconto3Value counterpartyId',
      )
      .lean();

    const keys: RollupKey[] = lines.map((l) => ({
      accountCode: l.accountCode,
      layer: l.layer,
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
  ): Promise<{ debit: string; credit: string }> {
    // Two-step: collect committed entry ids first, then sum lines. Sumtotal
    // pipelines that $lookup into the entries collection are doable but
    // less flexible (and the entry list is usually small).
    const committed = await this.entryModel
      .find({
        organizationId,
        periodId,
        status: 'committed',
      })
      .select('_id')
      .lean();
    const committedIds = committed.map((e) => e._id);

    if (committedIds.length === 0) {
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
          layer: key.layer,
          accountCode: key.accountCode,
          subconto1Value: key.subconto1Value,
          subconto2Value: key.subconto2Value,
          subconto3Value: key.subconto3Value,
          entryId: { $in: committedIds },
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
        k.layer,
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
