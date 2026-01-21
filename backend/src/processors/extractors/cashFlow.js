// extractors/cashFlow.js - WITH ADDITIONAL SOURCES OF CASH FLOW

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
        reconciliationItems: new Map(),
        additionalSourcesItems: new Map(),  // NEW: For metal flows, etc.
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

    // FIXED: Find period header row - PRIORITIZE MONTHS over years
    let periodHeaderRow = -1;
    let dataStartRow = -1;

    // First pass: Look for MONTHS specifically
    for (let i = 0; i < rowCount; i++) {
        const cellB = getCellValue(i, 1);
        const cellC = getCellValue(i, 2);

        if (hasMonthNames(cellB, cellC)) {
            periodHeaderRow = i;
            global.logger.logInfo(`[CF EXTRACTOR] Found MONTH headers at row ${i}`);
            break;
        }
    }

    // Second pass: If no months found, look for years/quarters
    if (periodHeaderRow === -1) {
        for (let i = 0; i < rowCount; i++) {
            const cellB = getCellValue(i, 1);
            const cellC = getCellValue(i, 2);

            if (hasYearsOrQuarters(cellB, cellC)) {
                periodHeaderRow = i;
                global.logger.logInfo(`[CF EXTRACTOR] Found YEAR/QUARTER headers at row ${i}`);
                break;
            }
        }
    }

    // Extract periods from the found row
    if (periodHeaderRow !== -1) {
        for (let col = 1; col < 100; col++) {
            const periodHeader = getCellValue(periodHeaderRow, col);
            if (periodHeader === null || periodHeader === undefined) break;

            const headerStr = String(periodHeader).trim();
            if (headerStr.length === 0) break;

            result.periods.push({
                label: formatPeriodLabel(periodHeader),
                columnIndex: col
            });
        }

        global.logger.logInfo(`[CF EXTRACTOR] Extracted ${result.periods.length} periods from row ${periodHeaderRow}`);
    }

    // Find where data starts
    for (let i = 0; i < rowCount; i++) {
        const cellA = getCellValue(i, 0);
        if (cellA) {
            const cellStr = String(cellA).trim();
            if (isSectionHeader(cellStr, 'OPERATING')) {
                dataStartRow = i;
                global.logger.logInfo(`[CF EXTRACTOR] Found data start at row ${i}`);
                break;
            }
        }
    }

    // Fallbacks
    if (result.periods.length === 0) {
        global.logger.logWarn('[CF EXTRACTOR] No period headers found, using single Total column');
        result.periods.push({ label: 'Total', columnIndex: 1 });
    }

    if (dataStartRow === -1) {
        global.logger.logWarn('[CF EXTRACTOR] Could not find section headers, starting from row after periods');
        dataStartRow = periodHeaderRow !== -1 ? periodHeaderRow + 1 : 0;
    }

    global.logger.logInfo(`[CF EXTRACTOR] Periods: ${result.periods.map(p => p.label).join(', ')}`);
    global.logger.logInfo(`[CF EXTRACTOR] Data starts at row: ${dataStartRow}`);

    // Process data rows
    let currentSection = null;
    let currentSubSection = null;
    let itemsExtracted = 0;
    let uniqueKeyCounter = 0;
    let inAdditionalSources = false;
    let inReconciliation = false;

    for (let i = dataStartRow; i < rowCount; i++) {
        const lineItem = getCellValue(i, 0);
        if (!lineItem) continue;

        const lineItemStr = String(lineItem).trim();
        if (!lineItemStr || lineItemStr.length === 0) continue;

        // Check for FCF - THIS IS THE LAST THING WE EXTRACT
        if (isFCFMarker(lineItemStr)) {
            global.logger.logInfo(`[CF EXTRACTOR] Row ${i}: Found FCF "${lineItemStr}" - STOPPING EXTRACTION`);
            inReconciliation = true;

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

            // STOP EXTRACTION AFTER FCF
            break;
        }

        // Check for "CF" marker - START OF ADDITIONAL SOURCES
        if (lineItemStr === 'CF') {
            global.logger.logInfo(`[CF EXTRACTOR] Row ${i}: Found "CF" marker - STARTING ADDITIONAL SOURCES`);
            inAdditionalSources = true;
            currentSection = null;
            currentSubSection = null;
            continue;
        }

        // Additional sources section (between CF and FCF)
        if (inAdditionalSources && !inReconciliation) {
            const periodValues = [];
            for (const period of result.periods) {
                const cellValue = getCellValue(i, period.columnIndex);
                const numValue = Number(cellValue) || 0;
                periodValues.push(numValue);
            }

            // Check if this is a category or subcategory
            const isCategory = isAdditionalSourcesCategory(lineItemStr);

            const additionalKey = `ADDITIONAL_${uniqueKeyCounter++}`;
            result.additionalSourcesItems.set(additionalKey, {
                lineItem: lineItemStr,
                periodValues: periodValues,
                total: periodValues.reduce((sum, val) => sum + val, 0),
                isCategory: isCategory,
                indent: isCategory ? 0 : 1
            });

            global.logger.logInfo(`[CF EXTRACTOR] Row ${i}: Additional source "${lineItemStr}"`);
            continue;
        }

        // Detect sections (only before CF marker)
        if (!inAdditionalSources) {
            const detectedSection = detectSection(lineItemStr);
            if (detectedSection) {
                currentSection = detectedSection;
                currentSubSection = null;
                global.logger.logInfo(`[CF EXTRACTOR] Row ${i}: ${detectedSection} ACTIVITIES`);
                continue;
            }

            const detectedSubSection = detectSubSection(lineItemStr);
            if (detectedSubSection) {
                currentSubSection = detectedSubSection;
                global.logger.logInfo(`[CF EXTRACTOR] Row ${i}: ${detectedSubSection}`);
                continue;
            }

            // Extract values
            const periodValues = [];
            let totalValue = 0;

            for (const period of result.periods) {
                const cellValue = getCellValue(i, period.columnIndex);
                const numValue = Number(cellValue) || 0;
                periodValues.push(numValue);
                totalValue += numValue;
            }

            if (currentSection) {
                const uniqueKey = `${currentSection}_${currentSubSection || 'MAIN'}_${lineItemStr}_${uniqueKeyCounter++}`;

                result.dataMap.set(uniqueKey, {
                    lineItem: lineItemStr,
                    section: currentSection,
                    subSection: currentSubSection,
                    periodValues: periodValues,
                    total: totalValue,
                    isInflow: currentSubSection === 'INFLOW' || totalValue >= 0,
                    isOutflow: currentSubSection === 'OUTFLOW' || totalValue < 0,
                    row: i
                });

                itemsExtracted++;
            }
        }
    }

    global.logger.logInfo(`[CF EXTRACTOR] Complete. Items: ${itemsExtracted}, Additional Sources: ${result.additionalSourcesItems.size}, Reconciliation: ${result.reconciliationItems.size}`);

    return result;
}

