// processors/extractors/profitLoss.js
// Extracts NSBU profit & loss data via two-pass section boundary detection.
// Handles both simple (PL_2) and complex nested (PL_1) NSBU structures.

'use strict';

// Month names used for period column detection
const MONTH_LABELS = [
    'янв', 'фев', 'мар', 'апр', 'май', 'июн',
    'июл', 'авг', 'сен', 'окт', 'ноя', 'дек',
    'январь', 'февраль', 'март', 'апрель', 'июнь', 'июль',
    'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь',
    'jan', 'feb', 'mar', 'apr', 'may', 'jun',
    'jul', 'aug', 'sep', 'oct', 'nov', 'dec'
];

// ─── Aggregate/total row labels to skip in revenue section ───────────────────
// These are subtotal/grouping labels, not individual project items
const REVENUE_SKIP_PATTERNS = [
    /^ДОХОДЫ/i,
    /^Субподряд$/i,
    /^Внешний Заказчик$/i,
    /^Внешний Заказчик[- ]/i,
    /^Проекты завершающиеся/i,
    /^Проекты не учтенные/i,
    /^Доходы от ген/i,        // "Доходы от генуслуг" header/subtotal row - sub-items collected individually
    /^Ген услуги/i,           // PL_2 gen services aggregate header
    /\(ВГО\)/i,               // Intercompany eliminations (e.g. "Кранчи (ВГО)") - excluded from totals in source
    // NOTE: "Генуслуги, 3%" and "Генуслуги, 5%" are NOT skipped - they are leaf revenue items
];

// ─── Aggregate/total row labels to skip in COGS section ──────────────────────
const COGS_SKIP_PATTERNS = [
    /^РАСХОДЫ/i,
    /^ПРЯМЫЕ РАСХОДЫ/i,
    /^Субподрядные работы/i,
    /^Субподряд$/i,
    /^Внешний Заказчик/i,
    /^Проекты завершающиеся/i,
    /^Проекты не учтенные/i,
    /^Сырье и материалы/i,
    /^Расходы на технику/i,
    /^Производственный персонал/i,
    /^ФОТ строителей/i,
    /^ЕСП строителей/i,
    /^Валовая прибыль/i,
    /^ВАЛОВАЯ ПРИБЫЛЬ/i,
    /\(ВГО\)/i,               // Intercompany eliminations (e.g. "Кранчи (ВГО)", "БТБС (ВГО)") - excluded from totals in source
];

// ─── Globally skip regardless of section ─────────────────────────────────────
const GLOBAL_SKIP_PATTERNS = [
    /^%$/,
    /^EBITDA/i,
    /^Налогооблагаемая база/i,
    /^Чистая прибыль/i,
    /^Всего расходы/i,
    /^SG&A/i,
];

// ─── Section header markers (trigger state transitions) ──────────────────────
const SECTION_MARKERS = {
    revenue: /^ДОХОДЫ/i,
    cogs: /^(РАСХОДЫ|ПРЯМЫЕ РАСХОДЫ)/i,
    overhead: /^Накладные проекта/i,
    admin: /^Административно-хозяйственные/i,
    otherIncome: /^Прочие доходы/i,
    incomeTax: /^Налог на прибыль/i,
    genServices1: /^Ген услуги/i,
    genServices2: /^Доходы от генуслуг/i,
    // "Прочие операционные расходы" - can be section header (PL_1) OR admin item (PL_2)
    otherOpLabel: /^Прочие операционные расходы/i,
};

// ─── Overhead / admin item classifiers ───────────────────────────────────────
const ITEM_TYPE = {
    isFOT: (label) => /ФОТ|Фонд оплаты труда/i.test(label),
    isESP: (label) => /^ЕСП/i.test(label),
    isDepreciation: (label) => /Амортизация/i.test(label),
    isVehicle: (label) => /ГСМ|автотранспорт|Аренда транспорта/i.test(label),
    // Overhead subtotals to skip within the overhead section
    isOverheadAggregate: (label) => /^Накладные расходы проекта/i.test(label),
};

/**
 * Resolve raw cell value, handling formula objects.
 * @param {*} raw
 * @returns {string|number|null}
 */
