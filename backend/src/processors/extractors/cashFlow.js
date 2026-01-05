// processors/extractors/cashFlow.js

const { getCell, getRow, eachCellInRow } = require('../readers/excelReader');

/**
 * Cash Flow Statement Data Extractor
 * Detects structure and extracts raw data from normalized workbook
 */

/**
 * Extract cash flow data from normalized worksheet
 * @param {Object} normalizedSheet - Normalized sheet from excelReader
 * @returns {Object} Extracted data structure
 */
function extractCashFlowData(normalizedSheet) {
    // Step 1: Detect structure
    const structure = detectCashFlowStructure(normalizedSheet);

    // Step 2: Extract metadata
    const metadata = extractMetadata(normalizedSheet, structure);

    // Step 3: Extract data map with inflow/outflow
    const dataMap = extractDataMap(normalizedSheet, structure);

    return {
        metadata,
        dataMap,
        structure
    };
}

/**
 * Detect cash flow statement structure
 */
function detectCashFlowStructure(sheet) {
    let headerRow = null;
    let lineNameColumn = null;
    let inflowColumns = [];
    let outflowColumns = [];
    let dataStartRow = null;
    let lastMeaningfulRow = sheet.rowCount;

    // Find line name column and header row
    for (let rowNum = 1; rowNum <= Math.min(sheet.rowCount, 20); rowNum++) {
        eachCellInRow(sheet, rowNum, (cell, colNum) => {
            const cellText = getCellText(cell);
            const normalized = normalizeText(cellText);

            // Detect line name column - look for activity labels
            if (normalized.includes('операционная') || normalized.includes('operating') ||
                normalized.includes('инвестиционная') || normalized.includes('investing') ||
                normalized.includes('названия строк') || normalized.includes('line')) {
                if (!lineNameColumn) {
                    lineNameColumn = colNum;
                    headerRow = rowNum;
                }
            }

            // Detect inflow columns
            if (normalized.includes('приток') || normalized.includes('inflow') ||
                normalized.includes('поступления') || normalized.includes('receipts')) {
                inflowColumns.push(colNum);
            }

            // Detect outflow columns
            if (normalized.includes('отток') || normalized.includes('outflow') ||
                normalized.includes('платежи') || normalized.includes('payments')) {
                outflowColumns.push(colNum);
            }
        });

        // If we found line name column, data starts after header
        if (lineNameColumn && !dataStartRow) {
            dataStartRow = rowNum + 1;
        }
    }

    // If we didn't detect columns explicitly, try to infer from data pattern
    if (!lineNameColumn) {
        lineNameColumn = 1; // Default to first column
        dataStartRow = 1;
    }

    // Detect last meaningful row (before signatures/footer)
    for (let rowNum = dataStartRow || 1; rowNum <= sheet.rowCount; rowNum++) {
        const cell = getCell(sheet, rowNum, lineNameColumn);
        const cellText = getCellText(cell);
        const normalized = normalizeText(cellText);

        if (normalized.includes('руководитель') || normalized.includes('бухгалтер') ||
            normalized.includes('director') || normalized.includes('accountant')) {
            lastMeaningfulRow = rowNum - 1;
            break;
        }
    }

    return {
        headerRow,
        lineNameColumn,
        inflowColumns,
        outflowColumns,
        dataStartRow: dataStartRow || 1,
        lastMeaningfulRow
    };
}

/**
 * Extract metadata from cash flow statement
 */
function extractMetadata(sheet, structure) {
    const metadata = {
        companyName: null,
        reportDate: null,
        inn: null,
        period: null
    };

    // Look for metadata in first few rows
    for (let rowNum = 1; rowNum <= Math.min(structure.dataStartRow || 10, 10); rowNum++) {
        eachCellInRow(sheet, rowNum, (cell) => {
            const cellText = getCellText(cell);
            const normalized = normalizeText(cellText);

            // Extract company name
            if (!metadata.companyName && (normalized.includes('компания') ||
                normalized.includes('организация') || normalized.includes('company'))) {
                metadata.companyName = cellText.trim();
            }

            // Extract INN
            if (!metadata.inn && normalized.includes('инн')) {
                const innMatch = cellText.match(/\d{9,}/);
                if (innMatch) {
                    metadata.inn = innMatch[0];
                }
            }

            // Extract period/date
            if (!metadata.period && (normalized.includes('период') ||
                normalized.includes('period') || normalized.includes('год') ||
                normalized.includes('year'))) {
                metadata.period = cellText.trim();
            }
        });
    }

    return metadata;
}

/**
 * Extract data map from cash flow statement
 */
