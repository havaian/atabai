// extractors/cashFlow.js - FIXED VERSION

function extractCashFlowData(sheet) {
    global.logger.logInfo('[CF EXTRACTOR] Starting extraction...');

    // FIX: Sheet might be a JSON string, parse it first
    if (typeof sheet === 'string') {
        global.logger.logInfo('[CF EXTRACTOR] Sheet is a string, parsing JSON...');
        try {
            sheet = JSON.parse(sheet);
        } catch (e) {
            global.logger.logError('[CF EXTRACTOR] Failed to parse sheet JSON:', e.message);
            throw new Error('Invalid sheet format: expected object or JSON string');
        }
    }

    global.logger.logInfo('[CF EXTRACTOR] Sheet keys:', Object.keys(sheet));

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
        global.logger.logInfo('[CF EXTRACTOR] Using sheet.data structure');
        rows = sheet.data;
        rowCount = rows.length;
        getCellValue = (rowIndex, colIndex) => {
            if (rowIndex >= rows.length) return null;
            const row = rows[rowIndex];
            if (!row || !row.cells || colIndex >= row.cells.length) return null;
            const cell = row.cells[colIndex];
            return cell ? cell.value : null;
        };
    } else if (sheet.rows && Array.isArray(sheet.rows)) {
        global.logger.logInfo('[CF EXTRACTOR] Using sheet.rows structure');
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
        global.logger.logError('[CF EXTRACTOR] ERROR: Unknown sheet structure');
        global.logger.logError('[CF EXTRACTOR] Available keys:', Object.keys(sheet));
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

        if (cellStr.includes('Операционная деятельность')) {
            dataStartRow = i;
            global.logger.logInfo(`[CF EXTRACTOR] Found "Операционная деятельность" at row ${i}, data starts at row ${dataStartRow}`);
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

        // Detect main sections
        if (lineItemStr.includes('Операционная деятельность') || lineItemStr.includes('операционной деятельности')) {
            currentSection = 'OPERATING';
            currentSubSection = null;
            global.logger.logInfo(`[CF EXTRACTOR] Row ${i}: OPERATING ACTIVITIES`);
            continue;
        }

        if (lineItemStr.includes('Инвестиционная деятельность') || lineItemStr.includes('инвестиционной деятельности')) {
            currentSection = 'INVESTING';
            currentSubSection = null;
            global.logger.logInfo(`[CF EXTRACTOR] Row ${i}: INVESTING ACTIVITIES`);
            continue;
        }

        if (lineItemStr.includes('Финансовая деятельность') || lineItemStr.includes('финансовой деятельности')) {
            currentSection = 'FINANCING';
            currentSubSection = null;
            global.logger.logInfo(`[CF EXTRACTOR] Row ${i}: FINANCING ACTIVITIES`);
            continue;
        }

        // Detect sub-sections
        const lineItemLower = lineItemStr.toLowerCase();
        if (lineItemLower.includes('приток') || lineItemLower.includes('притоки')) {
            currentSubSection = 'INFLOW';
            global.logger.logInfo(`[CF EXTRACTOR] Row ${i}: INFLOWS`);
            continue;
        }

        if (lineItemLower.includes('отток') || lineItemLower.includes('оттоки')) {
            currentSubSection = 'OUTFLOW';
            global.logger.logInfo(`[CF EXTRACTOR] Row ${i}: OUTFLOWS`);
            continue;
        }

        // Extract monthly values from columns B onwards (index 1+)
        const values = [];
        let totalValue = 0;
        let nonZeroCount = 0;

        // Check up to 30 columns for monthly data
        for (let col = 1; col < 30; col++) {
            const cellValue = getCellValue(i, col);

            // Stop if we hit empty columns (no more data)
            if (cellValue === null || cellValue === undefined) {
                // Only stop if we've already found some data
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

            global.logger.logInfo(`[CF EXTRACTOR] Row ${i}: "${lineItemStr}" = ${totalValue.toFixed(2)} (${values.length} months, ${nonZeroCount} non-zero)`);
        }
    }

    global.logger.logInfo(`[CF EXTRACTOR] Extraction complete. Items extracted: ${itemsExtracted}`);

    if (itemsExtracted === 0) {
        global.logger.logWarn('[CF EXTRACTOR] WARNING: No items extracted! Check file format.');
    }

    return result;
}

module.exports = {
    extractCashFlowData
};