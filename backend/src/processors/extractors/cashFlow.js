// extractors/cashFlow.js - DEBUG VERSION

/**
 * Cash Flow Statement Data Extractor
 * WITH EXTENSIVE DEBUG LOGGING
 */

function extractCashFlowData(sheet) {
    global.logger.logInfo('[CF EXTRACTOR] Starting extraction...');
    global.logger.logInfo('[CF EXTRACTOR] Sheet keys:', JSON.stringify(Object.keys(sheet)));

    const result = {
        metadata: {
            companyName: '',
            period: '',
            inn: ''
        },
        dataMap: new Map(),
        sections: []
    };

    // Determine sheet structure and create accessor function
    let rows = null;
    let getCellValue = null;
    let rowCount = 0;

    if (sheet.rows && Array.isArray(sheet.rows)) {
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
    } else if (sheet.data && Array.isArray(sheet.data)) {
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
    } else {
        global.logger.logError('[CF EXTRACTOR] ERROR: Unknown sheet structure');
        global.logger.logError('[CF EXTRACTOR] Available keys:', Object.keys(sheet));
        throw new Error('Unable to read sheet structure. Expected sheet.rows or sheet.data array.');
    }

    global.logger.logInfo(`[CF EXTRACTOR] Total rows: ${rowCount}`);

    // DEBUG: Check first few rows
    global.logger.logInfo('[CF EXTRACTOR DEBUG] First 10 rows, column A:');
    for (let i = 0; i < Math.min(10, rowCount); i++) {
        const val = getCellValue(i, 0);
        global.logger.logInfo(`  Row ${i}: "${val}"`);
    }

    // Find where data starts - look for "CF" or "Операционная деятельность"
    let dataStartRow = -1;
    for (let i = 0; i < Math.min(10, rowCount); i++) {
        const cellA = getCellValue(i, 0);
        if (!cellA) continue;

        const cellStr = String(cellA).trim();

        // Found "CF" - data starts on next row or this row
        if (cellStr === 'CF') {
            dataStartRow = i + 1;
            global.logger.logInfo(`[CF EXTRACTOR] Found "CF" marker at row ${i}, data starts at row ${dataStartRow}`);
            break;
        }

        // Found "Операционная деятельность" - data starts here
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

        // DEBUG: Log first 3 cells of first 3 data rows
        if (itemsExtracted < 3) {
            global.logger.logInfo(`[CF EXTRACTOR DEBUG] Row ${i} "${lineItemStr}" - checking columns:`);
            for (let col = 1; col <= 3; col++) {
                const cellValue = getCellValue(i, col);
                global.logger.logInfo(`  Col ${col}: value="${cellValue}", type=${typeof cellValue}`);
            }
        }

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

        // DEBUG: Log extraction results for every row
        global.logger.logInfo(`[CF EXTRACTOR DEBUG] Row ${i} "${lineItemStr}": extracted ${values.length} values, total=${totalValue.toFixed(2)}, section=${currentSection}, subsection=${currentSubSection}`);

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

            global.logger.logInfo(`[CF EXTRACTOR] ✓ STORED Row ${i}: "${lineItemStr}" = ${totalValue.toFixed(2)} (${values.length} months, ${nonZeroCount} non-zero)`);
        } else {
            // DEBUG: Log why we didn't store
            if (values.length === 0) {
                global.logger.logInfo(`[CF EXTRACTOR] ✗ SKIPPED Row ${i} "${lineItemStr}": No values extracted`);
            } else if (!currentSection) {
                global.logger.logInfo(`[CF EXTRACTOR] ✗ SKIPPED Row ${i} "${lineItemStr}": No current section`);
            }
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