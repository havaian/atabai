// processors/extractors/balanceSheet.js

const { getCell, getRow, eachCellInRow } = require('../readers/excelReader');

/**
 * Balance Sheet Data Extractor
 * Detects structure and extracts raw data from normalized workbook
 */

/**
 * Extract balance sheet data from normalized worksheet
 * @param {Object} normalizedSheet - Normalized sheet from excelReader
 * @returns {Object} Extracted data structure
 */
function extractBalanceSheetData(normalizedSheet) {
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
function detectBalanceSheetStructure(sheet) {
    let headerRow = null;
    let codeColumn = null;
    let nameColumn = null;
    let dataStartRow = null;
    let lastMeaningfulRow = sheet.rowCount;

    // Find code column and header row
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

    if (!codeColumn) {
        throw new Error('Could not find code column in balance sheet');
    }

    // Find data start row (look for "АКТИВ")
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

    if (!dataStartRow || !nameColumn) {
        throw new Error('Could not find Assets section');
    }

    // Find value columns
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

    if (valueColumns.length === 0) {
        throw new Error('Could not find value columns');
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
function extractMetadata(sheet, structure) {
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
function extractDataMap(sheet, structure) {
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
function getCellText(cell) {
    if (!cell || !cell.value) return '';
    return String(cell.value);
}

/**
 * Helper: Normalize text
 */
function normalizeText(text) {
    if (!text) return '';
    return String(text).replace(/\s+/g, ' ').trim().toLowerCase();
}

module.exports = {
    extractBalanceSheetData,
    detectBalanceSheetStructure,
    extractMetadata,
    extractDataMap
};