function extractDataMap(sheet, structure) {
    const dataMap = new Map();

    for (let rowNum = structure.dataStartRow; rowNum <= structure.lastMeaningfulRow; rowNum++) {
        const lineNameCell = getCell(sheet, rowNum, structure.lineNameColumn);
        const lineName = getCellText(lineNameCell);

        if (!lineName || lineName.trim() === '') continue;

        // Detect line code (e.g., "010", "Операционная деятельность")
        let lineCode = null;
        const lineNormalized = normalizeText(lineName);

        // Check if this is a section header
        if (lineNormalized.includes('операционная') && lineNormalized.includes('деятельность')) {
            lineCode = 'OPERATING_HEADER';
        } else if (lineNormalized.includes('инвестиционная') && lineNormalized.includes('деятельность')) {
            lineCode = 'INVESTING_HEADER';
        } else if (lineNormalized.includes('финансовая') && lineNormalized.includes('деятельность')) {
            lineCode = 'FINANCING_HEADER';
        } else {
            // Try to extract numeric code or identify by keyword
            lineCode = extractLineCode(lineName, lineNormalized);
        }

        if (!lineCode) continue;

        // Extract inflow values (can be multiple columns for different periods)
        const inflows = [];
        structure.inflowColumns.forEach(col => {
            const cell = getCell(sheet, rowNum, col);
            const value = getCellNumericValue(cell);
            inflows.push(value);
        });

        // Extract outflow values
        const outflows = [];
        structure.outflowColumns.forEach(col => {
            const cell = getCell(sheet, rowNum, col);
            const value = getCellNumericValue(cell);
            outflows.push(value);
        });

        // Calculate net amount (inflow - outflow)
        const totalInflow = inflows.reduce((sum, val) => sum + val, 0);
        const totalOutflow = outflows.reduce((sum, val) => sum + val, 0);
        const netAmount = totalInflow - totalOutflow;

        dataMap.set(lineCode, {
            lineName: lineName.trim(),
            inflow: totalInflow,
            outflow: totalOutflow,
            netAmount: netAmount
        });
    }

    return dataMap;
}

/**
 * Extract line code from line name
 */
function extractLineCode(lineName, normalized) {
    // Try to extract numeric code at start (e.g., "010", "220")
    const numericMatch = lineName.trim().match(/^(\d{2,3})\s*[-.]?\s*/);
    if (numericMatch) {
        return numericMatch[1].padStart(3, '0');
    }

    // Identify by keywords
    if (normalized.includes('покупател') || normalized.includes('customer')) return '010';
    if (normalized.includes('поставщик') || normalized.includes('supplier')) return '020';
    if (normalized.includes('прочие опер') || normalized.includes('other operating')) return '030';
    if (normalized.includes('налог') && !normalized.includes('аванс')) return '040';
    if (normalized.includes('итого опер') || normalized.includes('operating cash before')) return '050';

    if (normalized.includes('проценты получ') || normalized.includes('interest received')) return '190';
    if (normalized.includes('проценты уплач') || normalized.includes('interest paid')) return '200';

    if (normalized.includes('продажа основ') || normalized.includes('sale of property')) return '060';
    if (normalized.includes('покупка основ') || (normalized.includes('purchase') && normalized.includes('property'))) return '070';
    if (normalized.includes('покупка немат') || (normalized.includes('purchase') && normalized.includes('intangible'))) return '080';
    if (normalized.includes('поступл') && normalized.includes('инвест')) return '090';
    if (normalized.includes('покупка инвест') || (normalized.includes('purchase') && normalized.includes('investment'))) return '100';

    if (normalized.includes('поступл') && normalized.includes('займ')) return '110';
    if (normalized.includes('погашение займ') || normalized.includes('repayment')) return '120';
    if (normalized.includes('выпуск акц') || normalized.includes('share issuance')) return '130';
    if (normalized.includes('дивиденд')) return '140';
    if (normalized.includes('лизинг') || normalized.includes('lease')) return '150';
    if (normalized.includes('прочие финанс поступ')) return '160';
    if (normalized.includes('прочие финанс плат')) return '170';
    if (normalized.includes('итого финанс') || normalized.includes('net cash from financing')) return '180';

    if (normalized.includes('чистое изменение') || normalized.includes('net increase')) return '220';
    if (normalized.includes('валют') || normalized.includes('exchange')) return '221';
    if (normalized.includes('начало') && normalized.includes('период') || normalized.includes('beginning')) return '230';
    if (normalized.includes('конец') && normalized.includes('период') || normalized.includes('end of period')) return '240';

    return null;
}

/**
 * Get cell text value
 */
function getCellText(cell) {
    if (!cell) return '';
    if (cell.value === null || cell.value === undefined) return '';
    if (typeof cell.value === 'object' && cell.value.richText) {
        return cell.value.richText.map(rt => rt.text).join('');
    }
    return String(cell.value).trim();
}

/**
 * Get cell numeric value
 */
function getCellNumericValue(cell) {
    if (!cell || cell.value === null || cell.value === undefined) return 0;

    const value = cell.value;

    // If it's already a number
    if (typeof value === 'number') {
        return value;
    }

    // If it's a string, try to parse
    if (typeof value === 'string') {
        // Remove spaces, commas, and other formatting
        const cleaned = value.replace(/[\s,]/g, '');
        const parsed = parseFloat(cleaned);
        return isNaN(parsed) ? 0 : parsed;
    }

    return 0;
}

/**
 * Normalize text for comparison
 */
function normalizeText(text) {
    return text.toLowerCase()
        .replace(/[^а-яa-z0-9\s]/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

module.exports = {
    extractCashFlowData
};