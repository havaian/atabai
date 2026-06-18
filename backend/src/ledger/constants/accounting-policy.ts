/**
 * Accounting policy — the 6-block ruleset configured once at registration
 * (methodology §9). This module holds ONLY the structure + option enums +
 * defaults. The effect each block has on postings (cost-of-sales formula,
 * VAT entries, leave-reserve accrual, negative-stock blocking, etc.) is
 * deliberately out of scope here — §9: "Логика влияния каждого блока на
 * проводки — отдельно, позже, по каждому блоку под методологию Filipp."
 *
 * Storing the structure now (and surfacing it in onboarding) lets a client
 * declare their policy up front; the posting engines read these flags when
 * each block's logic is built later, behind Filipp sign-off.
 *
 * The six blocks (methodology §9):
 *   1. Taxes               — regime + VAT payer flag + default VAT rate
 *   2. Inventory valuation — cost method (FIFO / weighted average)
 *   3. Accounting currency — base reporting currency (already on the profile)
 *   4. Operational control — allow posting stock-out (negative balances)
 *   5. Counterparty depth  — settlement granularity (contract / invoice)
 *   6. Payroll             — cost detail + leave-reserve recognition
 */

// ─── Block 1: Taxes ──────────────────────────────────────────────────────────

/** Tax regime (methodology §9 block 1). */
export const TAX_REGIME = {
  /** Общеустановленный — VAT + profit tax. */
  GENERAL: 'general',
  /** Упрощённый — turnover tax. */
  SIMPLIFIED: 'simplified',
} as const;
export type TaxRegime = (typeof TAX_REGIME)[keyof typeof TAX_REGIME];
export const ALL_TAX_REGIMES: readonly TaxRegime[] = Object.values(TAX_REGIME);

// ─── Block 2: Inventory valuation ────────────────────────────────────────────

/** Inventory cost-of-sales method (methodology §9 block 2). */
export const INVENTORY_VALUATION = {
  /** FIFO — first in, first out. */
  FIFO: 'fifo',
  /** Weighted average — recomputed on each issue. Most common / simplest. */
  WEIGHTED_AVERAGE: 'weighted_average',
} as const;
export type InventoryValuation =
  (typeof INVENTORY_VALUATION)[keyof typeof INVENTORY_VALUATION];
export const ALL_INVENTORY_VALUATIONS: readonly InventoryValuation[] =
  Object.values(INVENTORY_VALUATION);

// ─── Block 5: Counterparty settlement depth ──────────────────────────────────

/**
 * Settlement-tracking granularity (methodology §9 block 5, refined in §7.1).
 * §7.1 narrowed the working choice to two — contract or invoice — with the
 * counterparty always the base axis. "By counterparty as a whole" is NOT a
 * separate third level; it is the base every option already carries.
 */
export const SETTLEMENT_DEPTH = {
  /** Контрагент → Контракт (CIS model). */
  CONTRACT: 'contract',
  /** Контрагент → Инвойс (rest-of-world model). */
  INVOICE: 'invoice',
} as const;
export type SettlementDepth =
  (typeof SETTLEMENT_DEPTH)[keyof typeof SETTLEMENT_DEPTH];
export const ALL_SETTLEMENT_DEPTHS: readonly SettlementDepth[] =
  Object.values(SETTLEMENT_DEPTH);

/**
 * Counterparty-level settlement depth (methodology §7.1 + Filipp's §5 ruling
 * that depth MAY be chosen per counterparty). Adds `inherit`: the counterparty
 * follows the company's policy-level `settlementDepth`. Default for every
 * counterparty is `inherit`, so changing the company policy carries existing
 * counterparties with it rather than freezing a copied value.
 *
 * Always resolve the effective depth through a single helper
 * (resolveSettlementDepth) — never read the counterparty field inline — so the
 * inherit fallback is applied consistently everywhere.
 */
export const COUNTERPARTY_SETTLEMENT_DEPTH = {
  CONTRACT: 'contract',
  INVOICE: 'invoice',
  /** Follow the company policy-level setting. */
  INHERIT: 'inherit',
} as const;
export type CounterpartySettlementDepth =
  (typeof COUNTERPARTY_SETTLEMENT_DEPTH)[keyof typeof COUNTERPARTY_SETTLEMENT_DEPTH];