function resolveValue(raw) {
    if (raw === null || raw === undefined) return null;
    if (typeof raw === 'object') {
        // ExcelJS formula cell: { formula: '...', result: N }
        if (raw.result !== undefined) return raw.result;
        if (raw.value !== undefined) return raw.value;
        if (raw instanceof Date) return raw;
        return null;
    }
    return raw;
}

/**
 * Return true if the label should be skipped based on a list of patterns.
 */
function matchesAny(label, patterns) {
    return patterns.some((p) => p.test(label));
}

/**
 * Build a getCellValue function and rows array from the normalized sheet.
 */
function buildSheetAccessor(sheet) {
    let rows, rowCount, getCellValue, getCellMeta;

    const _emptyMeta = () => ({ value: null, bold: false, indent: 0 });

    if (sheet.data && Array.isArray(sheet.data)) {
        rows = sheet.data;
        rowCount = rows.length;
        if (rowCount > 0 && rows[0]) {
            if (!Array.isArray(rows[0]) && rows[0].cells) {
                // { cells: [...] } format
                getCellValue = (ri, ci) => {
                    if (ri >= rows.length) return null;
                    const row = rows[ri];
                    if (!row || !row.cells) return null;
                    const cell = row.cells[ci];
                    return cell ? resolveValue(cell.value) : null;
                };
                getCellMeta = (ri, ci) => {
                    if (ri >= rows.length) return _emptyMeta();
                    const row = rows[ri];
                    if (!row || !row.cells) return _emptyMeta();
                    const cell = row.cells[ci];
                    if (!cell) return _emptyMeta();
                    return { value: resolveValue(cell.value), bold: cell.bold ?? false, indent: cell.indent ?? 0 };
                };
            } else if (Array.isArray(rows[0])) {
                // [[cell, cell, ...], ...] format
                getCellValue = (ri, ci) => {
                    if (ri >= rows.length) return null;
                    const row = rows[ri];
                    if (!Array.isArray(row) || ci >= row.length) return null;
                    const cell = row[ci];
                    if (cell && typeof cell === 'object') {
                        return resolveValue(cell.value !== undefined ? cell.value : cell);
                    }
                    return cell !== undefined ? cell : null;
                };
                getCellMeta = (ri, ci) => {
                    if (ri >= rows.length) return _emptyMeta();
                    const row = rows[ri];
                    if (!Array.isArray(row) || ci >= row.length) return _emptyMeta();
                    const cell = row[ci];
                    if (!cell || typeof cell !== 'object') return _emptyMeta();
                    return {
                        value: resolveValue(cell.value !== undefined ? cell.value : cell),
                        bold: cell.bold ?? false,
                        indent: cell.indent ?? 0,
                    };
                };
            } else {
                throw new Error('[PL EXTRACTOR] Unknown sheet.data row structure');
            }
        } else {
            getCellValue = () => null;
            getCellMeta = () => _emptyMeta();
        }
    } else if (sheet.rows && Array.isArray(sheet.rows)) {
        rows = sheet.rows;
        rowCount = rows.length;
        getCellValue = (ri, ci) => {
            if (ri >= rows.length) return null;
            const row = rows[ri];
            if (!row || !row.cells) return null;
            const cell = row.cells[ci];
            return cell ? resolveValue(cell.value) : null;
        };
        getCellMeta = (ri, ci) => {
            if (ri >= rows.length) return _emptyMeta();
            const row = rows[ri];
            if (!row || !row.cells) return _emptyMeta();
            const cell = row.cells[ci];
            if (!cell) return _emptyMeta();
            return { value: resolveValue(cell.value), bold: cell.bold ?? false, indent: cell.indent ?? 0 };
        };
    } else {
        throw new Error('[PL EXTRACTOR] Unable to read sheet structure');
    }

    return { rows, rowCount, getCellValue, getCellMeta };
}

/**
 * Detect which columns are period columns (month names) and return
 * an array of { label, colIndex }.
 */
