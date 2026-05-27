/**
 * The four-column transformation matrix from architecture doc §7.2:
 *
 *   NSBU balance  →  reclassification  →  adjustments  →  IFRS balance
 *      (input)        (no Δ result)       (real Δ)       (= row sum)
 *
 * Every AccountBalance row sits in exactly one layer. The matrix view is a
 * group-by-(account, subconto, period) projection of balances across layers.
 *
 * Why the layers are strict:
 *   - NSBU base is immutable client input — it is what the client files with
 *     the regulator. Writing into it would destroy the trust proposition
 *     ("your NSBU untouched, exactly what we changed, the IFRS result").
 *   - Reclassification regroups but does not change the financial result —
 *     any reclass balance is sign-symmetric across the two affected accounts.
 *   - Adjustments are the only place numbers actually move; each carries an
 *     IFRS standard tag + reason + deferred-tax effect (see JournalEntry).
 *   - IFRS is the derived row sum, not an input layer — but stored so the
 *     matrix view doesn't recompute on every read at scale.
 */
export const BALANCE_LAYER = {
  NSBU_BASE: 'nsbu_base',
  RECLASSIFICATION: 'reclassification',
  ADJUSTMENT: 'adjustment',
  IFRS: 'ifrs',
} as const;

export type BalanceLayer = (typeof BALANCE_LAYER)[keyof typeof BALANCE_LAYER];

export const ALL_BALANCE_LAYERS: readonly BalanceLayer[] = Object.values(BALANCE_LAYER);

export const isBalanceLayer = (value: unknown): value is BalanceLayer =>
  typeof value === 'string' && (ALL_BALANCE_LAYERS as readonly string[]).includes(value);

/** Layers that may be written by user-driven workflows (vs. derived). */
export const WRITABLE_LAYERS: readonly BalanceLayer[] = [
  BALANCE_LAYER.NSBU_BASE,         // ОСВ import + bank engine postings
  BALANCE_LAYER.RECLASSIFICATION,  // reclass entries on transformation
  BALANCE_LAYER.ADJUSTMENT,        // adjustment entries with IFRS standard tag
];
