// extractors/cashFlow.js - STRUCTURE-BASED VERSION

function extractCashFlowData(sheet) {
    global.logger.logInfo('[CF EXTRACTOR] Starting extraction...');

    if (typeof sheet === 'string') {
        try {
            sheet = JSON.parse(sheet);
        } catch (e) {
            throw new Error('Invalid sheet format: expected object or JSON string');
        }
    }

    const result = {
        metadata: {
            companyName: '',
            period: '',
            inn: ''
        },
        dataMap: new Map(),
        sections: []
    };

    // Determine sheet structure
    let rows = null;
    let getCellValue = null;
    let rowCount = 0;

    if (sheet.data && Array.isArray(sheet.data)) {
        rows = sheet.data;
        rowCount = rows.length;

        if (rowCount > 0 && rows[0]) {
            if (rows[0].cells) {
                getCellValue = (rowIndex, colIndex) => {
                    if (rowIndex >= rows.length) return null;
                    const row = rows[rowIndex];
                    if (!row || !row.cells || colIndex >= row.cells.length) return null;
                    const cell = row.cells[colIndex];
                    return cell ? cell.value : null;
                };
            } else if (Array.isArray(rows[0])) {
                getCellValue = (rowIndex, colIndex) => {
                    if (rowIndex >= rows.length) return null;
                    const row = rows[rowIndex];
                    if (!Array.isArray(row) || colIndex >= row.length) return null;
                    const cell = row[colIndex];
                    if (cell && typeof cell === 'object') {
                        return cell.value !== undefined ? cell.value : null;
                    }
                    return cell;
                };
            } else {
                throw new Error('Unknown sheet.data structure');
            }
        }
    } else if (sheet.rows && Array.isArray(sheet.rows)) {
        rows = sheet.rows;
        rowCount = rows.length;
        getCellValue = (rowIndex, colIndex) => {
            if (rowIndex >= rows.length) return null;
            const row = rows[rowIndex];
            if (!row || !row.cells || colIndex >= row.cells.length) return null;
            const cell = row.cells[colIndex];
            return cell ? cell.value : null;
        };
    } else {
        throw new Error('Unable to read sheet structure. Expected sheet.rows or sheet.data array.');
    }

    global.logger.logInfo(`[CF EXTRACTOR] Total rows: ${rowCount}`);

    // Find where data starts
    let dataStartRow = -1;
    for (let i = 0; i < Math.min(10, rowCount); i++) {
        const cellA = getCellValue(i, 0);
        if (!cellA) continue;

        const cellStr = String(cellA).trim();

        if (cellStr === 'CF') {
            dataStartRow = i + 1;
            global.logger.logInfo(`[CF EXTRACTOR] Found "CF" marker at row ${i}, data starts at row ${dataStartRow}`);
            break;
        }

        if (isSectionHeader(cellStr, 'OPERATING')) {
            dataStartRow = i;
            global.logger.logInfo(`[CF EXTRACTOR] Found Operating section at row ${i}, data starts at row ${dataStartRow}`);
            break;
        }
    }

    if (dataStartRow === -1) {
        global.logger.logWarn('[CF EXTRACTOR] Could not find data start marker, defaulting to row 3');
        dataStartRow = 3;
    }

    // Process data rows
    let currentSection = null;
    let currentSubSection = null;
    let itemsExtracted = 0;

    for (let i = dataStartRow; i < rowCount; i++) {
        const lineItem = getCellValue(i, 0);
        if (!lineItem) continue;

        const lineItemStr = String(lineItem).trim();
        if (!lineItemStr || lineItemStr.length === 0) continue;

        // STOP at FCF - support Russian, Uzbek, English
        if (isFCFMarker(lineItemStr)) {
            global.logger.logInfo(`[CF EXTRACTOR] Row ${i}: Found FCF marker "${lineItemStr}" - stopping extraction`);
            break;
        }

        // Detect main sections - support Russian and Uzbek
        const detectedSection = detectSection(lineItemStr);
        if (detectedSection) {
            currentSection = detectedSection;
            currentSubSection = null;
            global.logger.logInfo(`[CF EXTRACTOR] Row ${i}: ${detectedSection} ACTIVITIES`);
            continue;
        }

        // Detect sub-sections (inflow/outflow) - support Russian and Uzbek
        const detectedSubSection = detectSubSection(lineItemStr);
        if (detectedSubSection) {
            currentSubSection = detectedSubSection;
            global.logger.logInfo(`[CF EXTRACTOR] Row ${i}: ${detectedSubSection}`);
            continue;
        }

        // Extract monthly values from columns B onwards (index 1+)
        const values = [];
        let totalValue = 0;
        let nonZeroCount = 0;

        for (let col = 1; col < 30; col++) {
            const cellValue = getCellValue(i, col);

            if (cellValue === null || cellValue === undefined) {
                if (values.length > 0) break;
                continue;
            }

            const numValue = Number(cellValue) || 0;
            values.push(numValue);
            totalValue += numValue;
            if (Math.abs(numValue) > 0.01) nonZeroCount++;
        }

        // Only store if we extracted some values and have a section
        if (values.length > 0 && currentSection) {
            const dataEntry = {
                lineItem: lineItemStr,
                section: currentSection,
                subSection: currentSubSection,
                values: values,
                total: totalValue,
                isInflow: totalValue >= 0,
                isOutflow: totalValue < 0,
                row: i
            };

            result.dataMap.set(lineItemStr, dataEntry);
            itemsExtracted++;

            global.logger.logInfo(`[CF EXTRACTOR] Row ${i}: "${lineItemStr}" = ${totalValue.toFixed(2)} (Section: ${currentSection}, ${values.length} months)`);
        }
    }

    global.logger.logInfo(`[CF EXTRACTOR] Extraction complete. Items extracted: ${itemsExtracted}`);

    if (itemsExtracted === 0) {
        global.logger.logWarn('[CF EXTRACTOR] WARNING: No items extracted! Check file format.');
    }

    return result;
}

