// processors/extractors/profitLossForm2.js
// Extracts P&L data from standard NSBU Form 2 (ОКУД 0710002).
// This format uses numeric row codes (010, 020, ...) in column A,
// unlike the construction budget format which uses Russian keyword headings.

'use strict';

// Form 2 row codes and their IFRS classification
const FORM2_ROW_CODES = {
    '010': { label: 'Revenue (net)', section: 'revenue' },
    '020': { label: 'Cost of sales', section: 'cogs', isNegative: true },
    '040': { label: 'Selling expenses', section: 'opex', isNegative: true },
    '050': { label: 'Administrative expenses', section: 'opex', isNegative: true },
    '060': { label: 'Other operating income', section: 'otherOp' },
    '070': { label: 'Other operating expenses', section: 'otherOp', isNegative: true },
    '090': { label: 'Finance income', section: 'finance' },
    '100': { label: 'Finance costs', section: 'finance', isNegative: true },
    '110': { label: 'Other income', section: 'otherIncome' },
    '120': { label: 'Other expenses', section: 'otherIncome', isNegative: true },
    '140': { label: 'Income tax expense', section: 'tax', isNegative: true },
};

// Codes that are computed, not extracted
const CALCULATED_CODES = new Set(['030', '080', '130', '150']);

function getCellText(cell) {
    if (!cell) return '';
    const v = cell.value !== undefined ? cell.value : cell;
    if (v === null || v === undefined) return '';
    if (typeof v === 'object' && v.result !== undefined) return String(v.result);
    if (typeof v === 'object' && v.text) return String(v.text);
    if (typeof v === 'object' && v.richText) return v.richText.map(r => r.text).join('');
    return String(v).trim();
}

function getCellNumber(cell) {
    const v = cell?.value !== undefined ? cell.value : cell;
    if (v && typeof v === 'object' && v.result !== undefined) {
        const n = Number(v.result);
        return isNaN(n) ? null : n;
    }
    const n = Number(v);
    return (isNaN(n) || v === null || v === undefined || v === '') ? null : n;
}

function getRow(sheet, ri) {
    if (sheet.data && Array.isArray(sheet.data)) {
        const r = sheet.data[ri];
        if (!r) return [];
        if (Array.isArray(r)) return r;
        if (r.cells) return r.cells;
        return [];
    }
    if (sheet.rows && Array.isArray(sheet.rows)) {
        const r = sheet.rows[ri];
        if (!r) return [];
        if (r.cells) return r.cells;
        return [];
    }
    return [];
}

/**
 * Detect whether this sheet is a Form 2 (row-code-based P&L).
 * Returns true if column A contains ≥3 of the expected row codes.
 */
function isForm2(sheet) {
    const rowCount = sheet.rowCount || (sheet.data || sheet.rows || []).length;
    const knownCodes = new Set(Object.keys(FORM2_ROW_CODES));
    let hits = 0;
    for (let ri = 0; ri < Math.min(rowCount, 80); ri++) {
        const row = getRow(sheet, ri);
        const code = getCellText(row[0]).trim();
        if (knownCodes.has(code)) {
            hits++;
            if (hits >= 3) return true;
        }
    }
    return false;
}

/**
 * Extract all P&L data from a standard NSBU Form 2 sheet.
 * @param {Object} sheet - Normalized sheet from readExcelFile
 * @returns {Object} Extracted data (compatible with profitLossForm2 transformer)
 */