function detectPeriods(rowCount, getCellValue) {
    for (let ri = 0; ri < Math.min(15, rowCount); ri++) {
        const periods = [];
        for (let ci = 1; ci < 30; ci++) {
            const val = getCellValue(ri, ci);
            if (val === null || val === undefined) continue;
            const str = String(val).trim().toLowerCase();
            if (MONTH_LABELS.includes(str)) {
                periods.push({ label: String(val).trim(), colIndex: ci });
            }
        }
        if (periods.length >= 3) {
            global.logger.logInfo(`[PL EXTRACTOR] Found ${periods.length} period columns at row ${ri}`);
            return periods;
        }
    }
    global.logger.logWarn('[PL EXTRACTOR] No period columns detected, defaulting to single column B');
    return [{ label: 'Total', colIndex: 1 }];
}

/**
 * Pass 1: scan all rows and return section boundary row indices.
 * Returns an object with numeric row indices (or -1 when not found).
 */
function findSectionBoundaries(rowCount, getCellValue) {
    const bounds = {
        revStart: -1,
        cogsStart: -1,
        overheadStart: -1,
        adminStart: -1,
        otherOpSection: -1,   // 'Прочие операционные расходы' as a section header (PL_1)
        otherIncomeStart: -1,
        incomeTaxRow: -1,
        genServicesRow: -1,   // row holding the gen services total value
    };

    // Collect all occurrences of otherOp label to decide section vs item
    const otherOpRows = [];

    for (let ri = 0; ri < rowCount; ri++) {
        const rawLabel = getCellValue(ri, 0);
        if (!rawLabel) continue;
        const label = String(rawLabel).trim();
        if (!label) continue;

        if (bounds.revStart === -1 && SECTION_MARKERS.revenue.test(label)) {
            bounds.revStart = ri;
        } else if (bounds.cogsStart === -1 && SECTION_MARKERS.cogs.test(label)) {
            bounds.cogsStart = ri;
        } else if (bounds.overheadStart === -1 && SECTION_MARKERS.overhead.test(label)) {
            bounds.overheadStart = ri;
        } else if (bounds.adminStart === -1 && SECTION_MARKERS.admin.test(label)) {
            bounds.adminStart = ri;
        } else if (bounds.otherIncomeStart === -1 && SECTION_MARKERS.otherIncome.test(label)) {
            bounds.otherIncomeStart = ri;
        } else if (bounds.incomeTaxRow === -1 && SECTION_MARKERS.incomeTax.test(label)) {
            bounds.incomeTaxRow = ri;
        }

        // Gen services: capture the row (use first match of either pattern)
        if (bounds.genServicesRow === -1) {
            if (SECTION_MARKERS.genServices1.test(label) || SECTION_MARKERS.genServices2.test(label)) {
                bounds.genServicesRow = ri;
            }
        }

        // Collect all 'Прочие операционные расходы' rows
        if (SECTION_MARKERS.otherOpLabel.test(label)) {
            otherOpRows.push(ri);
        }
    }

    // Determine if any 'Прочие операционные расходы' is a section header.
    // Heuristic: if it appears >= 5 rows after adminStart, it's a section header (PL_1 pattern).
    // Otherwise it's just an item within admin (PL_2 pattern).
    for (const row of otherOpRows) {
        if (bounds.adminStart !== -1 && row > bounds.adminStart + 5) {
            bounds.otherOpSection = row;
            break;
        }
    }

    global.logger.logInfo('[PL EXTRACTOR] Section boundaries:', JSON.stringify(bounds));
    return bounds;
}

/**
 * Extract label + formatting metadata from column 0 of a row.
 * Returns null if the cell is empty.
 */
function getLabelMeta(ri, getCellMeta) {
    const meta = getCellMeta(ri, 0);
    if (!meta.value) return null;
    const str = String(meta.value).trim();
    if (!str) return null;
    return { label: str, bold: meta.bold, indent: meta.indent };
}

/**
 * Extract label from a row as a clean string, or null.
 * Kept for functions that don't need formatting (overhead/admin collectors).
 */
function getLabel(ri, getCellValue) {
    const raw = getCellValue(ri, 0);
    if (!raw) return null;
    const str = String(raw).trim();
    return str || null;
}

/**
 * Extract numeric values for the period columns from a given row.
 * Returns an array of numbers (null for empty/missing cells).
 */