/**
 * Check if this line is a category header for additional sources
 */
function isAdditionalSourcesCategory(text) {
    const lower = text.toLowerCase();

    // Main category
    if (lower.includes('движение дс') || lower.includes('pul oqimi harakati')) return true;

    return false;
}

/**
 * Check if row contains MONTH names (high priority)
 */
function hasMonthNames(cellB, cellC) {
    if (!cellB) return false;

    const b = String(cellB).toLowerCase().trim();
    const c = cellC ? String(cellC).toLowerCase().trim() : '';

    // Russian months
    const russianMonths = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
    if (russianMonths.some(month => b.includes(month))) return true;

    // English months
    const englishMonths = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    if (englishMonths.some(month => b.includes(month))) return true;

    // Uzbek months
    const uzbekMonths = ['yan', 'fev', 'mar', 'apr', 'may', 'iyun', 'iyul', 'avg', 'sen', 'okt', 'noy', 'dek'];
    if (uzbekMonths.some(month => b.includes(month))) return true;

    // Validate with next cell (should also be a month)
    if (c && (russianMonths.some(m => c.includes(m)) || englishMonths.some(m => c.includes(m)) || uzbekMonths.some(m => c.includes(m)))) {
        return true;
    }

    return false;
}

/**
 * Check if row contains YEARS or QUARTERS (lower priority)
 */
function hasYearsOrQuarters(cellB, cellC) {
    if (!cellB) return false;

    const b = String(cellB).toLowerCase().trim();

    // Years
    if (b.match(/20\d{2}/)) return true;

    // Quarters
    if (b.match(/q[1-4]/i) || b.includes('квартал')) return true;

    return false;
}

function formatPeriodLabel(value) {
    if (!value) return 'Total';

    const str = String(value).trim();

    if (str.length < 15) return str;

    if (value instanceof Date) {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${months[value.getMonth()]} ${value.getFullYear()}`;
    }

    if (str.includes('2024') || str.includes('2025') || str.includes('2026')) {
        try {
            const date = new Date(str);
            if (!isNaN(date.getTime())) {
                const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                return `${months[date.getMonth()]} ${date.getFullYear()}`;
            }
        } catch (e) { }
    }

    return str;
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

    if (lower.includes('операцион') || lower.includes('operatsion')) return 'OPERATING';
    if (lower.includes('инвестицион') || lower.includes('investitsion')) return 'INVESTING';
    if (lower.includes('финансов') || lower.includes('moliyaviy')) return 'FINANCING';

    return null;
}

function detectSubSection(text) {
    const lower = text.toLowerCase();

    if (lower.includes('приток') || lower.includes('kiruvchi') || lower.includes('tushum')) return 'INFLOW';
    if (lower.includes('отток') || lower.includes('chiquvchi') || lower.includes('xarajat')) return 'OUTFLOW';

    return null;
}

function isSectionHeader(text, sectionType) {
    const section = detectSection(text);
    return section === sectionType;
}

module.exports = {
    extractCashFlowData
};