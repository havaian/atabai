import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Types } from 'mongoose';

import { AppLoggerService } from '../../common/logger/app-logger.service';
import { BALANCE_LAYER } from '../constants/balance-layers';
import { addDecimals, netSides, toDecimal128 } from '../decimal-arithmetic';
import { AccountBalance, type AccountBalanceModel } from '../schemas/account-balance.schema';

/**
 * The three input layers that sum into the derived IFRS layer. Ordered to
 * mirror the transformation matrix left-to-right (architecture doc §7.2):
 *
 *   nsbu_base  →  reclassification  →  adjustment  →  ifrs
 *   (immutable     (no Δ result)        (Δ result)     (= sum of the three)
 *
 * The IFRS layer itself is intentionally excluded — it is the output, never an
 * input to its own derivation.
 */
const IFRS_INPUT_LAYERS = [
  BALANCE_LAYER.NSBU_BASE,
  BALANCE_LAYER.RECLASSIFICATION,
  BALANCE_LAYER.ADJUSTMENT,
] as const;

/**
 * The grain at which IFRS is derived — one row per (account, subconto-combo)
 * within a period. Deliberately layer-free: derivation sums *across* layers,
 * so the layer field of an incoming rollup key is dropped before it reaches
 * here. `counterpartyId` is carried so the upserted IFRS row keeps the same
 * denormalized counterparty pointer the source layers hold (the bank engine's
 * per-counterparty reads rely on it being present on every layer of a key).
 */
export interface DerivationKey {
  accountCode: string;
  subconto1Value: string | null;
  subconto2Value: string | null;
  subconto3Value: string | null;
  counterpartyId: Types.ObjectId | null;
}

export interface DerivationResult {
  /** IFRS rows updated in place. */
  recomputed: number;
  /** IFRS rows created fresh. */
  created: number;
  /** The de-duplicated key set that was processed. */
  derivedKeys: DerivationKey[];
}

/**
 * Derives the `ifrs` AccountBalance layer as the sum of the three input
 * layers (architecture doc §7.2). This is the materialized counterpart to the
 * `MatrixController` pivot: the matrix *reads* the ifrs column, this service is
 * the only thing that *writes* it.
 *
 * Why materialized (not computed at read time): every other layer is a stored
 * AccountBalance row, and `BalanceRollupService` already materializes balances
 * from postings. A read-time-only IFRS would be the single layer computed
 * differently from its three siblings, and the schema's `BalanceSource`
 * already reserves a `'derived'` value documented as "IFRS = NSBU + reclass +
 * adjustments". So derivation upserts real rows with `source: 'derived'`.
 *
 * Column convention — identical to how rollup / ОСВ-import rows are shaped:
 *   - opening{Debit,Credit}  = per-side SUM across the input layers (gross;
 *     both sides may be non-zero, e.g. an account that carried turnover).
 *   - period{Debit,Credit}   = per-side SUM across the input layers (gross —
 *     netting here would destroy turnover the flow statements need).
 *   - closing{Debit,Credit}  = `netSides()` of the summed closing columns, so
 *     the IFRS closing is a single-sided position. Provably equal to netting
 *     the summed gross opening+period (see netSides docblock) — computed from
 *     the layers' stored closings as the most direct expression of
 *     "IFRS balance = sum of the layer positions".
 *
 * Vid-agnostic: derivation never inspects Вид (А/П/КА/КП). Contra signs are
 * already baked into the debit/credit columns of the source rows; Вид
 * interpretation belongs to statement assembly / presentation downstream, not
 * here — same separation `netSides` itself observes.
 *
 * Currency: the upserted IFRS row carries `currency: null` (org base currency),
 * matching how `BalanceRollupService` creates rows. Per the AccountBalance
 * schema, FX conversion happens at report time, not store time; adjustments are
 * already in base currency. Cross-currency derivation is out of scope here.
 *
 * What this service does NOT do:
 *   - Hold a lock. Like the rollup, derivation is operator-driven and one batch
 *     at a time per period in practice. If concurrent derivation on the same
 *     key ever becomes real, wrap the per-key upsert in a session.
 *   - Recompute the input layers. It reads them as-is; callers run the relevant
 *     rollup first (committed postings → balances) and pass the affected keys.
 */
@Injectable()
export class IfrsDerivationService {
  constructor(
    @InjectModel(AccountBalance.name)
    private readonly balanceModel: AccountBalanceModel,
    private readonly logger: AppLoggerService,
  ) {}

