// extractors/cashFlow.js - FIXED VERSION WITH PERIOD SUPPORT

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
        periods: [],  // Store period headers (months/years)
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

    // Find where data starts and extract period headers
    let dataStartRow = -1;
    for (let i = 0; i < Math.min(10, rowCount); i++) {
        const cellA = getCellValue(i, 0);
        if (!cellA) continue;

        const cellStr = String(cellA).trim();

        // Check if this is the header row with period labels
        if (cellStr === 'CF') {
            // Extract period headers from columns B onwards
            for (let col = 1; col < 30; col++) {
                const periodHeader = getCellValue(i, col);
                if (periodHeader === null || periodHeader === undefined) break;

                result.periods.push({
                    label: formatPeriodLabel(periodHeader),
                    columnIndex: col
                });
            }

            dataStartRow = i + 1;
            global.logger.logInfo(`[CF EXTRACTOR] Found "CF" marker at row ${i}, extracted ${result.periods.length} periods`);
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

    // If no periods found, create a default "Total" period
    if (result.periods.length === 0) {
        global.logger.logInfo('[CF EXTRACTOR] No period headers found, using single Total column');
        result.periods.push({ label: 'Total', columnIndex: 1 });
    }

    global.logger.logInfo(`[CF EXTRACTOR] Periods: ${result.periods.map(p => p.label).join(', ')}`);

    // Process data rows
    let currentSection = null;
    let currentSubSection = null;
    let itemsExtracted = 0;
    let uniqueKeyCounter = 0;

    for (let i = dataStartRow; i < rowCount; i++) {
        const lineItem = getCellValue(i, 0);
        if (!lineItem) continue;

        const lineItemStr = String(lineItem).trim();
        if (!lineItemStr || lineItemStr.length === 0) continue;

        // STOP at FCF
        if (isFCFMarker(lineItemStr)) {
            global.logger.logInfo(`[CF EXTRACTOR] Row ${i}: Found FCF marker "${lineItemStr}" - stopping extraction`);
            break;
        }

        // Detect main sections
        const detectedSection = detectSection(lineItemStr);
        if (detectedSection) {
            currentSection = detectedSection;
            currentSubSection = null;
            global.logger.logInfo(`[CF EXTRACTOR] Row ${i}: ${detectedSection} ACTIVITIES`);
            continue;
        }

        // Detect sub-sections (inflow/outflow)
        const detectedSubSection = detectSubSection(lineItemStr);
        if (detectedSubSection) {
            currentSubSection = detectedSubSection;
            global.logger.logInfo(`[CF EXTRACTOR] Row ${i}: ${detectedSubSection}`);
            continue;
        }

        // Extract values for each period
        const periodValues = [];
        let totalValue = 0;

        for (const period of result.periods) {
            const cellValue = getCellValue(i, period.columnIndex);
            const numValue = Number(cellValue) || 0;
            periodValues.push(numValue);
            totalValue += numValue;
        }

        // Only store if we have a section and non-zero data
        if (currentSection) {
            // Create unique key: section_subsection_lineItem_counter
            // This prevents duplicates from overwriting each other
            const uniqueKey = `${currentSection}_${currentSubSection || 'MAIN'}_${lineItemStr}_${uniqueKeyCounter++}`;

            const dataEntry = {
                lineItem: lineItemStr,
                section: currentSection,
                subSection: currentSubSection,
                periodValues: periodValues,
                total: totalValue,
                isInflow: currentSubSection === 'INFLOW' || totalValue >= 0,
                isOutflow: currentSubSection === 'OUTFLOW' || totalValue < 0,
                row: i
            };

            result.dataMap.set(uniqueKey, dataEntry);
            itemsExtracted++;

            global.logger.logInfo(`[CF EXTRACTOR] Row ${i}: "${lineItemStr}" (${currentSection}/${currentSubSection || 'none'}) = ${totalValue.toFixed(2)}`);
        }
    }

    global.logger.logInfo(`[CF EXTRACTOR] Extraction complete. Items extracted: ${itemsExtracted}`);

    if (itemsExtracted === 0) {
        global.logger.logWarn('[CF EXTRACTOR] WARNING: No items extracted! Check file format.');
    }

    return result;
}

/**
 * Format period label from date or string
 */
function formatPeriodLabel(value) {
    if (!value) return 'Total';

    // If it's a date object
    if (value instanceof Date) {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${months[value.getMonth()]} ${value.getFullYear()}`;
    }

    // If it's a string date
    const dateStr = String(value);
    if (dateStr.includes('2024') || dateStr.includes('2025') || dateStr.includes('2026')) {
        // Try to parse as date
        try {
            const date = new Date(dateStr);
            if (!isNaN(date.getTime())) {
                const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                return `${months[date.getMonth()]} ${date.getFullYear()}`;
            }
        } catch (e) {
            // Not a valid date
        }
    }

    // Return as-is for budget labels or other text
    return String(value);
}

/**
 * Detect if line is FCF marker - supports Russian, Uzbek, English
 */
function isFCFMarker(text) {
    const lower = text.toLowerCase().trim();
    if (lower === 'fcf' || lower === 'free cash flow') return true;
    if (lower.includes('свободный денежный поток')) return true;
    if (lower.includes('erkin pul oqimi')) return true;
    return false;
}

/**
 * Detect section header - supports Russian and Uzbek
 */
function detectSection(text) {
    const lower = text.toLowerCase();

    if (lower.includes('операцион') || lower.includes('operatsion')) {
        return 'OPERATING';
    }

    if (lower.includes('инвестицион') || lower.includes('investitsion')) {
        return 'INVESTING';
    }

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

    if (lower.includes('приток') || lower.includes('kiruvchi') || lower.includes('tushum')) {
        return 'INFLOW';
    }

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