function extractRowValues(ri, periods, getCellValue) {
    return periods.map(({ colIndex }) => {
        const raw = getCellValue(ri, colIndex);
        if (raw === null || raw === undefined) return null;
        const num = typeof raw === 'number' ? raw : parseFloat(raw);
        return isNaN(num) ? null : num;
    });
}

/**
 * Collect project-level items from a row range.
 *
 * Detection priority:
 *   1. Bold font  -> subheader/aggregate row. Rendered as label only, NOT included in sum.
 *   2. Hardcoded skip patterns -> safety net for poorly-formatted files without bold.
 *   3. Everything else -> leaf item, included in sum.
 *
 * Returns items: { name, values, isSubheader }
 *   isSubheader: true  -> rendered as subheader label, values empty, never summed
 *   isSubheader: false -> rendered as data row, values included in Total formula
 */
function collectProjectItems(fromRow, toRow, periods, getCellValue, getCellMeta, sectionSkipPatterns) {
    const items = [];
    for (let ri = fromRow; ri < toRow; ri++) {
        const labelMeta = getLabelMeta(ri, getCellMeta);
        if (!labelMeta) continue;
        const { label, bold } = labelMeta;

        // Always skip global patterns (EBITDA totals, % rows, etc.)
        if (matchesAny(label, GLOBAL_SKIP_PATTERNS)) continue;

        // Hidden helper rows (value exactly -1)
        const firstVal = getCellValue(ri, periods[0]?.colIndex ?? 1);
        if (firstVal === -1) continue;

        // Bold = aggregate/subheader row (primary, formatting-based signal)
        if (bold) {
            // Still drop top-level section aggregates to avoid polluting label list
            if (matchesAny(label, sectionSkipPatterns)) continue;
            // Subheader: visual label only, no numeric values, not summed
            items.push({ name: label, values: [], isSubheader: true });
            continue;
        }

        // Hardcoded skip patterns: fallback for non-bold aggregates in poorly-formatted files
        if (matchesAny(label, sectionSkipPatterns)) continue;

        const values = extractRowValues(ri, periods, getCellValue);
        items.push({ name: label, values, isSubheader: false });
    }
    return items;
}

/**
 * Classify and accumulate overhead section items into IFRS buckets.
 * Returns: { fot, esp, depreciation, other } each as array of period values.
 */
function collectOverheadItems(fromRow, toRow, periods, getCellValue) {
    const n = periods.length;
    const result = {
        fot: new Array(n).fill(null),
        esp: new Array(n).fill(null),
        depreciation: new Array(n).fill(null),
        other: new Array(n).fill(null),
    };

    for (let ri = fromRow; ri < toRow; ri++) {
        const label = getLabel(ri, getCellValue);
        if (!label) continue;
        if (matchesAny(label, GLOBAL_SKIP_PATTERNS)) continue;
        if (ITEM_TYPE.isOverheadAggregate(label)) continue;
        if (SECTION_MARKERS.overhead.test(label)) continue; // section header

        const values = extractRowValues(ri, periods, getCellValue);
        const bucket = ITEM_TYPE.isFOT(label) ? 'fot'
            : ITEM_TYPE.isESP(label) ? 'esp'
                : ITEM_TYPE.isDepreciation(label) ? 'depreciation'
                    : 'other';

        for (let i = 0; i < n; i++) {
            if (values[i] !== null) {
                result[bucket][i] = (result[bucket][i] ?? 0) + values[i];
            }
        }
    }
    return result;
}

/**
 * Classify and accumulate admin section items.
 * Returns: { fot, esp, vehicles, depreciation, other } each as array of period values.
 */
function collectAdminItems(fromRow, toRow, periods, getCellValue) {
    const n = periods.length;
    const result = {
        fot: new Array(n).fill(null),
        esp: new Array(n).fill(null),
        vehicles: new Array(n).fill(null),
        depreciation: new Array(n).fill(null),
        other: new Array(n).fill(null),
    };

    for (let ri = fromRow; ri < toRow; ri++) {
        const label = getLabel(ri, getCellValue);
        if (!label) continue;
        if (matchesAny(label, GLOBAL_SKIP_PATTERNS)) continue;
        if (SECTION_MARKERS.admin.test(label)) continue; // section header
        if (/^SG&A/i.test(label)) continue; // PL_1 meta-total
        // Skip the 'Прочие операционные расходы' row itself IF it is a section header (toRow stops before it)

        const values = extractRowValues(ri, periods, getCellValue);
        const bucket = ITEM_TYPE.isFOT(label) ? 'fot'
            : ITEM_TYPE.isESP(label) ? 'esp'
                : ITEM_TYPE.isVehicle(label) ? 'vehicles'
                    : ITEM_TYPE.isDepreciation(label) ? 'depreciation'
                        : 'other';

        for (let i = 0; i < n; i++) {
            if (values[i] !== null) {
                result[bucket][i] = (result[bucket][i] ?? 0) + values[i];
            }
        }
    }
    return result;
}

