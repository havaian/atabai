/**
 * NSBU account codes hard-coded into the bank-engine posting algorithm
 * (bank ТЗ §6). These are the four destinations the algorithm picks
 * between based on direction + running balance:
 *
 *   Оборот Дебет (we pay supplier):
 *     payable open → Дт 6010 / Кт 5110  (close the payable)
 *     no payable   → Дт 4310 / Кт 5110  (advance issued)
 *
 *   Оборот кредит (customer pays us):
 *     receivable open → Дт 5110 / Кт 4010  (close the receivable)
 *     no receivable   → Дт 5110 / Кт 6310  (advance received)
 *
 * 5110 is the constant - it's the org's settlement (current) account.
 * The other four flip based on direction + running balance.
 *
 * If a real chart variant uses different codes, the values are wrapped in
 * a service-loadable map (BankPostingConfig) at a later slice. For now
 * they're constants; the existing 1C "УЗ" chart uses exactly these codes.
 */
export const BANK_POSTING_ACCOUNTS = {
  CURRENT_ACCOUNT: '5110',         // Расчетный счет - the org's settlement account.
  ACCOUNTS_PAYABLE: '6010',        // Счета к оплате поставщикам.
  ADVANCES_ISSUED: '4310',         // Авансы, выданные поставщикам.
  ACCOUNTS_RECEIVABLE: '4010',     // Счета к получению от покупателей.
  ADVANCES_RECEIVED: '6310',       // Авансы, полученные от покупателей.
} as const;

export type BankPostingAccount =
  (typeof BANK_POSTING_ACCOUNTS)[keyof typeof BANK_POSTING_ACCOUNTS];

/**
 * Placeholder account stamped on a draft line the engine couldn't resolve.
 * A draft carrying it is RED on the preview and blocked from commit until the
 * operator picks a real account. Centralised here so the ingestion service and
 * the color/commit logic agree on the same sentinel.
 */
export const UNRESOLVED_ACCOUNT = '000';

/**
 * FX-conversion transit accounts (bank ТЗ §1, internal-contour postings).
 *
 * A foreign-currency purchase/sale shows up on the sum-side statement as a
 * movement against the company's own FX-transit account. Per the methodology
 * (Filipp, June 2026) the transit account 22613… maps to:
 *   - 5730 «Приобретение иностранной валюты» when the company is BUYING fx
 *     (sums leave the current account - debit-out on the statement),
 *   - 5740 «Реализация иностранной валюты» when SELLING fx.
 *
 * The chosen direction is decided by which side of the statement the row sits
 * on; see pickFxTransitAccount.
 */
export const FX_TRANSIT_ACCOUNTS = {
  PURCHASE: '5730',
  SALE: '5740',
} as const;
