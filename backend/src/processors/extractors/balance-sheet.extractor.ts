// @ts-nocheck
/**
 * Auto-converted from src/processors/extractors/balanceSheet.js.
 * Algorithm preserved verbatim; only module syntax was changed.
 *  keeps Phase 6 unblocked while the deep typing work is
 * deferred — every export is consumed via PROCESSOR_SERVICE which is
 * typed against IProcessorService at the boundary.
 */

// processors/extractors/balanceSheet.js

import {getCell, getRow, eachCellInRow} from '../readers/excel-reader';
import {findCodeColumnByDensity,
    findDataStartRow,
    findNameColumnByTextDensity,
    sampleHeaderRegion,
    throwDiagnosticError} from './_common/structure-diagnostics';
/**
 * Score a sheet by how likely it is to be the main balance sheet.
 * Used by the processor via pickBestSheet() to select the right sheet in
 * multi-sheet NSBU exports (e.g. West-format files where sheet 0 is a cover
 * page and the balance is on sheet 1).
 *
 * Scoring signals (tuned against real NSBU files):
 *   +3  has code column header ("сатр коди" / "код стр")
 *   +3  has "Актив" / "Aktiv" section marker (distinguishes the main balance
 *       from auxiliary sheets like off-balance items which also have codes)
 *   +2  per row with a 3-digit numeric code in any cell (cap +10)
 *   +1  has "баланс" / "buxgalteriya" in top rows
 *   +1  row count >= 30
 */
export function scoreBalanceSheetCandidate(sheet) {
    if (!sheet || !sheet.rowCount) return 0;

    let score = 0;
    let hasCodeHeader = false;
    let hasAktivMarker = false;
    let hasBalansTitle = false;
    let codeRowMatches = 0;

    const scanRows = Math.min(sheet.rowCount, 120);

    for (let rowNum = 1; rowNum <= scanRows; rowNum++) {
        eachCellInRow(sheet, rowNum, (cell) => {
            const cellText = getCellText(cell);
            if (!cellText) return;
            const normalized = normalizeText(cellText);

            if (!hasCodeHeader && (normalized.includes('сатр коди') || normalized.includes('код стр'))) {
                hasCodeHeader = true;
            }
            if (!hasAktivMarker && (normalized === 'актив' || normalized === 'aktiv')) {
                hasAktivMarker = true;
            }
            if (!hasBalansTitle && (normalized.includes('баланс') || normalized.includes('buxgalteriya'))) {
                hasBalansTitle = true;
            }
            // Count 3-digit row codes (010, 020, ..., 780, etc.)
            if (/^0?\d{2,3}$/.test(normalized) && parseInt(normalized, 10) >= 10 && parseInt(normalized, 10) <= 999) {
                codeRowMatches++;
            }
        });
    }

    if (hasCodeHeader) score += 3;
    if (hasAktivMarker) score += 3;
    if (hasBalansTitle) score += 1;
    score += Math.min(codeRowMatches * 2, 10);
    if (sheet.rowCount >= 30) score += 1;

    return score;
}

/**
 * Balance Sheet Data Extractor
 * Detects structure and extracts raw data from normalized workbook
 */

/**
 * Extract balance sheet data from normalized worksheet
 * @param {Object} normalizedSheet - Normalized sheet from excelReader
 * @returns {Object} Extracted data structure
 */
export function extractBalanceSheetData(normalizedSheet) {
    // Step 1: Detect structure
    const structure = detectBalanceSheetStructure(normalizedSheet);

    // Step 2: Extract metadata
    const metadata = extractMetadata(normalizedSheet, structure);

    // Step 3: Extract data map
    const dataMap = extractDataMap(normalizedSheet, structure);

    return {
        metadata,
        dataMap,
        structure
    };
}

/**
 * Detect balance sheet structure
 */
