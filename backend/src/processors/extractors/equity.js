// processors/extractors/equity.js
// Extracts equity data from either:
//   A) A balance sheet file (Form 1) — produces opening/closing balances only
//   B) A dedicated Form 4 (Statement of Changes in Equity) file — produces full movements
//
// Auto-detects which source the uploaded file is.

'use strict';

const {
    EQUITY_COLUMNS,
    BS_ROW_TO_EQUITY_COLUMN,
    EQUITY_MOVEMENT_ROWS,
    FORM4_ROW_PATTERNS,
    FORM4_COLUMN_PATTERNS,
} = require('../../mappings/equityMapping');

// ─── Shared helpers ───────────────────────────────────────────────────────────

function getCellText(cell) {
    if (!cell) return '';
    const v = cell.value !== undefined ? cell.value : cell;
    if (v === null || v === undefined) return '';
    if (typeof v === 'object' && v.text) return String(v.text);
    if (typeof v === 'object' && v.richText) return v.richText.map(r => r.text).join('');
    return String(v).trim();
}

function getCellNumber(cell) {
    const v = cell?.value !== undefined ? cell.value : cell;
    const n = Number(v);
    return isNaN(n) ? 0 : n;
}

function normalizeText(t) {
    return t.toLowerCase().replace(/\s+/g, ' ').trim();
}

// ─── Source detection ─────────────────────────────────────────────────────────

/**
 * Determine whether the file is a balance sheet (Form 1) or a Form 4.
 * Balance sheets always have a column labelled "код стр" / "Сатр коди" and
 * equity row codes (410, 420, 450...) in that column.
 */
function detectSourceType(sheet) {
    const rows = sheet.rows || (sheet.data ? sheet.data : []);
    const rowCount = sheet.rowCount || rows.length;

    let hasRowCodeColumn = false;
    let hasEquityRowCodes = false;
    let hasMovementLabels = false;

    for (let ri = 0; ri < Math.min(rowCount, 60); ri++) {
        const row = Array.isArray(rows[ri]) ? rows[ri] : (rows[ri]?.cells || []);
        for (let ci = 0; ci < Math.min(row.length, 6); ci++) {
            const text = normalizeText(getCellText(row[ci]));
            if (text.includes('код стр') || text.includes('сатр коди')) {
                hasRowCodeColumn = true;
            }
            if (/^(410|420|430|440|450|480)$/.test(text)) {
                hasEquityRowCodes = true;
            }
        }
        // Check for Form 4 movement labels anywhere in row
        const rowText = row.map(c => getCellText(c)).join(' ');
        if (FORM4_ROW_PATTERNS.some(p => p.pattern.test(rowText))) {
            hasMovementLabels = true;
        }
    }

    if (hasMovementLabels && !hasEquityRowCodes) return 'form4';
    if (hasRowCodeColumn && hasEquityRowCodes) return 'balanceSheet';
    // Default: if we see equity codes, treat as balance sheet
    if (hasEquityRowCodes) return 'balanceSheet';
    return 'form4';
}

// ─── Balance sheet source extractor ──────────────────────────────────────────

function extractFromBalanceSheet(sheet) {
    const rows = sheet.rows || (sheet.data ? sheet.data : []);
    const rowCount = sheet.rowCount || rows.length;

    const result = {};
    EQUITY_COLUMNS.forEach(col => { result[col.key] = { start: 0, end: 0 }; });

    let codeColIdx = null;
    let startColIdx = null;
    let endColIdx = null;
    let companyName = '';
    let reportDate = '';

    // Detect structure
    for (let ri = 0; ri < Math.min(rowCount, 40); ri++) {
        const row = Array.isArray(rows[ri]) ? rows[ri] : (rows[ri]?.cells || []);
        for (let ci = 0; ci < Math.min(row.length, 10); ci++) {
            const text = normalizeText(getCellText(row[ci]));
            if (text.includes('код стр') || text.includes('сатр коди')) codeColIdx = ci;
            if (text.includes('начало') || text.includes('бошига')) startColIdx = ci;
            if (text.includes('конец') || text.includes('охирига') || text.includes('охир')) endColIdx = ci;
        }
        if (codeColIdx !== null && startColIdx !== null) break;
    }

    if (codeColIdx === null) {
        global.logger.logInfo('[EQUITY EXTRACTOR] No code column found in balance sheet');
        return { type: 'balanceSheet', equityData: result, companyName, reportDate };
    }

    // Extract company name from first non-empty rows
    for (let ri = 0; ri < Math.min(rowCount, 8); ri++) {
        const row = Array.isArray(rows[ri]) ? rows[ri] : (rows[ri]?.cells || []);
        const text = getCellText(row[0]);
        if (text && text.length > 3 && !/^[0-9]/.test(text)) {
            companyName = text.trim();
            break;
        }
    }

    // Scan for equity row codes
    for (let ri = 0; ri < rowCount; ri++) {
        const row = Array.isArray(rows[ri]) ? rows[ri] : (rows[ri]?.cells || []);
        if (!row || row.length === 0) continue;

        const code = getCellText(row[codeColIdx]).trim();
        const colKey = BS_ROW_TO_EQUITY_COLUMN[code];
        if (!colKey) continue;

        const startVal = startColIdx !== null ? getCellNumber(row[startColIdx]) : 0;
        const endVal = endColIdx !== null ? getCellNumber(row[endColIdx]) : 0;

        // Apply isNegative from column definition (treasury stock)
        const colDef = EQUITY_COLUMNS.find(c => c.key === colKey);
        const sign = colDef?.isNegative ? -1 : 1;

        result[colKey] = {
            start: sign * startVal,
            end: sign * endVal,
        };
    }

    return { type: 'balanceSheet', equityData: result, companyName, reportDate };
}

