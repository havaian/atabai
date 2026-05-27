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
 * 5110 is the constant — it's the org's settlement (current) account.
 * The other four flip based on direction + running balance.
 *
 * If a real chart variant uses different codes, the values are wrapped in
 * a service-loadable map (BankPostingConfig) at a later slice. For now
 * they're constants; the existing 1C "УЗ" chart uses exactly these codes.
 */
export const BANK_POSTING_ACCOUNTS = {
  CURRENT_ACCOUNT: '5110',         // Расчетный счет — the org's settlement account.
  ACCOUNTS_PAYABLE: '6010',        // Счета к оплате поставщикам.
  ADVANCES_ISSUED: '4310',         // Авансы, выданные поставщикам.
  ACCOUNTS_RECEIVABLE: '4010',     // Счета к получению от покупателей.
  ADVANCES_RECEIVED: '6310',       // Авансы, полученные от покупателей.
} as const;

export type BankPostingAccount =
  (typeof BANK_POSTING_ACCOUNTS)[keyof typeof BANK_POSTING_ACCOUNTS];
