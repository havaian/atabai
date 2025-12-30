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
function extractMetadata(sheet, structure) {
    let companyName = null;
    let inn = null;
    let reportDate = null;

    // Search in header section - EXTENDED RANGE to row 40
    const searchEndRow = Math.min(40, structure.headerRow || 50);

    for (let rowNum = 1; rowNum <= searchEndRow; rowNum++) {
        const rowData = getRow(sheet, rowNum);

        rowData.forEach((cell) => {
            if (!cell || !cell.value) return;

            const cellText = getCellText(cell);
            const normalized = normalizeText(cellText);

            // Company name detection
            if (!companyName) {
                // Check for company label
                if (normalized.includes('корхона') || normalized.includes('предприятие') ||
                    normalized.includes('ташкилот') || normalized.includes('организация')) {
                    // Look for company name in the same row
                    rowData.forEach((valueCell) => {
                        if (!valueCell || !valueCell.value) return;
                        const valueText = getCellText(valueCell);
                        const valueNormalized = normalizeText(valueText);

                        if (valueNormalized.includes('жамият') || valueNormalized.includes('jamiyat') ||
                            valueNormalized.includes('мчж') || valueNormalized.includes('mchj') ||
                            valueNormalized.includes('общество') || valueNormalized.includes('ооо') ||
                            valueNormalized.includes('mas\'uliyati cheklangan') ||
                            valueNormalized.includes('масъулияти чекланган')) {
                            companyName = valueText.trim();
                        }
                    });
                }

                // Direct detection
                if (!companyName && (
                    normalized.includes('жамият') || normalized.includes('jamiyat') ||
                    normalized.includes('мчж') || normalized.includes('mchj') ||
                    normalized.includes('общество') || normalized.includes('ооо') ||
                    normalized.includes('mas\'uliyati cheklangan') ||
                    normalized.includes('масъулияти чекланган')
                )) {
                    companyName = cellText.trim();
                }
            }

            // INN detection - Enhanced with Uzbek tax ID label
            if (!inn && (normalized.includes('инн') || normalized.includes('стир') || normalized.includes('inn') ||
                normalized.includes('идентификацион') || normalized.includes('идентификационный') ||
                normalized.includes('налогоплательщика') || normalized.includes('солиқ тўловчи'))) {

                const innMatch = cellText.match(/(\d{9,})/);
                if (innMatch) {
                    inn = innMatch[1];
                } else {
                    // Check adjacent cells in the same row for the INN number
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

            // Report date detection
            if (!reportDate && (normalized.includes('отчетная дата') || normalized.includes('ҳисобот санаси') ||
                normalized.includes('hisobot sanasi') || normalized.includes('ҳисобот') || normalized.includes('отчет'))) {
                const dateMatch = cellText.match(/(\d{2}[-./]\d{2}[-./]\d{4})/);
                if (dateMatch) {
                    reportDate = dateMatch[1];
                } else {
                    rowData.forEach((valueCell) => {
                        if (!valueCell || !valueCell.value || reportDate) return;
                        const valueText = getCellText(valueCell);
                        const match = valueText.match(/(\d{2}[-./]\d{2}[-./]\d{4})/);
                        if (match) {
                            reportDate = match[1];
                        }
                    });
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