export const ALL_COUNTERPARTY_SETTLEMENT_DEPTHS: readonly CounterpartySettlementDepth[] =
  Object.values(COUNTERPARTY_SETTLEMENT_DEPTH);

/**
 * Resolve the effective settlement depth for a counterparty: its own setting,
 * or the company policy default when the counterparty inherits (or is unset).
 * The single source of truth for "by contract or by invoice for THIS
 * counterparty" — posting logic and document matching both call this.
 */
export function resolveSettlementDepth(
  counterpartyDepth: CounterpartySettlementDepth | null | undefined,
  companyDepth: SettlementDepth,
): SettlementDepth {
  if (
    counterpartyDepth === COUNTERPARTY_SETTLEMENT_DEPTH.CONTRACT ||
    counterpartyDepth === COUNTERPARTY_SETTLEMENT_DEPTH.INVOICE
  ) {
    return counterpartyDepth;
  }
  return companyDepth;
}

// ─── Block 6: Payroll ────────────────────────────────────────────────────────

/** Payroll cost-detail level (methodology §9 block 6). */
export const PAYROLL_DETAIL = {
  /** Сводно по всей компании — one entry to general expense. */
  COMPANY_WIDE: 'company_wide',
  /** С детализацией по сотрудникам/отделам. */
  BY_EMPLOYEE_DEPARTMENT: 'by_employee_department',
} as const;
export type PayrollDetail =
  (typeof PAYROLL_DETAIL)[keyof typeof PAYROLL_DETAIL];
export const ALL_PAYROLL_DETAILS: readonly PayrollDetail[] =
  Object.values(PAYROLL_DETAIL);

/**
 * Leave-reserve recognition (methodology §9 block 6). Under NSBU the reserve
 * is usually not recognised; under IFRS recognition is mandatory. The flag
 * lets a client state their stance; the accrual logic itself is later work.
 */
export const LEAVE_RESERVE = {
  /** Начислять ежемесячно. */
  ACCRUE_MONTHLY: 'accrue_monthly',
  /** Признавать по факту. */
  ON_ACTUAL: 'on_actual',
} as const;
export type LeaveReserve = (typeof LEAVE_RESERVE)[keyof typeof LEAVE_RESERVE];
export const ALL_LEAVE_RESERVES: readonly LeaveReserve[] =
  Object.values(LEAVE_RESERVE);

// ─── Defaults ────────────────────────────────────────────────────────────────

/**
 * Default policy applied at bootstrap when the client doesn't override.
 * Chosen as the most common Uzbek SME shape (methodology §9 commentary):
 *   - general regime, VAT payer, 12% default rate
 *   - weighted-average inventory ("самый популярный и простой")
 *   - block negative stock (the safe default)
 *   - invoice-level settlement (broadest applicability; changeable per §7.3)
 *   - company-wide payroll, leave reserve accrued monthly (IFRS expectation)
 *
 * `vatRate` is a plain number (percent) only meaningful when `vatPayer` is
 * true; kept regardless so toggling the payer flag doesn't lose a typed rate.
 */
export const DEFAULT_VAT_RATE = 12;

export interface AccountingPolicyShape {
  taxRegime: TaxRegime;
  vatPayer: boolean;
  vatRate: number;
  inventoryValuation: InventoryValuation;
  /** Block 4: allow issuing stock that drives a balance negative. */
  allowNegativeStock: boolean;
  settlementDepth: SettlementDepth;
  payrollDetail: PayrollDetail;
  leaveReserve: LeaveReserve;
}

export const DEFAULT_ACCOUNTING_POLICY: AccountingPolicyShape = {
  taxRegime: TAX_REGIME.GENERAL,
  vatPayer: true,
  vatRate: DEFAULT_VAT_RATE,
  inventoryValuation: INVENTORY_VALUATION.WEIGHTED_AVERAGE,
  allowNegativeStock: false,
  settlementDepth: SETTLEMENT_DEPTH.INVOICE,
  payrollDetail: PAYROLL_DETAIL.COMPANY_WIDE,
  leaveReserve: LEAVE_RESERVE.ACCRUE_MONTHLY,
};