export function detectBalanceSheetStructure(sheet) {
    let headerRow = null;
    let codeColumn = null;
    let nameColumn = null;
    let dataStartRow = null;
    let lastMeaningfulRow = sheet.rowCount;

    // ── Pass 1: token-based detection (fast path, works for most formats) ──
    // Find code column and header row by looking for the standard "код стр" /
    // "сатр коди" tokens. We also scan for the "руководитель" line so we
    // know where the data section ends.
    for (let rowNum = 1; rowNum <= Math.min(sheet.rowCount, 100); rowNum++) {
        eachCellInRow(sheet, rowNum, (cell, colNum) => {
            const cellText = getCellText(cell);
            const normalized = normalizeText(cellText);

            // Detect end of header section
            if (normalized.includes('раҳбар') || normalized.includes('руководитель') ||
                normalized.includes('бош бухгалтер') || normalized.includes('главный бухгалтер')) {
                lastMeaningfulRow = Math.min(lastMeaningfulRow, rowNum);
            }

            // Detect code column
            if (!codeColumn && (normalized.includes('код стр') || normalized.includes('сатр коди'))) {
                codeColumn = colNum;
                headerRow = rowNum;
            }
        });

        if (rowNum > lastMeaningfulRow + 5) break;
    }

    // ── Fallback 1: density-based code column detection ──
    // Some NSBU exports use abbreviated or rearranged headers ("код" alone,
    // "Sr.koDi", header merged into adjacent cell, etc.) so the token
    // scan above misses the column. Instead, count cells that look like
    // 3-digit codes (010, 020, ..., 780) per column and pick the densest.
    // This is what catches "weird format day 1" before we add a new token.
    if (!codeColumn) {
        const fallback = findCodeColumnByDensity(sheet);
        if (fallback) {
            codeColumn = fallback.column;
            // We don't know the actual header row in this case — use the row
            // just above the first code row, or row 1 if codes start at top.
            const firstCodeRow = findDataStartRow(sheet, codeColumn);
            headerRow = firstCodeRow ? Math.max(1, firstCodeRow - 1) : 1;
            global.logger?.logInfo?.(
                `[balance_sheet] Code column detected by density fallback at col ${codeColumn} ` +
                `(${fallback.hits} code-like cells in ${fallback.scannedRows} rows).`,
                { category: 'extractor' }
            );
        }
    }

    if (!codeColumn) {
        throwDiagnosticError('balance_sheet', 'code column', sheet, {
            searchedFor: ['код стр', 'сатр коди', '+ density fallback (3-digit codes per column)'],
            headerSample: sampleHeaderRegion(sheet, { scanRows: 30 })
        });
    }

    // ── Pass 2: find "Актив" section marker (start of data block) ──
    // Standard NSBU forms have an "АКТИВ" row right before the assets section,
    // and "ПАССИВ" later for liabilities. We use the first one as data start.
    for (let rowNum = headerRow; rowNum <= Math.min(headerRow + 20, lastMeaningfulRow); rowNum++) {
        eachCellInRow(sheet, rowNum, (cell, colNum) => {
            const cellText = getCellText(cell);
            const normalized = normalizeText(cellText);

            if (normalized === 'актив' || normalized === 'aktiv') {
                dataStartRow = rowNum + 1;
                nameColumn = colNum;
            }
        });

        if (dataStartRow) break;
    }

    // ── Fallback 2: derive data start from code column + name column ──
    // If the "Актив" marker is missing (e.g. file uses a different word, or
    // the section header is in a merged cell that didn't normalize), fall
    // back to: data starts at the first row containing a code in codeColumn,
    // and the name column is the text-densest column near the code column.
    if (!dataStartRow || !nameColumn) {
        const firstCodeRow = findDataStartRow(sheet, codeColumn);
        if (firstCodeRow) {
            dataStartRow = firstCodeRow;
            const fallbackName = findNameColumnByTextDensity(sheet, dataStartRow);
            if (fallbackName) {
                nameColumn = fallbackName;
                global.logger?.logInfo?.(
                    `[balance_sheet] Assets section marker not found; using first code row ` +
                    `(R${dataStartRow}) as data start, col ${nameColumn} as name column.`,
                    { category: 'extractor' }
                );
            }
        }
    }

    if (!dataStartRow || !nameColumn) {
        throwDiagnosticError('balance_sheet', 'Assets section', sheet, {
            searchedFor: ['актив', 'aktiv', '+ first-code-row fallback'],
            headerSample: sampleHeaderRegion(sheet, { scanRows: 30 }),
            extra: { codeColumn, headerRow, dataStartRow, nameColumn }
        });
    }

    // ── Pass 3: find value columns by header tokens ──
    const valueColumns = [];
    eachCellInRow(sheet, headerRow, (cell, colNum) => {
        const cellText = getCellText(cell);
        const normalized = normalizeText(cellText);

        if (normalized.includes('начало') || normalized.includes('бошига')) {
            valueColumns.push({ type: 'start', column: colNum });
        }

        if (normalized.includes('конец') || normalized.includes('охирига') || normalized.includes('охир')) {
            valueColumns.push({ type: 'end', column: colNum });
        }
    });

    // ── Fallback 3: also scan a few rows above/below headerRow ──
    // Merged headers sometimes shift the "начало/конец" labels by one row.
    // If we found none, look in ±2 rows around the header row.
    if (valueColumns.length === 0) {
        const startRow = Math.max(1, headerRow - 2);
        const endRow = Math.min(sheet.rowCount, headerRow + 2);
        for (let rowNum = startRow; rowNum <= endRow; rowNum++) {
            if (rowNum === headerRow) continue;
            eachCellInRow(sheet, rowNum, (cell, colNum) => {
                const normalized = normalizeText(getCellText(cell));
                if (normalized.includes('начало') || normalized.includes('бошига')) {
                    valueColumns.push({ type: 'start', column: colNum });
                }
                if (normalized.includes('конец') || normalized.includes('охирига') || normalized.includes('охир')) {
                    valueColumns.push({ type: 'end', column: colNum });
                }
            });
        }
        if (valueColumns.length > 0) {
            global.logger?.logInfo?.(
                `[balance_sheet] Value columns found via header-row neighborhood scan ` +
                `(headerRow=${headerRow}).`,
                { category: 'extractor' }
            );
        }
    }

    if (valueColumns.length === 0) {
        throwDiagnosticError('balance_sheet', 'value columns', sheet, {
            searchedFor: ['начало', 'бошига', 'конец', 'охирига', 'охир'],
            headerSample: sampleHeaderRegion(sheet, { scanRows: Math.min(headerRow + 5, 30) }),
            extra: { codeColumn, headerRow, dataStartRow, nameColumn }
        });
    }

    return {
        headerRow,
        dataStartRow,
        codeColumn,
        nameColumn,
        valueColumns,
        lastMeaningfulRow
    };
}

