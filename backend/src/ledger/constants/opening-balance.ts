/**
 * Opening-balance entry constants (methodology §6.2 - «ввод начальных остатков»).
 *
 * A company that migrates onto ATABAI mid-life brings incoming counterparty
 * balances. Filipp confirmed (02.07.26) these are entered PER DOCUMENT - one
 * open contract/invoice at a time, with its own amount and date - because
 * settlement is strict per document (§6.3): a later payment gashes the exact
 * document it was made against, so an opening debt needs its document to be
 * settleable. The rare case where the source carries only a per-counterparty
 * total is handled by posting the sum onto a dummy contract/invoice (Filipp:
 * «создать dummy договор или инвойс и посадить туда сумму… но такое очень
 * маловероятно»); operationally that is just providing a placeholder document
 * number, so no separate code path is needed here.
 */

import { BANK_POSTING_ACCOUNTS } from '../bank/bank-accounts';

/**
 * Technical offset account - 1C's «Вспомогательный счёт», chart code 0000.
 *
 * Each counterparty opening leg (4010/4310/6010/6310) is balanced against this
 * account so the entry is a valid double-entry on its own. It is a REAL seeded
 * chart account, deliberately distinct from the '000' UNRESOLVED_ACCOUNT
 * placeholder - so opening-balance lines are never treated as RED/unresolved.
 * Across a full opening-balance migration (once equity and the other accounts
 * are entered too) 0000 nets to zero; while only counterparty balances are in,
 * it holds their net, exactly as an auxiliary account is meant to.
 */
export const OPENING_BALANCE_OFFSET_ACCOUNT = '0000';

/**
 * The four counterparty-settlement positions an opening balance can sit on.
 * Per §6.3 the full position of a counterparty spans BOTH the debt account and
 * the advance account on each side, so all four are accepted:
 *   - RECEIVABLE       4010 (Дт) - a customer owes us
 *   - ADVANCE_ISSUED   4310 (Дт) - we prepaid a supplier
 *   - PAYABLE          6010 (Кт) - we owe a supplier
 *   - ADVANCE_RECEIVED 6310 (Кт) - a customer prepaid us
 * The codes are reused from the bank engine's posting accounts so the two
 * modules can never drift apart on which code means what.
 */
export const OPENING_BALANCE_ACCOUNTS = {
  RECEIVABLE: BANK_POSTING_ACCOUNTS.ACCOUNTS_RECEIVABLE, // 4010 (Дт)
  ADVANCE_ISSUED: BANK_POSTING_ACCOUNTS.ADVANCES_ISSUED, // 4310 (Дт)
  PAYABLE: BANK_POSTING_ACCOUNTS.ACCOUNTS_PAYABLE, // 6010 (Кт)
  ADVANCE_RECEIVED: BANK_POSTING_ACCOUNTS.ADVANCES_RECEIVED, // 6310 (Кт)
} as const;

export type OpeningBalanceAccount =
  (typeof OPENING_BALANCE_ACCOUNTS)[keyof typeof OPENING_BALANCE_ACCOUNTS];

export const ALL_OPENING_BALANCE_ACCOUNTS: readonly OpeningBalanceAccount[] =
  Object.values(OPENING_BALANCE_ACCOUNTS);

/**
 * Debit-natured opening accounts (assets - receivable + advance issued). The
 * other two (payable + advance received) are liabilities and post on credit.
 * Direction is intrinsic to the account, so a positive amount plus the account
 * fully determines the leg - the caller never passes a direction.
 */
const DEBIT_OPENING_ACCOUNTS: ReadonlySet<string> = new Set([
  OPENING_BALANCE_ACCOUNTS.RECEIVABLE,
  OPENING_BALANCE_ACCOUNTS.ADVANCE_ISSUED,
]);

export function isOpeningBalanceAccount(value: string): value is OpeningBalanceAccount {
  return (ALL_OPENING_BALANCE_ACCOUNTS as readonly string[]).includes(value);
}

/**
 * The natural posting side for a positive opening balance on this account:
 * 4010/4310 are assets (debit), 6010/6310 are liabilities (credit).
 */
export function openingLegDirection(account: OpeningBalanceAccount): 'debit' | 'credit' {
  return DEBIT_OPENING_ACCOUNTS.has(account) ? 'debit' : 'credit';
}