/**
 * Collect items from the 'Прочие операционные расходы' section (PL_1 only).
 * Depreciaton items go to depreciation bucket; everything else to other.
 * Returns: { depreciation, other }
 */
function collectOtherOpItems(fromRow, toRow, periods, getCellValue) {
    const n = periods.length;
    const result = {
        depreciation: new Array(n).fill(null),
        other: new Array(n).fill(null),
    };

    for (let ri = fromRow; ri < toRow; ri++) {
        const label = getLabel(ri, getCellValue);
        if (!label) continue;
        if (matchesAny(label, GLOBAL_SKIP_PATTERNS)) continue;
        if (SECTION_MARKERS.otherOpLabel.test(label)) continue; // section header itself

        const values = extractRowValues(ri, periods, getCellValue);
        const bucket = ITEM_TYPE.isDepreciation(label) ? 'depreciation' : 'other';

        for (let i = 0; i < n; i++) {
            if (values[i] !== null) {
                result[bucket][i] = (result[bucket][i] ?? 0) + values[i];
            }
        }
    }
    return result;
}

/**
 * Collect items from the 'Прочие доходы' section (finance/other income items).
 */
function collectOtherIncomeItems(fromRow, toRow, periods, getCellValue) {
    const items = [];
    for (let ri = fromRow; ri < toRow; ri++) {
        const label = getLabel(ri, getCellValue);
        if (!label) continue;
        if (matchesAny(label, GLOBAL_SKIP_PATTERNS)) continue;
        if (SECTION_MARKERS.otherIncome.test(label)) continue; // section header

        const values = extractRowValues(ri, periods, getCellValue);
        items.push({ name: label, values });
    }
    return items;
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Extract all P&L data from a normalized sheet.
 * @param {Object} sheet - Normalized sheet from readExcelFile
 * @returns {Object} Extracted data ready for the transformer
 */
function extractProfitLossData(sheet) {
    global.logger.logInfo('[PL EXTRACTOR] Starting extraction');

    const { rows, rowCount, getCellValue, getCellMeta } = buildSheetAccessor(sheet);
    global.logger.logInfo(`[PL EXTRACTOR] Total rows: ${rowCount}`);

    // ── Period detection ──────────────────────────────────────────────────────
    const periods = detectPeriods(rowCount, getCellValue);
    const n = periods.length;

    // ── Pass 1: section boundaries ────────────────────────────────────────────
    const bounds = findSectionBoundaries(rowCount, getCellValue);

    // Fallbacks so the slice logic below always works
    const revStart = bounds.revStart >= 0 ? bounds.revStart : 0;
    const cogsStart = bounds.cogsStart >= 0 ? bounds.cogsStart : revStart + 1;
    const overheadStart = bounds.overheadStart >= 0 ? bounds.overheadStart : cogsStart + 1;
    const adminStart = bounds.adminStart >= 0 ? bounds.adminStart : overheadStart + 1;

    // Admin ends at either otherOpSection, otherIncomeStart, incomeTaxRow, or rowCount
    const adminEnd = bounds.otherOpSection >= 0 ? bounds.otherOpSection
        : bounds.otherIncomeStart >= 0 ? bounds.otherIncomeStart
            : bounds.incomeTaxRow >= 0 ? bounds.incomeTaxRow
                : rowCount;

    // otherOp section range (only applies if otherOpSection was found)
    const otherOpEnd = bounds.otherIncomeStart >= 0 ? bounds.otherIncomeStart
        : bounds.incomeTaxRow >= 0 ? bounds.incomeTaxRow
            : rowCount;

    // otherIncome range
    const otherIncomeEnd = bounds.incomeTaxRow >= 0 ? bounds.incomeTaxRow : rowCount;

    // ── Pass 2: data collection ───────────────────────────────────────────────

    // Revenue items (leaf project items, including ВГО adjustments)
    const revenueItems = collectProjectItems(
        revStart + 1, cogsStart, periods, getCellValue, getCellMeta, REVENUE_SKIP_PATTERNS
    );
    global.logger.logInfo(`[PL EXTRACTOR] Revenue items: ${revenueItems.length}`);

    // COGS items
    const cogsItems = collectProjectItems(
        cogsStart + 1, overheadStart, periods, getCellValue, getCellMeta, COGS_SKIP_PATTERNS
    );
    global.logger.logInfo(`[PL EXTRACTOR] COGS items: ${cogsItems.length}`);

    // Gen services value (single row)
    let genServices = null;
    if (bounds.genServicesRow >= 0) {
        genServices = extractRowValues(bounds.genServicesRow, periods, getCellValue);
        global.logger.logInfo('[PL EXTRACTOR] Gen services captured');
    }

    // Project overhead (IV.A)
    const overhead = collectOverheadItems(
        overheadStart + 1, adminStart, periods, getCellValue
    );
    global.logger.logInfo('[PL EXTRACTOR] Overhead collected');

    // Admin expenses (IV.B)
    // Admin collection ends at adminEnd (before 'Прочие операционные расходы' section or income/tax)
    const admin = collectAdminItems(
        adminStart + 1, adminEnd, periods, getCellValue
    );
    global.logger.logInfo('[PL EXTRACTOR] Admin collected');

    // Other operating (PL_1 section after admin, if present)
    let otherOp = null;
    if (bounds.otherOpSection >= 0) {
        otherOp = collectOtherOpItems(
            bounds.otherOpSection + 1, otherOpEnd, periods, getCellValue
        );
        global.logger.logInfo('[PL EXTRACTOR] Other operating section collected');
    }

    // Merge otherOp depreciation and other into admin buckets
    if (otherOp) {
        for (let i = 0; i < n; i++) {
            if (otherOp.depreciation[i] !== null) {
                overhead.depreciation[i] = (overhead.depreciation[i] ?? 0) + otherOp.depreciation[i];
            }
            if (otherOp.other[i] !== null) {
                admin.other[i] = (admin.other[i] ?? 0) + otherOp.other[i];
            }
        }
    }

    // Aggregate all depreciation from overhead + admin into single D&A array
    const depreciation = new Array(n).fill(null);
    for (let i = 0; i < n; i++) {
        const v = (overhead.depreciation[i] ?? 0) + (admin.depreciation[i] ?? 0);
        depreciation[i] = v !== 0 ? v : null;
    }

    // Other income items (finance income, Прочие доходы)
    const financeIncomeItems = bounds.otherIncomeStart >= 0
        ? collectOtherIncomeItems(bounds.otherIncomeStart + 1, otherIncomeEnd, periods, getCellValue)
        : [];

    // Income tax
    let incomeTax = null;
    if (bounds.incomeTaxRow >= 0) {
        incomeTax = extractRowValues(bounds.incomeTaxRow, periods, getCellValue);
    }

    // Metadata (company name from first non-empty row before period header)
    let companyName = '';
    for (let ri = 0; ri < Math.min(5, rowCount); ri++) {
        const val = getCellValue(ri, 0);
        if (val && typeof val === 'string' && val.trim().length > 0) {
            companyName = val.trim();
            break;
        }
    }

    global.logger.logInfo('[PL EXTRACTOR] Extraction complete');

    return {
        metadata: { companyName, period: '' },
        periods,
        columnCount: n,
        revenueItems,
        cogsItems,
        genServices,
        overheadFOT: overhead.fot,
        overheadESP: overhead.esp,
        overheadOther: overhead.other,
        adminFOT: admin.fot,
        adminESP: admin.esp,
        adminVehicles: admin.vehicles,
        adminOther: admin.other,
        depreciation,
        financeIncomeItems,
        incomeTax,
    };
}

module.exports = { extractProfitLossData };