function extractProfitLossForm2Data(sheet) {
    global.logger.logInfo('[PL-F2 EXTRACTOR] Starting Form 2 extraction');

    const rowCount = sheet.rowCount || (sheet.data || sheet.rows || []).length;

    // Detect code column (first column containing a known 3-digit code)
    let codeColIdx = 0;
    for (let ri = 0; ri < Math.min(rowCount, 30); ri++) {
        const row = getRow(sheet, ri);
        for (let ci = 0; ci < Math.min(row.length, 5); ci++) {
            const text = getCellText(row[ci]).trim();
            if (/^0[1-9][0-9]$|^1[0-5][0-9]$/.test(text) && FORM2_ROW_CODES[text]) {
                codeColIdx = ci;
                break;
            }
        }
    }

    // Find value columns by scanning header rows for period labels.
    // Form 2 (ОКУД 0710002): 2 columns — "Текущий период" / "Предыдущий год".
    // Construction budget P&L: 12 monthly columns ("янв", "фев", …).
    // Priority: month row first, then year/keyword row as fallback.
    let periods = [];
    let headerRowIdx = -1;

    const MONTH_NAMES_LC = [
        'янв', 'фев', 'мар', 'апр', 'май', 'июн',
        'июл', 'авг', 'сен', 'окт', 'ноя', 'дек',
        'january', 'february', 'march', 'april', 'may', 'june',
        'july', 'august', 'september', 'october', 'november', 'december',
        'jan', 'feb', 'mar', 'apr', 'may', 'jun',
        'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
    ];

    const MONTH_TRANSLATIONS_F2 = {
        'янв': 'Jan', 'фев': 'Feb', 'мар': 'Mar', 'апр': 'Apr',
        'май': 'May', 'июн': 'Jun', 'июл': 'Jul', 'авг': 'Aug',
        'сен': 'Sep', 'окт': 'Oct', 'ноя': 'Nov', 'дек': 'Dec',
    };

    // Pass 1: look for a row containing ≥3 month names (highest confidence)
    for (let ri = 0; ri < Math.min(rowCount, 20); ri++) {
        const row = getRow(sheet, ri);
        const monthHits = [];
        for (let ci = 1; ci < Math.min(row.length, 20); ci++) {
            const text = getCellText(row[ci]).trim().toLowerCase();
            if (MONTH_NAMES_LC.includes(text)) {
                const rawLabel = getCellText(row[ci]).trim();
                const translated = MONTH_TRANSLATIONS_F2[rawLabel.toLowerCase()] || rawLabel;
                monthHits.push({ label: translated, colIndex: ci });
            }
        }
        if (monthHits.length >= 3) {
            periods = monthHits;
            headerRowIdx = ri;
            break;
        }
    }

    // Pass 2: fall back to year/keyword row (standard ОКУД 0710002 behaviour)
    if (periods.length === 0) {
        for (let ri = 0; ri < Math.min(rowCount, 20); ri++) {
            const row = getRow(sheet, ri);
            const rowText = row.map(c => getCellText(c)).join(' ').toLowerCase();
            if (/текущ|отчет|current|prior|предыдущ|\b20[1-9]\d\b/.test(rowText)) {
                for (let ci = codeColIdx + 1; ci < Math.min(row.length, 20); ci++) {
                    const text = getCellText(row[ci]).trim();
                    if (text) {
                        periods.push({ label: text, colIndex: ci });
                    }
                }
                if (periods.length > 0) {
                    headerRowIdx = ri;
                    break;
                }
            }
        }
    }

    // Fallback: if no header found, use the columns that have numeric values
    // by scanning data rows
    if (periods.length === 0) {
        for (let ri = 0; ri < Math.min(rowCount, 60); ri++) {
            const row = getRow(sheet, ri);
            const code = getCellText(row[codeColIdx]).trim();
            if (code === '010') {
                // Try columns after the code/label columns
                for (let ci = codeColIdx + 2; ci < Math.min(row.length, 8); ci++) {
                    const val = getCellNumber(row[ci]);
                    if (val !== null) {
                        periods.push({ label: `Period ${ci}`, colIndex: ci });
                    }
                }
                break;
            }
        }
        // If still nothing, guess column codeColIdx+2
        if (periods.length === 0) {
            periods = [{ label: 'Current Period', colIndex: codeColIdx + 2 }];
        }
    }

    global.logger.logInfo(`[PL-F2 EXTRACTOR] Periods: ${periods.map(p => p.label).join(', ')}`);
    global.logger.logInfo(`[PL-F2 EXTRACTOR] Code column: ${codeColIdx}`);

    const n = periods.length;

    // Extract data by row code
    const dataMap = {};

    let companyName = '';
    for (let ri = 0; ri < Math.min(rowCount, 8); ri++) {
        const row = getRow(sheet, ri);
        const text = getCellText(row[0]).trim();
        if (text && text.length > 4 && !/^\d/.test(text)) {
            companyName = text;
            break;
        }
    }

    for (let ri = 0; ri < rowCount; ri++) {
        const row = getRow(sheet, ri);
        const code = getCellText(row[codeColIdx]).trim();
        if (!FORM2_ROW_CODES[code]) continue;

        const values = periods.map(p => getCellNumber(row[p.colIndex]));
        const rowDef = FORM2_ROW_CODES[code];

        dataMap[code] = {
            code,
            label: getCellText(row[codeColIdx + 1]) || rowDef.label,
            ifrsLabel: rowDef.label,
            section: rowDef.section,
            isNegative: rowDef.isNegative || false,
            values,
        };
    }

    global.logger.logInfo(`[PL-F2 EXTRACTOR] Extracted ${Object.keys(dataMap).length} rows`);

    return {
        metadata: { companyName, period: '' },
        periods,
        columnCount: n,
        dataMap,
    };
}

module.exports = { extractProfitLossForm2Data, isForm2 };