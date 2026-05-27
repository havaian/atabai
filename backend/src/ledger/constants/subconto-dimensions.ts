/**
 * Subconto dimension names — the analytical axes declared on a ChartOfAccount
 * row (Субконто 1/2/3 column in the 1C export).
 *
 * Reference distribution (507-account NSBU chart per architecture doc §4.3):
 *   - 134 accounts carry COUNTERPARTY (often with CONTRACT)
 *   - 11 accounts carry BANK_ACCOUNT
 *   - 40 accounts carry BUDGET_PAYMENT_TYPE
 *
 * The bank engine's per-counterparty running-balance logic (architecture doc
 * §4.2) is what makes the subconto axis mandatory rather than optional —
 * "account balance" alone cannot answer "do we owe this supplier?".
 *
 * The list grows as new dimensions surface in real client charts. Schemas
 * permit arbitrary strings on `ChartOfAccount.subconto[1|2|3]Name` and on
 * `AccountBalance.subconto[1|2|3]Value`; service code SHOULD reference the
 * constants below rather than literals.
 */
export const SUBCONTO_DIMENSION = {
  COUNTERPARTY: 'Контрагенты',
  CONTRACT: 'Договоры',
  BANK_ACCOUNT: 'Банковские счета',
  BUDGET_PAYMENT_TYPE: 'Виды платежей в бюджет',
  FIXED_ASSET: 'Основные средства',
  INTANGIBLE_ASSET: 'Нематериальные активы',
  INVENTORY: 'Номенклатура',
  EMPLOYEE: 'Сотрудники',
  DEPARTMENT: 'Подразделения',
  TAX_TYPE: 'Виды налогов',
} as const;

export type SubcontoDimension =
  (typeof SUBCONTO_DIMENSION)[keyof typeof SUBCONTO_DIMENSION];

export const KNOWN_SUBCONTO_DIMENSIONS: readonly SubcontoDimension[] =
  Object.values(SUBCONTO_DIMENSION);

export const isKnownSubcontoDimension = (
  value: unknown,
): value is SubcontoDimension =>
  typeof value === 'string' &&
  (KNOWN_SUBCONTO_DIMENSIONS as readonly string[]).includes(value);