/**
 * Extract metadata (company name, INN, report date)
 */
// The standard NSBU form (ОКУД 0710001) labels the date row as:
//   "Сана (йил, ой, кун) / Дата (год, месяц, число)"
// and stores year, month, day as three *separate numeric cells* in that row —
// never as a formatted date string like "30.06.2025".
//
// The old code only triggered on 'ҳисобот санаси' / 'отчет' (which didn't match
// this label) and then looked for a dd.mm.yyyy pattern in adjacent cells (which
// never found anything because the values are bare numbers). Result: always fell
// back to new Date() — today's processing date.
//
// Fix:
//   1. Expanded trigger: also match 'сана', 'год, месяц', 'йил, ой'
//   2. Adjacent-cell scan now collects bare numeric values, identifies
//      year (2000–2099) / month (1–12) / day (1–31) and assembles the date.

/**
 * Extract metadata (company name, INN, report date)
 */
export function extractMetadata(sheet, structure) {
    let companyName = null;
    let inn = null;
    let reportDate = null;

    // Scan the pre-header rows (rows before the data table starts)
    const scanLimit = Math.min(structure.headerRow + 5, structure.lastMeaningfulRow);

    for (let rowNum = 1; rowNum <= scanLimit; rowNum++) {
        // Collect all cell values in this row for adjacent-cell lookups
        const rowData = [];
        eachCellInRow(sheet, rowNum, (cell) => {
            rowData.push(cell);
        });

        eachCellInRow(sheet, rowNum, (cell) => {
            const cellText = getCellText(cell);
            if (!cellText) return;
            const normalized = normalizeText(cellText);

            // Company name detection
            if (!companyName && (
                normalized.includes('jamiyat') ||
                normalized.includes('mchj') ||
                normalized.includes('общество') ||
                normalized.includes('ооо') ||
                normalized.includes('mas\'uliyati cheklangan') ||
                normalized.includes('масъулияти чекланган')
            )) {
                companyName = cellText.trim();
            }

            // INN detection
            if (!inn && (
                normalized.includes('инн') ||
                normalized.includes('стир') ||
                normalized.includes('inn') ||
                normalized.includes('идентификацион') ||
                normalized.includes('идентификационный') ||
                normalized.includes('налогоплательщика') ||
                normalized.includes('солиқ тўловчи')
            )) {
                const innMatch = cellText.match(/(\d{9,})/);
                if (innMatch) {
                    inn = innMatch[1];
                } else {
                    // Check adjacent cells in the same row
                    rowData.forEach((valueCell) => {
                        if (!valueCell || !valueCell.value || inn) return;
                        const valueText = getCellText(valueCell);
                        const match = valueText.match(/(\d{9,})/);
                        if (match) {
                            inn = match[1];
                        }
                    });
                }
            }

            // Report date detection.
            // The standard NSBU form (ОКУД 0710001) labels the date row as
            // "Сана (йил, ой, кун) / Дата (год, месяц, число)" and stores
            // year, month, day as three separate numeric cells — never a
            // formatted date string. Both the label trigger and the
            // adjacent-cell scan must account for this.
            if (!reportDate && (
                normalized.includes('отчетная дата') ||
                normalized.includes('ҳисобот санаси') ||
                normalized.includes('hisobot sanasi') ||
                normalized.includes('сана') ||        // Uzbek: "date"
                normalized.includes('год, месяц') ||  // Russian date label
                normalized.includes('йил, ой')        // Uzbek date label
            )) {
                // First try: formatted date string in the label cell itself
                const dateMatch = cellText.match(/(\d{2}[-./]\d{2}[-./]\d{4})/);
                if (dateMatch) {
                    reportDate = dateMatch[1];
                } else {
                    // Standard NSBU form stores year / month / day as three
                    // separate numeric cells in the same row. Collect them all,
                    // identify each component by its plausible range, assemble.
                    const nums = [];
                    rowData.forEach((valueCell) => {
                        if (!valueCell || !valueCell.value) return;
                        const n = parseFloat(String(valueCell.value).trim());
                        if (!isNaN(n) && n > 0) nums.push(Math.round(n));
                    });

                    const year = nums.find(n => n >= 2000 && n <= 2099);
                    const remaining = nums.filter(n => n !== year);
                    const month = remaining.find(n => n >= 1 && n <= 12);
                    const afterMonth = remaining.filter(n => n !== month);
                    const day = afterMonth.find(n => n >= 1 && n <= 31);

                    if (year && month) {
                        const d = String(day || 1).padStart(2, '0');
                        const m = String(month).padStart(2, '0');
                        reportDate = `${d}.${m}.${year}`;
                    }
                }
            }
        });
    }

    return {
        companyName: companyName || 'Company Name',
        inn: inn || 'N/A',
        reportDate: reportDate || new Date().toISOString().split('T')[0]
    };
}

