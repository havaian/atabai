// @ts-nocheck
/**
 * Auto-converted from src/processors/extractors/cashFlow.js.
 * Algorithm preserved verbatim; only module syntax was changed.
 *  keeps Phase 6 unblocked while the deep typing work is
 * deferred — every export is consumed via PROCESSOR_SERVICE which is
 * typed against IProcessorService at the boundary.
 */

// extractors/cashFlow.js - PROPERLY FIXED: Keeps additional sources, fixes CF marker detection

import {sampleHeaderRegionCb,
    throwDiagnosticErrorCb} from './_common/structure-diagnostics';
export function extractCashFlowData(sheet) {
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
        additionalSourcesItems: new Map(),
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

    // Find period header row - PRIORITIZE MONTHS over years
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

        // If period labels are month-only (no year), check the row above for a year value.
        // CF_2 style: row N-1 = "2025 2025 2025...", row N = "янв фев мар..."
        const hasYearInLabels = result.periods.some(p => /\b20\d{2}\b/.test(p.label));
        if (!hasYearInLabels && periodHeaderRow > 0) {
            let yearValue = null;
            for (let col = 1; col < 20; col++) {
                const v = getCellValue(periodHeaderRow - 1, col);
                if (v && /^20\d{2}$/.test(String(v).trim())) {
                    yearValue = String(v).trim();
                    break;
                }
            }
            if (yearValue) {
                result.periods.forEach(p => {
                    const MONTH_ORDER = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                    if (MONTH_ORDER.includes(p.label)) {
                        p.label = `${p.label} ${yearValue}`;
                    }
                });
                global.logger.logInfo(`[CF EXTRACTOR] Appended year ${yearValue} to month-only period labels`);
            }
        }

        // ─── Derive period end date from the last actual month period ─────────────────
        // Periods are labelled "Jan 2025", "Feb 2025", etc. by formatPeriodLabel().
        // The last column may be a budget/annual total ("Бюджет на 2025 г.") which is
        // not a real month — skip it and find the last proper month period.
        const MONTH_ORDER = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const DAYS_IN_MONTH = (month, year) => new Date(year, month + 1, 0).getDate();

        const monthPeriods = result.periods.filter(p => {
            const parts = p.label.split(' ');
            return parts.length === 2 && MONTH_ORDER.includes(parts[0]) && /^\d{4}$/.test(parts[1]);
        });

        if (monthPeriods.length > 0) {
            const last = monthPeriods[monthPeriods.length - 1];
            const [mon, yr] = last.label.split(' ');
            const monthIdx = MONTH_ORDER.indexOf(mon);       // 0-based
            const year = parseInt(yr, 10);
            const lastDay = DAYS_IN_MONTH(monthIdx, year);
            const dd = String(lastDay).padStart(2, '0');
            const mm = String(monthIdx + 1).padStart(2, '0');
            result.metadata.period = `For the period ended ${dd}.${mm}.${yr}`;
            global.logger.logInfo(`[CF EXTRACTOR] Derived period end date: ${result.metadata.period}`);
        }
        // ─────────────────────────────────────────────────────────────────────────────

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
    let mainSectionsComplete = false;

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
        // CRITICAL FIX: Only trigger if:
        // 1. We're in the data section (not header row)
        // 2. We've completed the main 3 sections (Operating, Investing, Financing)
        // 3. The line has ONLY "CF" (not part of a longer label)
        if (lineItemStr === 'CF' &&
            i >= dataStartRow &&
            mainSectionsComplete &&
            !currentSection) {
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

                // Check if we've seen all 3 main sections
                if (detectedSection === 'FINANCING') {
                    mainSectionsComplete = true;
                    global.logger.logInfo(`[CF EXTRACTOR] Main sections (Op/Inv/Fin) complete`);
                }

                // Don't extract the section header itself - just continue
                continue;
            }

            const detectedSubSection = detectSubSection(lineItemStr);
            if (detectedSubSection) {
                currentSubSection = detectedSubSection;
                global.logger.logInfo(`[CF EXTRACTOR] Row ${i}: ${detectedSubSection}`);

                // Check if there are child items below this subsection
                // If the next non-empty row is NOT a section/subsection header, it's a child item
                let hasChildItems = false;
                for (let j = i + 1; j < rowCount; j++) {
                    const nextItem = getCellValue(j, 0);
                    if (!nextItem) continue;

                    const nextItemStr = String(nextItem).trim();
                    if (!nextItemStr) continue;

                    // Check if next item is a section/subsection header
                    if (detectSection(nextItemStr) || detectSubSection(nextItemStr) || isFCFMarker(nextItemStr)) {
                        // Next item is a header, so this subsection has NO children
                        hasChildItems = false;
                        break;
                    } else {
                        // Next item is a regular line item, so this subsection HAS children
                        hasChildItems = true;
                        break;
                    }
                }

                // Only extract subsection header if it has NO children AND has values
                if (!hasChildItems) {
                    const periodValues = [];
                    let totalValue = 0;
                    for (const period of result.periods) {
                        const cellValue = getCellValue(i, period.columnIndex);
                        const numValue = Number(cellValue) || 0;
                        periodValues.push(numValue);
                        totalValue += numValue;
                    }

                    if (totalValue !== 0) {
                        global.logger.logInfo(`[CF EXTRACTOR] Row ${i}: Subsection "${lineItemStr}" has NO children but has values - extracting`);
                        const uniqueKey = `${currentSection}_${currentSubSection}_${lineItemStr}_${uniqueKeyCounter++}`;
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
                } else {
                    global.logger.logInfo(`[CF EXTRACTOR] Row ${i}: Subsection "${lineItemStr}" has children - skipping subsection header`);
                }

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

    // ── Post-extraction validation ──
    // Detect "silent failure" — extractor ran but found nothing meaningful.
    // Before this layer, an unrecognized format would return an empty result
    // that silently propagated through the pipeline, leaving the user with
    // a blank output and no diagnostic. Now we fail loudly with a sample of
    // what the parser actually saw so the dev can update heuristics.
    //
    // Threshold: 0 dataMap entries AND 0 reconciliation items AND 0
    // additional sources AND no detected periods. If only some of these
    // are zero, the file might be partially valid (e.g. CF with no
    // reconciliation section) — don't false-positive on those.
    const totalItems = result.dataMap.size + result.reconciliationItems.size + result.additionalSourcesItems.size;
    if (totalItems === 0 && result.periods.length === 0) {
        throwDiagnosticErrorCb(
            'cash_flow',
            'any recognizable cash-flow data',
            getCellValue,
            rowCount,
            null,
            {
                searchedFor: [
                    'month names (янв/фев/.../jan/feb/...)',
                    'year/quarter headers',
                    'numeric line codes',
                    'section markers (movement of cash, reconciliation, additional sources)'
                ],
                headerSample: sampleHeaderRegionCb(getCellValue, rowCount, { scanRows: 25 }),
                extra: {
                    periodHeaderRow,
                    dataStartRow,
                    rowCount
                }
            }
        );
    }

    return result;
}

/**
 * Check if this line is a category header for additional sources
 */
export function isAdditionalSourcesCategory(text) {
    const lower = text.toLowerCase();

    // Main category
    if (lower.includes('движение дс') || lower.includes('pul oqimi harakati')) return true;

    return false;
}

/**
 * Check if row contains MONTH names (high priority)
 */
export function hasMonthNames(cellB, cellC) {
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
export function hasYearsOrQuarters(cellB, cellC) {
    if (!cellB) return false;

    const b = String(cellB).toLowerCase().trim();

    // Years
    if (b.match(/20\d{2}/)) return true;

    // Quarters
    if (b.match(/q[1-4]/i) || b.includes('квартал')) return true;

    return false;
}

export function formatPeriodLabel(value) {
    if (!value) return 'Total';
    const str = String(value).trim();

    // Translate Russian/Uzbek month abbreviations to English
    const MONTH_MAP = {
        'янв': 'Jan', 'фев': 'Feb', 'мар': 'Mar', 'апр': 'Apr',
        'май': 'May', 'июн': 'Jun', 'июл': 'Jul', 'авг': 'Aug',
        'сен': 'Sep', 'окт': 'Oct', 'ноя': 'Nov', 'дек': 'Dec',
        'yan': 'Jan', 'fev': 'Feb', 'mar': 'Mar', 'apr': 'Apr',
        'may': 'May', 'iyun': 'Jun', 'iyul': 'Jul', 'avg': 'Aug',
        'sen': 'Sep', 'okt': 'Oct', 'noy': 'Nov', 'dek': 'Dec',
    };
    const translated = MONTH_MAP[str.toLowerCase()];
    if (translated) return translated;

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

export function isFCFMarker(text) {
    const lower = text.toLowerCase().trim();
    if (lower === 'fcf' || lower === 'free cash flow') return true;
    if (lower.includes('свободный денежный поток')) return true;
    if (lower.includes('erkin pul oqimi')) return true;
    return false;
}

export function detectSection(text) {
    const lower = text.toLowerCase();

    if (lower.includes('операцион') || lower.includes('operatsion')) return 'OPERATING';
    if (lower.includes('инвестицион') || lower.includes('investitsion')) return 'INVESTING';
    if (lower.includes('финансов') || lower.includes('moliyaviy')) return 'FINANCING';

    return null;
}

export function detectSubSection(text) {
    const lower = text.toLowerCase();

    if (lower.includes('приток') || lower.includes('kiruvchi') || lower.includes('tushum')) return 'INFLOW';
    if (lower.includes('отток') || lower.includes('chiquvchi') || lower.includes('xarajat')) return 'OUTFLOW';

    return null;
}

export function isSectionHeader(text, sectionType) {
    const section = detectSection(text);
    return section === sectionType;
}

/**
 * Score a sheet by how likely it is to be a cash flow statement.
 *
 * Signals (using the same vocabulary as detectSection/isFCFMarker):
 *   +4  has OPERATING section marker (операцион / operatsion)
 *   +4  has INVESTING section marker (инвестицион / investitsion)
 *   +4  has FINANCING section marker (финансов / moliyaviy)
 *   +2  has CF or FCF marker (свободный денежный поток / erkin pul oqimi / FCF)
 *   +1  row count >= 20
 */
export function scoreCashFlowCandidate(sheet) {
    if (!sheet || !sheet.rowCount) return 0;

    let hasOperating = false;
    let hasInvesting = false;
    let hasFinancing = false;
    let hasFCF = false;

    const rows = sheet.data || [];
    const rowCount = Math.min(sheet.rowCount, rows.length);

    for (let ri = 0; ri < rowCount; ri++) {
        const row = Array.isArray(rows[ri]) ? rows[ri] : (rows[ri]?.cells || []);
        if (!row || row.length === 0) continue;
        const firstCell = row[0];
        const raw = firstCell && firstCell.value ? String(firstCell.value).trim() : '';
        if (!raw) continue;
        const lower = raw.toLowerCase();

        if (!hasOperating && (lower.includes('операцион') || lower.includes('operatsion'))) {
            hasOperating = true;
        }
        if (!hasInvesting && (lower.includes('инвестицион') || lower.includes('investitsion'))) {
            hasInvesting = true;
        }
        if (!hasFinancing && (lower.includes('финансов') || lower.includes('moliyaviy'))) {
            hasFinancing = true;
        }
        if (!hasFCF && (
            lower === 'fcf' || lower === 'free cash flow' ||
            lower.includes('свободный денежный поток') ||
            lower.includes('erkin pul oqimi')
        )) {
            hasFCF = true;
        }
    }

    let score = 0;
    if (hasOperating) score += 4;
    if (hasInvesting) score += 4;
    if (hasFinancing) score += 4;
    if (hasFCF) score += 2;
    if (sheet.rowCount >= 20) score += 1;

    return score;
}

