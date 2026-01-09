// extractors/cashFlow.js

/**
 * Cash Flow Statement Data Extractor
 * Handles row-based monthly format used by Uzbek companies
 * 
 * Expected format:
 * - Row 1-3: Headers (years/months or CF label)
 * - Column A: Line item names in Russian
 * - Columns B+: Monthly values
 * 
 * Sections:
 * - Операционная деятельность (Operating Activities)
 * - Инвестиционная деятельность (Investing Activities)
 * - Финансовая деятельность (Financing Activities)
 */

function extractCashFlowData(sheet) {
    console.log('[CF EXTRACTOR] Starting extraction...');
    console.log('[CF EXTRACTOR] Sheet structure:', Object.keys(sheet));

    const result = {
        metadata: {
            companyName: '',
            period: '',
            inn: ''
        },
        dataMap: new Map(),
        monthlyData: {},
        sections: []
    };

    const rows = sheet.rows;
    const rowCount = rows.length;
    console.log(`[CF EXTRACTOR] Total rows: ${rowCount}`);

    let currentSection = null;
    let currentSubSection = null;
    let headerRow = 0;
    let monthColumns = [];

    // Find header row and month columns
    for (let i = 0; i < Math.min(5, rowCount); i++) {
        const row = rows[i];
        if (!row || !row.cells || row.cells.length === 0) continue;

        const firstCell = row.cells[0];
        const firstValue = firstCell ? firstCell.value : null;

        if (firstValue && (firstValue === 'CF' || String(firstValue).includes('Операционная'))) {
            headerRow = i > 0 ? i - 1 : 0;
            // Extract month columns (columns 1+ = B onwards in Excel)
            if (headerRow < rowCount && rows[headerRow] && rows[headerRow].cells) {
                for (let col = 1; col < rows[headerRow].cells.length; col++) {
                    const cellValue = rows[headerRow].cells[col] ? rows[headerRow].cells[col].value : null;
                    if (cellValue) {
                        monthColumns.push(col);
                    }
                }
            }
            break;
        }
    }

    console.log(`[CF EXTRACTOR] Header row: ${headerRow}, Month columns: ${monthColumns.length}`);

    // Extract data row by row
    let startDataRow = headerRow + 1;
    if (headerRow === 0) startDataRow = 3; // Default if no header found

    for (let i = startDataRow; i < rowCount; i++) {
        const row = rows[i];
        if (!row || !row.cells || row.cells.length === 0) continue;

        const lineItemCell = row.cells[0];
        const lineItem = lineItemCell ? lineItemCell.value : null;

        if (!lineItem) continue;

        const lineItemStr = String(lineItem).trim();

        // Skip empty or header rows
        if (!lineItemStr || lineItemStr.length === 0) continue;

        console.log(`[CF EXTRACTOR] Row ${i}: ${lineItemStr}`);

        // Detect sections
        if (lineItemStr.includes('Операционная деятельность') || lineItemStr.includes('операционной деятельности')) {
            currentSection = 'OPERATING';
            currentSubSection = null;
            console.log('[CF EXTRACTOR] Section: OPERATING ACTIVITIES');
            continue;
        }

        if (lineItemStr.includes('Инвестиционная деятельность') || lineItemStr.includes('инвестиционной деятельности')) {
            currentSection = 'INVESTING';
            currentSubSection = null;
            console.log('[CF EXTRACTOR] Section: INVESTING ACTIVITIES');
            continue;
        }

        if (lineItemStr.includes('Финансовая деятельность') || lineItemStr.includes('финансовой деятельности')) {
            currentSection = 'FINANCING';
            currentSubSection = null;
            console.log('[CF EXTRACTOR] Section: FINANCING ACTIVITIES');
            continue;
        }

        // Detect sub-sections (Inflows/Outflows)
        if (lineItemStr.toLowerCase().includes('приток')) {
            currentSubSection = 'INFLOW';
            console.log('[CF EXTRACTOR] Sub-section: INFLOWS');
            continue;
        }

        if (lineItemStr.toLowerCase().includes('отток')) {
            currentSubSection = 'OUTFLOW';
            console.log('[CF EXTRACTOR] Sub-section: OUTFLOWS');
            continue;
        }

        if (lineItemStr.toLowerCase().includes('притоки')) {
            currentSubSection = 'INFLOW';
            console.log('[CF EXTRACTOR] Sub-section: INFLOWS');
            continue;
        }

        // Extract values for this line item
        const values = [];
        let totalValue = 0;

        // If no month columns detected, use all available columns after first
        const columnsToCheck = monthColumns.length > 0 ? monthColumns :
            Array.from({ length: row.cells.length - 1 }, (_, i) => i + 1);

        for (const col of columnsToCheck) {
            if (col >= row.cells.length) continue;

            const cell = row.cells[col];
            const cellValue = cell ? cell.value : null;
            let numValue = 0;

            if (cellValue !== null && cellValue !== undefined) {
                numValue = Number(cellValue) || 0;
            }

            values.push(numValue);
            totalValue += numValue;
        }

        // Only store if we have a section assigned and non-zero total or it's a meaningful line
        if (currentSection || Math.abs(totalValue) > 0.01) {
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

            console.log(`[CF EXTRACTOR] Extracted: ${lineItemStr} = ${totalValue.toFixed(2)} (${values.length} months)`);
        }
    }

    console.log(`[CF EXTRACTOR] Extraction complete. Total items: ${result.dataMap.size}`);

    return result;
}

module.exports = {
    extractCashFlowData
};