/**
 * Extract data map from sheet
 */
export function extractDataMap(sheet, structure) {
    const { dataStartRow, codeColumn, nameColumn, valueColumns, lastMeaningfulRow } = structure;
    const dataMap = new Map();
    const unitDivisor = 1; // Can be detected if needed

    for (let rowNum = dataStartRow; rowNum <= lastMeaningfulRow; rowNum++) {
        const codeCell = getCell(sheet, rowNum, codeColumn);
        const code = codeCell?.value?.toString().trim();

        // Skip if not a valid code
        if (!code || code === '' || isNaN(parseInt(code))) {
            continue;
        }

        // Normalize code to 3 digits with leading zeros
        const normalizedCode = code.padStart(3, '0');

        const nameCell = getCell(sheet, rowNum, nameColumn);
        const name = nameCell?.value?.toString().trim() || '';

        const values = {};
        valueColumns.forEach(({ type, column }) => {
            const valueCell = getCell(sheet, rowNum, column);
            let value = valueCell?.value;

            if (typeof value === 'string') {
                value = value.replace(/,/g, '').replace(/\s/g, '');
                value = (value === '-' || value === '') ? 0 : (parseFloat(value) || 0);
            } else if (typeof value === 'number') {
                value = value;
            } else {
                value = 0;
            }

            // Apply unit divisor if needed
            if (unitDivisor !== 1 && value !== 0) {
                value = value / unitDivisor;
            }

            values[type] = value;
        });

        dataMap.set(normalizedCode, {
            code: normalizedCode,
            name,
            ...values
        });
    }

    return dataMap;
}

/**
 * Helper: Get cell text
 */
export function getCellText(cell) {
    if (!cell || !cell.value) return '';
    return String(cell.value);
}

/**
 * Helper: Normalize text
 */
export function normalizeText(text) {
    if (!text) return '';
    return String(text).replace(/\s+/g, ' ').trim().toLowerCase();
}

