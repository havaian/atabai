/**
 * Maps NSBU equity account rows (Form 1, section III) to IFRS equity columns
 * and NSBU Form 4 movement rows to IFRS statement of changes in equity rows.
 *
 * Standards: IAS 1.106, IAS 16.39, IAS 21.39, IAS 32.33, IAS 8.42
 *
 * Ported verbatim from backend/src/mappings/equityMapping.js — order, keys,
 * labels and regex patterns preserved exactly because the extractor and
 * transformer key off them.
 */

export interface EquityColumnDef {
  key: string;
  label: string;
  nsbuRows: string[];
  isNegative?: boolean;
  isCalculated?: boolean;
}

export interface EquityMovementRowDef {
  key: string;
  label: string;
  isTotal: boolean;
}

export interface RegexPatternDef {
  key: string;
  pattern: RegExp;
}

export const EQUITY_COLUMNS: EquityColumnDef[] = [
  { key: 'shareCapital', label: 'Share Capital', nsbuRows: ['410'] },
  { key: 'sharePremium', label: 'Share Premium / APIC', nsbuRows: ['420'] },
  { key: 'reserves', label: 'Reserves', nsbuRows: ['430'] },
  { key: 'treasuryStock', label: 'Treasury Stock', nsbuRows: ['440'], isNegative: true },
  { key: 'retainedEarnings', label: 'Retained Earnings', nsbuRows: ['450'] },
  // Rows 460 (grants) and 470 (provisions) intentionally excluded — reclassified
  // to liabilities per IAS 20 / IAS 37.
  { key: 'total', label: 'Total Equity', nsbuRows: [], isCalculated: true },
];

export const BS_ROW_TO_EQUITY_COLUMN: Record<string, string> = {
  '410': 'shareCapital',
  '420': 'sharePremium',
  '430': 'reserves',
  '440': 'treasuryStock',
  '450': 'retainedEarnings',
};

export const EQUITY_MOVEMENT_ROWS: EquityMovementRowDef[] = [
  { key: 'openingBalance', label: 'Balance at beginning of period', isTotal: true },
  { key: 'priorPeriodAdj', label: 'Prior period adjustments (IAS 8)', isTotal: false },
  { key: 'restatedOpening', label: 'Restated opening balance', isTotal: true },
  { key: 'netProfit', label: 'Net profit for the period', isTotal: false },
  { key: 'oci', label: 'Other comprehensive income (OCI)', isTotal: false },
  { key: 'totalCI', label: 'Total comprehensive income', isTotal: true },
  { key: 'dividends', label: 'Dividends declared', isTotal: false },
  { key: 'shareIssuances', label: 'Share issuances', isTotal: false },
  { key: 'treasuryPurchases', label: 'Treasury stock purchased', isTotal: false },
  { key: 'reserveTransfers', label: 'Transfers to/(from) reserves', isTotal: false },
  { key: 'closingBalance', label: 'Balance at end of period', isTotal: true },
];

export const FORM4_ROW_PATTERNS: RegexPatternDef[] = [
  { key: 'openingBalance', pattern: /остаток на нач|opening balance/i },
  { key: 'priorPeriodAdj', pattern: /исправ|корректир|prior period|restat/i },
  { key: 'netProfit', pattern: /чистая прибыль|net profit|чистый убыток/i },
  { key: 'oci', pattern: /прочий совокупный|переоценка|OCI|пересчёт/i },
  { key: 'dividends', pattern: /дивиденд|dividend/i },
  { key: 'shareIssuances', pattern: /выпуск акций|размещение|share issu/i },
  { key: 'treasuryPurchases', pattern: /выкуп акций|treasury|казначейск/i },
  { key: 'reserveTransfers', pattern: /перенос в резерв|transfer.*reserv|резервн.*фонд/i },
  { key: 'closingBalance', pattern: /остаток на кон|closing balance/i },
];

export const FORM4_COLUMN_PATTERNS: RegexPatternDef[] = [
  { key: 'shareCapital', pattern: /уставный кап|charter cap|share cap/i },
  { key: 'sharePremium', pattern: /добавленный|эмиссионный|share prem|APIC/i },
  { key: 'reserves', pattern: /резервный кап|reserves/i },
  { key: 'treasuryStock', pattern: /выкуплен|treasury|казначейск/i },
  { key: 'retainedEarnings', pattern: /нераспредел|retained earn/i },
  { key: 'total', pattern: /итого|total/i },
];