  /**
   * Derive the IFRS layer for an explicit set of keys. Used by the adjustment
   * and reclassification commit paths — the caller passes the same keys the
   * rollup just touched (with the layer field stripped).
   */
  async deriveKeys(
    organizationId: Types.ObjectId,
    periodId: Types.ObjectId,
    keys: DerivationKey[],
  ): Promise<DerivationResult> {
    const uniqueKeys = this.dedupe(keys);
    let recomputed = 0;
    let created = 0;
    const now = new Date();

    for (const key of uniqueKeys) {
      const sums = await this.sumInputLayers(organizationId, periodId, key);
      const closing = netSides(sums.closingDebit, sums.closingCredit);

      const existing = await this.balanceModel.findOne({
        organizationId,
        periodId,
        accountCode: key.accountCode,
        layer: BALANCE_LAYER.IFRS,
        level: 0,
        subconto1Value: key.subconto1Value,
        subconto2Value: key.subconto2Value,
        subconto3Value: key.subconto3Value,
      });

      if (existing) {
        existing.openingDebit = toDecimal128(sums.openingDebit);
        existing.openingCredit = toDecimal128(sums.openingCredit);
        existing.periodDebit = toDecimal128(sums.periodDebit);
        existing.periodCredit = toDecimal128(sums.periodCredit);
        existing.closingDebit = toDecimal128(closing.closingDebit);
        existing.closingCredit = toDecimal128(closing.closingCredit);
        existing.counterpartyId = key.counterpartyId;
        existing.source = 'derived';
        existing.recomputedAt = now;
        await existing.save();
        recomputed++;
      } else {
        await this.balanceModel.create({
          organizationId,
          periodId,
          accountCode: key.accountCode,
          layer: BALANCE_LAYER.IFRS,
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
          source: 'derived',
          recomputedAt: now,
        });
        created++;
      }
    }

    if (uniqueKeys.length > 0) {
      this.logger.logAction('ledger.ifrs.derived', {
        orgId: organizationId.toString(),
        periodId: periodId.toString(),
        recomputed,
        created,
        derivedKeys: uniqueKeys.length,
      });
    }

    return { recomputed, created, derivedKeys: uniqueKeys };
  }

  /**
   * Derive (or re-derive) the IFRS layer for an entire period. The safety-net /
   * backfill path: collects every distinct (account, subconto-combo) present on
   * any input layer for the period and derives each.
   *
   * Idempotent — running it twice on unchanged inputs produces identical rows.
   * Intended uses: backfilling periods whose committed data predates this
   * service, and refreshing after a derivation-logic change. It does not assert
   * the period is writable: the IFRS layer is derived output, not a user-write
   * layer, so recomputing it is non-destructive even on a locked period (the
   * inputs cannot have changed). Callers that need a lock check should run it
   * before locking.
   */
  async deriveForPeriod(
    organizationId: Types.ObjectId,
    periodId: Types.ObjectId,
  ): Promise<DerivationResult> {
    const keys = await this.collectInputKeys(organizationId, periodId);
    return this.deriveKeys(organizationId, periodId, keys);
  }

  // ─── Internal ─────────────────────────────────────────────────────────────

  /**
   * Sum the six money columns across the three input layers for one key.
   * Missing layer rows contribute zero (an account may have an NSBU balance but
   * no reclass or adjustment, and vice-versa). Opening/period are summed
   * per-side (gross); closing is summed per-side here and netted by the caller.
   */
  private async sumInputLayers(
    organizationId: Types.ObjectId,
    periodId: Types.ObjectId,
    key: DerivationKey,
  ): Promise<{
    openingDebit: string;
    openingCredit: string;
    periodDebit: string;
    periodCredit: string;
    closingDebit: string;
    closingCredit: string;
  }> {
    const rows = await this.balanceModel
      .find({
        organizationId,
        periodId,
        accountCode: key.accountCode,
        layer: { $in: IFRS_INPUT_LAYERS as unknown as string[] },
        subconto1Value: key.subconto1Value,
        subconto2Value: key.subconto2Value,
        subconto3Value: key.subconto3Value,
      })
      .select(
        'layer level openingDebit openingCredit periodDebit periodCredit closingDebit closingCredit',
      )
      .lean();

    // nsbu_base contributes only its shallowest (min-level) row — the account's
    // rolled-up balance. The ОСВ can print one code at several tree depths (a
    // rollup line plus a deeper detail line under the SAME code); those deeper
    // rows are stored for the audit mirror but summing them here would
    // double-count (e.g. 4310 at L1 33M + L2 33M → 66M). reclassification and
    // adjustment sit at level 0 and contribute as-is.
    const nsbuRows = rows.filter((r) => r.layer === BALANCE_LAYER.NSBU_BASE);
    const minNsbuLevel = nsbuRows.length ? Math.min(...nsbuRows.map((r) => r.level ?? 0)) : null;
    const contributing = rows.filter(
      (r) => r.layer !== BALANCE_LAYER.NSBU_BASE || (r.level ?? 0) === minNsbuLevel,
    );

    return {
      openingDebit: addDecimals(...contributing.map((r) => r.openingDebit)),
      openingCredit: addDecimals(...contributing.map((r) => r.openingCredit)),
      periodDebit: addDecimals(...contributing.map((r) => r.periodDebit)),
      periodCredit: addDecimals(...contributing.map((r) => r.periodCredit)),
      closingDebit: addDecimals(...contributing.map((r) => r.closingDebit)),
      closingCredit: addDecimals(...contributing.map((r) => r.closingCredit)),
    };
  }

  /**
   * Collect every distinct (account, subconto-combo) key that has at least one
   * row on an input layer for the period. Used by the full-period rederive.
   */
  private async collectInputKeys(
    organizationId: Types.ObjectId,
    periodId: Types.ObjectId,
  ): Promise<DerivationKey[]> {
    const rows = await this.balanceModel
      .find({
        organizationId,
        periodId,
        layer: { $in: IFRS_INPUT_LAYERS as unknown as string[] },
      })
      .select('accountCode subconto1Value subconto2Value subconto3Value counterpartyId')
      .lean();

    return rows.map((r) => ({
      accountCode: r.accountCode,
      subconto1Value: r.subconto1Value,
      subconto2Value: r.subconto2Value,
      subconto3Value: r.subconto3Value,
      counterpartyId: r.counterpartyId,
    }));
  }

  private dedupe(keys: DerivationKey[]): DerivationKey[] {
    const seen = new Set<string>();
    const out: DerivationKey[] = [];
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