// ─── Form 4 source extractor ──────────────────────────────────────────────────

function extractFromForm4(sheet) {
    const rows = sheet.rows || (sheet.data ? sheet.data : []);
    const rowCount = sheet.rowCount || rows.length;

    let companyName = '';
    let columnMap = {}; // colKey → column index
    let dataStartRow = 0;

    // Find header row (contains column names like "Уставный капитал", etc.)
    for (let ri = 0; ri < Math.min(rowCount, 20); ri++) {
        const row = Array.isArray(rows[ri]) ? rows[ri] : (rows[ri]?.cells || []);
        let matchCount = 0;
        const tentativeMap = {};
        for (let ci = 0; ci < row.length; ci++) {
            const text = getCellText(row[ci]);
            for (const { key, pattern } of FORM4_COLUMN_PATTERNS) {
                if (pattern.test(text)) {
                    tentativeMap[key] = ci;
                    matchCount++;
                    break;
                }
            }
        }
        if (matchCount >= 2) {
            columnMap = tentativeMap;
            dataStartRow = ri + 1;
            break;
        }
    }

    // Extract company name from first non-empty rows before header
    for (let ri = 0; ri < Math.min(dataStartRow, 6); ri++) {
        const row = Array.isArray(rows[ri]) ? rows[ri] : (rows[ri]?.cells || []);
        const text = getCellText(row[0]);
        if (text && text.length > 3 && !/^[0-9]/.test(text)) {
            companyName = text.trim();
            break;
        }
    }

    // Build movement data keyed by EQUITY_MOVEMENT_ROWS key
    const movements = {};
    EQUITY_MOVEMENT_ROWS.forEach(m => {
        movements[m.key] = {};
        EQUITY_COLUMNS.forEach(col => { movements[m.key][col.key] = null; });
    });

    for (let ri = dataStartRow; ri < rowCount; ri++) {
        const row = Array.isArray(rows[ri]) ? rows[ri] : (rows[ri]?.cells || []);
        if (!row || row.length === 0) continue;

        const rowLabel = getCellText(row[0]);
        if (!rowLabel) continue;

        // Match row to a movement key
        let matchedKey = null;
        for (const { key, pattern } of FORM4_ROW_PATTERNS) {
            if (pattern.test(rowLabel)) { matchedKey = key; break; }
        }
        if (!matchedKey) continue;

        // Extract values for each column
        for (const col of EQUITY_COLUMNS) {
            if (col.isCalculated) continue;
            const ci = columnMap[col.key];
            if (ci === undefined) continue;
            const val = getCellNumber(row[ci]);
            const sign = col.isNegative ? -1 : 1;
            movements[matchedKey][col.key] = sign * val;
        }
    }

    return { type: 'form4', movements, companyName };
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Extract equity data from a normalized sheet.
 * Auto-detects whether the source is a balance sheet (Form 1) or Form 4.
 * @param {Object} sheet - Normalized sheet from readExcelFile
 * @returns {Object} Extracted equity data
 */
function extractEquityData(sheet) {
    global.logger.logInfo('[EQUITY EXTRACTOR] Starting extraction');

    const sourceType = detectSourceType(sheet);
    global.logger.logInfo(`[EQUITY EXTRACTOR] Detected source type: ${sourceType}`);

    if (sourceType === 'balanceSheet') {
        const extracted = extractFromBalanceSheet(sheet);
        global.logger.logInfo('[EQUITY EXTRACTOR] Balance sheet extraction complete');
        return extracted;
    } else {
        const extracted = extractFromForm4(sheet);
        global.logger.logInfo('[EQUITY EXTRACTOR] Form 4 extraction complete');
        return extracted;
    }
}

module.exports = { extractEquityData };