/**
 * Detect if line is FCF marker - supports Russian, Uzbek, English
 */
function isFCFMarker(text) {
    const lower = text.toLowerCase().trim();

    // English
    if (lower === 'fcf' || lower === 'free cash flow') return true;

    // Russian
    if (lower.includes('свободный денежный поток')) return true;

    // Uzbek
    if (lower.includes('erkin pul oqimi')) return true;

    return false;
}

/**
 * Detect section header - supports Russian and Uzbek
 */
function detectSection(text) {
    const lower = text.toLowerCase();

    // Operating activities
    // Russian: операционная деятельность, операционной деятельности
    // Uzbek: operatsion faoliyat, operatsion faoliyati
    if (lower.includes('операцион') || lower.includes('operatsion')) {
        return 'OPERATING';
    }

    // Investing activities
    // Russian: инвестиционная деятельность, инвестиционной деятельности
    // Uzbek: investitsion faoliyat, investitsion faoliyati
    if (lower.includes('инвестицион') || lower.includes('investitsion')) {
        return 'INVESTING';
    }

    // Financing activities
    // Russian: финансовая деятельность, финансовой деятельности
    // Uzbek: moliyaviy faoliyat, moliyaviy faoliyati
    if (lower.includes('финансов') || lower.includes('moliyaviy')) {
        return 'FINANCING';
    }

    return null;
}

/**
 * Detect sub-section (inflow/outflow) - supports Russian and Uzbek
 */
function detectSubSection(text) {
    const lower = text.toLowerCase();

    // Inflow
    // Russian: приток, притоки
    // Uzbek: kiruvchi, tushum
    if (lower.includes('приток') || lower.includes('kiruvchi') || lower.includes('tushum')) {
        return 'INFLOW';
    }

    // Outflow
    // Russian: отток, оттоки
    // Uzbek: chiquvchi, xarajat
    if (lower.includes('отток') || lower.includes('chiquvchi') || lower.includes('xarajat')) {
        return 'OUTFLOW';
    }

    return null;
}

/**
 * Check if text is a section header
 */
function isSectionHeader(text, sectionType) {
    const section = detectSection(text);
    return section === sectionType;
}

module.exports = {
    extractCashFlowData
};