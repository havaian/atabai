/**
 * Treasury (Казначейство) — the Uzbek state treasury counterparty ИНН.
 *
 * Bank statements where the counterparty ИНН equals this value carry budget
 * payments (taxes, duties, fines). The actual record-account (НДФЛ, НДС, etc.)
 * has to be inferred from a long account number embedded in the "Назначение
 * платежа" free-text field — see TreasuryRule schema and bank ТЗ §4.
 */
export const TREASURY_INN = '201122919';

export const isTreasuryInn = (inn: string | null | undefined): boolean =>
  inn === TREASURY_INN;
