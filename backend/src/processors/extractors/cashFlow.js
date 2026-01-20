// extractors/cashFlow.js - FINAL WITH CF SKIP AND FCF CAPTURE

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
        periods: [],
        reconciliationItems: new Map(),  // For FCF, metal flows, etc.
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

        if (cellStr === 'CF') {
            // Extract period headers
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
            global.logger.logInfo(`[CF EXTRACTOR] Found Operating section at row ${i}`);
            break;
        }
    }

    if (dataStartRow === -1) {
        global.logger.logWarn('[CF EXTRACTOR] Could not find data start marker, defaulting to row 3');
        dataStartRow = 3;
    }

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
    let inReconciliation = false;  // After we hit FCF, we're in reconciliation zone

    for (let i = dataStartRow; i < rowCount; i++) {
        const lineItem = getCellValue(i, 0);
        if (!lineItem) continue;

        const lineItemStr = String(lineItem).trim();
        if (!lineItemStr || lineItemStr.length === 0) continue;

        // SKIP "CF" row if it appears as data (it's a calculated subtotal)
        if (lineItemStr === 'CF') {
            global.logger.logInfo(`[CF EXTRACTOR] Row ${i}: Skipping "CF" marker row (subtotal)`);
            continue;
        }

        // CHECK for FCF - this marks start of reconciliation section
        if (isFCFMarker(lineItemStr)) {
            global.logger.logInfo(`[CF EXTRACTOR] Row ${i}: Found FCF marker "${lineItemStr}" - switching to reconciliation mode`);
            inReconciliation = true;

            // Extract FCF values
            const periodValues = [];
            for (const period of result.periods) {
                const cellValue = getCellValue(i, period.columnIndex);
                const numValue = Number(cellValue) || 0;
                periodValues.push(numValue);
            }

            result.reconciliationItems.set('FCF', {
                lineItem: lineItemStr,
                periodValues: periodValues,
                total: periodValues.reduce((sum, val) => sum + val, 0),
                type: 'FCF'
            });

            continue;  // Continue processing for reconciliation items
        }

        // If we're in reconciliation mode, check for reconciliation items
        if (inReconciliation) {
            if (isReconciliationItem(lineItemStr)) {
                const periodValues = [];
                for (const period of result.periods) {
                    const cellValue = getCellValue(i, period.columnIndex);
                    const numValue = Number(cellValue) || 0;
                    periodValues.push(numValue);
                }

                const reconcilKey = `RECONCIL_${uniqueKeyCounter++}`;
                result.reconciliationItems.set(reconcilKey, {
                    lineItem: lineItemStr,
                    periodValues: periodValues,
                    total: periodValues.reduce((sum, val) => sum + val, 0),
                    type: 'ADJUSTMENT'
                });

                global.logger.logInfo(`[CF EXTRACTOR] Row ${i}: Reconciliation item "${lineItemStr}"`);
                continue;
            }
            // If it's not a recognized reconciliation item, stop processing
            global.logger.logInfo(`[CF EXTRACTOR] Row ${i}: End of reconciliation section`);
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

        // Detect sub-sections
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

        // Only store if we have a section
        if (currentSection) {
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

    global.logger.logInfo(`[CF EXTRACTOR] Extraction complete. Items: ${itemsExtracted}, Reconciliation items: ${result.reconciliationItems.size}`);

    return result;
}

/**
 * Check if item is a reconciliation item
 */
function isReconciliationItem(text) {
    const lower = text.toLowerCase();

    // Metal flows and related
    if (lower.includes('металл') || lower.includes('metall')) return true;
    if (lower.includes('прогон') || lower.includes('progon')) return true;

    // Schemes and adjustments
    if (lower.includes('схем') || lower.includes('sxem')) return true;
    if (lower.includes('корректир') || lower.includes('korrektir')) return true;

    // Specific reconciliation markers
    if (lower.includes('движение дс')) return true;
    if (lower.includes('остатки')) return true;
    if (lower.includes('qoldiq')) return true;  // Uzbek for "balance"

    return false;
}

function formatPeriodLabel(value) {
    if (!value) return 'Total';

    if (value instanceof Date) {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${months[value.getMonth()]} ${value.getFullYear()}`;
    }

    const dateStr = String(value);
    if (dateStr.includes('2024') || dateStr.includes('2025') || dateStr.includes('2026')) {
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

    return String(value);
}

function isFCFMarker(text) {
    const lower = text.toLowerCase().trim();
    if (lower === 'fcf' || lower === 'free cash flow') return true;
    if (lower.includes('свободный денежный поток')) return true;
    if (lower.includes('erkin pul oqimi')) return true;
    return false;
}

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

function isSectionHeader(text, sectionType) {
    const section = detectSection(text);
    return section === sectionType;
}

module.exports = {
    extractCashFlowData
};