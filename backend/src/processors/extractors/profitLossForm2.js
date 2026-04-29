// processors/extractors/profitLossForm2.js
// Extracts P&L data from standard NSBU Form 2 (ОКУД 0710002).
// This format uses numeric row codes (010, 020, ...) in column A,
// unlike the construction budget format which uses Russian keyword headings.

'use strict';

// Mapping data lives in its own module so the transformation enricher and
// other consumers can use it without depending on extractor internals.
const { FORM2_ROW_CODES, CALCULATED_CODES } = require('../../mappings/profitLossForm2Mapping');

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

/**
 * Detect period columns. Returns an array of period descriptors:
 *   { label, colIndex }                            — single column layout
 *   { label, incomeColIndex, expenseColIndex }     — two-axis layout
 *
 * Looks for the Russian sub-headers "Доходы (прибыль)" and "Расходы (убытки)"
 * within the first 5 rows. If found in pairs, builds two-axis periods.
 * Otherwise falls back to single-column scan.
 */
function detectPeriods(sheet, rowCount, codeColIdx) {
    const incomeRe = /Доход[ыа]\s*\(прибыль/i;
    const expenseRe = /Расход[ыа]\s*\(убыт/i;
    const periodHeaderRe = /(За\s+отчетн|За\s+соответствующ|За\s+текущ|За\s+предыдущ|reporting|prior|current)/i;

    // Scan first 6 rows for period sub-headers
    let subHeaderRow = -1;
    let pairs = []; // [{incomeCol, expenseCol}, ...]

    for (let ri = 0; ri < Math.min(rowCount, 6); ri++) {
        const row = getRow(sheet, ri);
        const tempPairs = [];
        let lastIncomeCol = -1;

        for (let ci = 0; ci < row.length; ci++) {
            const text = getCellText(row[ci]).trim();
            if (incomeRe.test(text)) {
                lastIncomeCol = ci;
            } else if (expenseRe.test(text) && lastIncomeCol >= 0) {
                tempPairs.push({ incomeCol: lastIncomeCol, expenseCol: ci });
                lastIncomeCol = -1;
            }
        }

        if (tempPairs.length >= 1) {
            subHeaderRow = ri;
            pairs = tempPairs;
            break;
        }
    }

    if (pairs.length > 0) {
        // Two-axis layout. Look in row above subHeaderRow for period labels.
        const labelRow = subHeaderRow > 0 ? getRow(sheet, subHeaderRow - 1) : [];

        return pairs.map((pair, idx) => {
            // Find the merged-cell label that spans this pair (typically
            // sits in the income column of labelRow)
            let label = getCellText(labelRow[pair.incomeCol]).trim();
            if (!label || !periodHeaderRe.test(label)) {
                // Try the expense column too
                const altLabel = getCellText(labelRow[pair.expenseCol]).trim();
                if (altLabel && periodHeaderRe.test(altLabel)) label = altLabel;
            }
            if (!label) label = idx === 0 ? 'Prior Period' : 'Current Period';
            return {
                label,
                incomeColIndex: pair.incomeCol,
                expenseColIndex: pair.expenseCol,
            };
        });
    }

    // Fallback: single-column layout. Default to one period in column codeColIdx + 2.
    global.logger.logInfo('[PL-F2 EXTRACTOR] No two-axis period headers found, using single-column fallback');
    return [{ label: 'Current Period', colIndex: codeColIdx + 2 }];
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
        // Code column varies by exporter (some put codes in A, others in B).
        // Scan first 5 columns to match scoreForm2PLCandidate behavior.
        for (let ci = 0; ci < Math.min(row.length, 5); ci++) {
            const code = getCellText(row[ci]).trim();
            if (knownCodes.has(code)) {
                hits++;
                if (hits >= 3) return true;
                break; // one hit per row max
            }
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
    // Detect code column (first column containing a known 3-digit code).
    // We trust FORM2_ROW_CODES as the source of truth for valid codes —
    // checking the mapping is more robust than maintaining a regex range.
    let codeColIdx = 0;
    for (let ri = 0; ri < Math.min(rowCount, 30); ri++) {
        const row = getRow(sheet, ri);
        let found = false;
        for (let ci = 0; ci < Math.min(row.length, 5); ci++) {
            const text = getCellText(row[ci]).trim();
            if (FORM2_ROW_CODES[text]) {
                codeColIdx = ci;
                found = true;
                break;
            }
        }
        if (found) break;
    }

    // Find value columns by scanning header rows for period labels.
    //
    // Three layouts seen in the wild:
    //   (0) Two-axis: each period has paired Income / Expense columns
    //       (e.g. UzTelecom: "Доходы (прибыль)" / "Расходы (убытки)")
    //   (1) Monthly: 12 columns labeled "янв", "фев", …
    //   (2) Single-column-per-period with "текущий"/"отчётный"/year keywords
    //
    // We try Pass 0 first (most specific), then 1, then 2.
    let periods = [];
    let headerRowIdx = -1;

    // ── Pass 0: Two-axis (Доходы / Расходы paired columns) ──────────────────
    // For each pair found, the period's net value = income - expense.
    const incomeRe = /Доход[ыа]\s*\(прибыль/i;
    const expenseRe = /Расход[ыа]\s*\(убыт/i;
    const periodLabelRe = /(За\s+отчетн|За\s+соответствующ|За\s+текущ|За\s+предыдущ|reporting|prior|current|\b20[1-9]\d\b)/i;

    for (let ri = 0; ri < Math.min(rowCount, 6); ri++) {
        const row = getRow(sheet, ri);
        const tempPairs = [];
        let lastIncomeCol = -1;

        for (let ci = 0; ci < row.length; ci++) {
            const text = getCellText(row[ci]).trim();
            if (incomeRe.test(text)) {
                lastIncomeCol = ci;
            } else if (expenseRe.test(text) && lastIncomeCol >= 0) {
                tempPairs.push({ incomeCol: lastIncomeCol, expenseCol: ci });
                lastIncomeCol = -1;
            }
        }

        if (tempPairs.length >= 1) {
            // Look in the row above for the period label that spans this pair.
            // In the legal Form 2 layout the label sits one row up, often
            // merged across the two sub-columns (so it lands in incomeCol).
            const labelRow = ri > 0 ? getRow(sheet, ri - 1) : [];

            periods = tempPairs.map((pair, idx) => {
                let label = getCellText(labelRow[pair.incomeCol]).trim();
                if (!label || !periodLabelRe.test(label)) {
                    const altLabel = getCellText(labelRow[pair.expenseCol]).trim();
                    if (altLabel && periodLabelRe.test(altLabel)) label = altLabel;
                }
                if (!label) label = idx === 0 ? 'Prior Period' : 'Current Period';
                return {
                    label,
                    incomeColIndex: pair.incomeCol,
                    expenseColIndex: pair.expenseCol,
                };
            });
            headerRowIdx = ri;
            global.logger.logInfo(`[PL-F2 EXTRACTOR] Two-axis layout detected: ${periods.length} period(s)`);
            break;
        }
    }

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

        // Skip calculated codes — they're computed by the transformer from other rows
        if (CALCULATED_CODES.has(code)) continue;

        // Read values per period. Two-axis periods have paired income/expense
        // columns; single-axis periods have a single colIndex.
        const values = periods.map(p => {
            if (p.colIndex !== undefined) {
                return getCellNumber(row[p.colIndex]);
            }
            // Two-axis: net = income - expense (treat null as 0 here since
            // the form fills one or the other side, never both as null)
            const inc = getCellNumber(row[p.incomeColIndex]);
            const exp = getCellNumber(row[p.expenseColIndex]);
            const incNum = inc == null ? 0 : inc;
            const expNum = exp == null ? 0 : exp;
            return incNum - expNum;
        });

        const rowDef = FORM2_ROW_CODES[code];

        // Label column is typically the column to the LEFT of the code column
        // (in UzTelecom layout: A=label, B=code) but some exporters put it
        // to the RIGHT (codeColIdx + 1). Try both, prefer non-empty.
        // Try LEFT side first (label typically precedes code in human-readable
        // layouts like UzTelecom: A=label, B=code). Only fall back to RIGHT if
        // there's nothing useful on the left. Reject pure-numeric strings since
        // those are values bleeding in from the data columns.
        const isLabel = (s) => s && s.trim().length > 0 && !/^-?\d+(\.\d+)?$/.test(s.trim());
        let label = '';
        if (codeColIdx > 0) {
            const left = getCellText(row[codeColIdx - 1]).trim();
            if (isLabel(left)) label = left;
        }
        if (!label) {
            const right = getCellText(row[codeColIdx + 1]).trim();
            if (isLabel(right)) label = right;
        }
        if (!label) label = rowDef.label;

        dataMap[code] = {
            code,
            label,
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

/**
 * Score a sheet by how likely it is to be a standard NSBU Form 2 P&L
 * (ОКУД 0710002) with numeric row codes (010, 020, ..., 150).
 *
 * Signals:
 *   +2 per matching row code in the first 5 columns, cap +16
 *   +2  has period-header keyword ("текущ", "отчет", "предыдущ", 4-digit year)
 *
 * isForm2() uses ≥3 codes as the binary detector — this scorer is a continuous
 * version so pickBestSheet can rank competing sheets.
 */
function scoreForm2PLCandidate(sheet) {
    if (!sheet || !sheet.rowCount) return 0;

    const knownCodes = new Set(Object.keys(FORM2_ROW_CODES));
    let codeHits = 0;
    let hasPeriodHeader = false;

    const scanRows = Math.min(sheet.rowCount, 100);

    for (let ri = 0; ri < scanRows; ri++) {
        const row = getRow(sheet, ri);
        if (!row || row.length === 0) continue;

        // Count code hits in first 5 columns (code column varies by exporter)
        for (let ci = 0; ci < Math.min(row.length, 5); ci++) {
            const text = getCellText(row[ci]).trim();
            if (knownCodes.has(text)) {
                codeHits++;
                break; // one hit per row max
            }
        }

        // Period header scan
        if (!hasPeriodHeader) {
            const rowText = row.map(c => getCellText(c)).join(' ').toLowerCase();
            if (/текущ|отчет|current|prior|предыдущ|\b20[1-9]\d\b/.test(rowText)) {
                hasPeriodHeader = true;
            }
        }
    }

    let score = Math.min(codeHits * 2, 16);
    if (hasPeriodHeader) score += 2;

    return score;
}

module.exports = { extractProfitLossForm2Data, isForm2, scoreForm2PLCandidate };