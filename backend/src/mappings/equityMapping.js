// mappings/equityMapping.js
// Maps NSBU equity account rows (Form 1, section III) to IFRS equity columns
// and NSBU Form 4 movement rows to IFRS statement of changes in equity rows.
//
// Standards: IAS 1.106, IAS 16.39, IAS 21.39, IAS 32.33, IAS 8.42

'use strict';

// ─── IFRS equity columns ──────────────────────────────────────────────────────
// These are the columns in the IFRS Statement of Changes in Equity.
// Order here dictates output column order.
const EQUITY_COLUMNS = [
    { key: 'shareCapital', label: 'Share Capital', nsbuRows: ['410'] },
    { key: 'sharePremium', label: 'Share Premium / APIC', nsbuRows: ['420'] },
    { key: 'reserves', label: 'Reserves', nsbuRows: ['430'] },
    { key: 'treasuryStock', label: 'Treasury Stock', nsbuRows: ['440'], isNegative: true },
    { key: 'retainedEarnings', label: 'Retained Earnings', nsbuRows: ['450'] },
    // NOTE: rows 460 (grants) and 470 (provisions) are intentionally excluded here —
    // they are reclassified to liabilities per IAS 20 and IAS 37 (BUG-001, BUG-002 fixes).
    { key: 'total', label: 'Total Equity', nsbuRows: [], isCalculated: true },
];

// ─── Balance sheet row → equity column mapping ────────────────────────────────
// Used when deriving equity statement from a balance sheet file (opening/closing only).
const BS_ROW_TO_EQUITY_COLUMN = {
    '410': 'shareCapital',
    '420': 'sharePremium',
    '430': 'reserves',
    '440': 'treasuryStock',
    '450': 'retainedEarnings',
};

// ─── IFRS movement rows ───────────────────────────────────────────────────────
// These are the rows in the IFRS Statement of Changes in Equity.
const EQUITY_MOVEMENT_ROWS = [
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

// ─── NSBU Form 4 label detection patterns ────────────────────────────────────
// Used when extracting from a dedicated Form 4 file.
// Each entry maps a regex pattern to an EQUITY_MOVEMENT_ROWS key.
const FORM4_ROW_PATTERNS = [
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

// ─── NSBU Form 4 column header detection patterns ────────────────────────────
const FORM4_COLUMN_PATTERNS = [
    { key: 'shareCapital', pattern: /уставный кап|charter cap|share cap/i },
    { key: 'sharePremium', pattern: /добавленный|эмиссионный|share prem|APIC/i },
    { key: 'reserves', pattern: /резервный кап|reserves/i },
    { key: 'treasuryStock', pattern: /выкуплен|treasury|казначейск/i },
    { key: 'retainedEarnings', pattern: /нераспредел|retained earn/i },
    { key: 'total', pattern: /итого|total/i },
];

module.exports = {
    EQUITY_COLUMNS,
    BS_ROW_TO_EQUITY_COLUMN,
    EQUITY_MOVEMENT_ROWS,
    FORM4_ROW_PATTERNS,
    FORM4_COLUMN_PATTERNS,
};