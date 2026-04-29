// processors/profitLoss.js
// Orchestrates the P&L processing pipeline:
//   readExcelFile → extractor → transformer → styler

'use strict';

const { readExcelFile, pickBestSheet } = require('./readers/excelReader');
const { extractProfitLossData, scoreBudgetPLCandidate } = require('./extractors/profitLoss');
const { transformToIFRSProfitLoss } = require('./transformers/profitLoss');
const { styleProfitLossReport } = require('./stylers/profitLoss');

/**
 * Process a Profit & Loss report from NSBU format to IFRS format.
 *
 * @param {string|Buffer|ExcelJS.Workbook} input - File path, buffer, or workbook
 * @returns {Object} { workbook, summary }
 */
async function processProfitLossTemplate(input) {
    const result = {
        workbook: null,
        summary: {
            transformations: 0,
            changes: 0,
            originalRows: 0,
            processedRows: 0,
            worksheets: [],
            warnings: [],
        },
    };

    try {
        // ── Step 1: Read ──────────────────────────────────────────────────────
        const normalizedWorkbook = await readExcelFile(input);

        if (normalizedWorkbook.sheetCount === 0) {
            throw new Error('No worksheets found in the file');
        }

        const sheet = pickBestSheet(normalizedWorkbook, scoreBudgetPLCandidate, {
            minScore: 7, // at least revenue (+4) + cogs (+4) = 8; bar slightly lower
            label: 'budget P&L',
        });
        global.logger.logInfo('[PL PROCESSOR] File read, processing first sheet');

        // ── Step 2: Extract ───────────────────────────────────────────────────
        const extracted = extractProfitLossData(sheet);

        // ── Step 3: Transform ─────────────────────────────────────────────────
        const ifrsLayout = transformToIFRSProfitLoss(extracted);

        // ── Step 4: Style ─────────────────────────────────────────────────────
        const styledData = {
            title: 'PROFIT & LOSS STATEMENT (IFRS)',
            companyName: extracted.metadata.companyName || '',
            periods: ifrsLayout.periods,
            rows: ifrsLayout.rows,
            namedRefs: ifrsLayout.namedRefs,
        };

        result.workbook = await styleProfitLossReport(styledData);

        // ── Summary ───────────────────────────────────────────────────────────
        result.summary.transformations = extracted.revenueItems.length + extracted.cogsItems.length;
        result.summary.changes = ifrsLayout.rows.filter((r) => r.type === 'item').length;
        result.summary.originalRows = extracted.revenueItems.length + extracted.cogsItems.length;
        result.summary.processedRows = ifrsLayout.rows.length;

        // Transformation data for before/after diff view — persisted by controller
        // as sibling JSON.
        result.transformation = buildProfitLossTransformation(extracted, ifrsLayout, styledData);

        return result;

    } catch (error) {
        global.logger.logError('[PL PROCESSOR] Error:', error.message);
        throw new Error(`Failed to process P&L statement: ${error.message}`);
    }
}

/**
 * Build the transformation JSON payload for a budget-format P&L.
 *
 * Source-side: budget P&L extractor doesn't use NSBU codes — items are
 * collected into named buckets (revenueItems, cogsItems, overheadFOT,
 * overheadESP, overheadOther, adminFOT, etc.). For the diff view we
 * flatten all buckets into a single rows list, tagging each with the
 * category it came from.
 *
 * Target-side: same `rows[]` shape as Form 2 (mixed types).
 */
function buildProfitLossTransformation(extracted, ifrsLayout, styledData) {
    const periods = ifrsLayout.periods || [];
    const periodCount = periods.length;

    // ── Source side — flatten all buckets ────────────────────────────────────
    const sourceRows = [];

    // Revenue items
    (extracted.revenueItems || []).forEach(item => {
        if (item.isSubheader) {
            sourceRows.push({
                category: 'REVENUE',
                label: item.name || '',
                isSubheader: true,
                values: new Array(periodCount).fill(null),
            });
        } else {
            sourceRows.push({
                category: 'REVENUE',
                label: item.name || '',
                isSubheader: false,
                values: Array.isArray(item.values)
                    ? item.values.map(v => v == null ? null : Number(v))
                    : new Array(periodCount).fill(null),
            });
        }
    });

    // COGS items
    (extracted.cogsItems || []).forEach(item => {
        if (item.isSubheader) {
            sourceRows.push({
                category: 'COGS',
                label: item.name || '',
                isSubheader: true,
                values: new Array(periodCount).fill(null),
            });
        } else {
            sourceRows.push({
                category: 'COGS',
                label: item.name || '',
                isSubheader: false,
                values: Array.isArray(item.values)
                    ? item.values.map(v => v == null ? null : Number(v))
                    : new Array(periodCount).fill(null),
            });
        }
    });

    // Overhead buckets — aggregated arrays (no individual items, just totals)
    const overheadBuckets = [
        { key: 'overheadFOT', label: 'Project overhead — FOT (payroll)' },
        { key: 'overheadESP', label: 'Project overhead — ESP (social tax)' },
        { key: 'overheadOther', label: 'Project overhead — Other' },
    ];
    overheadBuckets.forEach(b => {
        const values = extracted[b.key];
        if (!values || !values.some(v => v != null && v !== 0)) return;
        sourceRows.push({
            category: 'OVERHEAD',
            label: b.label,
            isSubheader: false,
            values: values.map(v => v == null ? null : Number(v)),
        });
    });

    // Admin buckets
    const adminBuckets = [
        { key: 'adminFOT', label: 'Administrative — FOT (payroll)' },
        { key: 'adminESP', label: 'Administrative — ESP (social tax)' },
        { key: 'adminVehicles', label: 'Administrative — Vehicles' },
        { key: 'adminOther', label: 'Administrative — Other' },
    ];
    adminBuckets.forEach(b => {
        const values = extracted[b.key];
        if (!values || !values.some(v => v != null && v !== 0)) return;
        sourceRows.push({
            category: 'ADMIN',
            label: b.label,
            isSubheader: false,
            values: values.map(v => v == null ? null : Number(v)),
        });
    });

    // Depreciation
    if (extracted.depreciation && extracted.depreciation.some(v => v != null && v !== 0)) {
        sourceRows.push({
            category: 'D&A',
            label: 'Depreciation and amortization',
            isSubheader: false,
            values: extracted.depreciation.map(v => v == null ? null : Number(v)),
        });
    }

    // Finance income items
    (extracted.financeIncomeItems || []).forEach(item => {
        sourceRows.push({
            category: 'FINANCE/OTHER',
            label: item.name || '',
            isSubheader: false,
            values: Array.isArray(item.values)
                ? item.values.map(v => v == null ? null : Number(v))
                : new Array(periodCount).fill(null),
        });
    });

    // Income tax
    if (extracted.incomeTax && extracted.incomeTax.some(v => v != null && v !== 0)) {
        sourceRows.push({
            category: 'TAX',
            label: 'Income tax',
            isSubheader: false,
            values: extracted.incomeTax.map(v => v == null ? null : Number(v)),
        });
    }

    // ── Target side — resolve formula refs (same logic as Form 2) ────────────
    const targetRows = resolveCalculatedRows(ifrsLayout.rows, ifrsLayout.namedRefs, periodCount);

    return {
        version: 1,
        template: 'profitLoss',
        generatedAt: new Date().toISOString(),
        source: {
            metadata: {
                companyName: extracted.metadata?.companyName || '',
                period: extracted.metadata?.period || '',
            },
            periods,
            rows: sourceRows,
        },
        target: {
            title: styledData.title,
            periods,
            rows: targetRows,
        },
    };
}

/**
 * Shared resolver for transformer rows that have formula refs (sumRange,
 * addRefs). Mutates a copy and returns target rows ready to display.
 *
 * NOTE: This is the same logic as in profitLossForm2's buildForm2Transformation.
 * Duplicated here intentionally — extracting to a shared helper would couple
 * profitLoss.js and profitLossForm2.js, both of which need to be changeable
 * independently. The duplication is small (~30 lines) and its risks are low.
 */
function resolveCalculatedRows(rawRows, namedRefs, periodCount) {
    const resolved = rawRows.map(r => ({ ...r }));
    const named = namedRefs || {};

    const valuesAt = (idx) => {
        const row = resolved[idx];
        if (!row || !Array.isArray(row.values)) return new Array(periodCount).fill(0);
        return row.values.map(v => v == null ? 0 : v);
    };

    const resolveRef = (ref) => {
        if (typeof ref === 'number') return ref;
        if (typeof ref === 'string') return named[ref] != null ? named[ref] : -1;
        return -1;
    };

    for (let i = 0; i < resolved.length; i++) {
        const row = resolved[i];

        if (row.type === 'total' && row.sumRange) {
            const sums = new Array(periodCount).fill(0);
            for (let j = row.sumRange.from; j < row.sumRange.to; j++) {
                const inner = resolved[j];
                if (!inner || !Array.isArray(inner.values)) continue;
                const sign = inner.isNegative ? -1 : 1;
                for (let p = 0; p < periodCount; p++) {
                    sums[p] += sign * (inner.values[p] || 0);
                }
            }
            row.values = sums;
        } else if (row.type === 'calculated' && Array.isArray(row.addRefs)) {
            const sums = new Array(periodCount).fill(0);
            for (const ref of row.addRefs) {
                const idx = resolveRef(ref);
                if (idx < 0) continue;
                const v = valuesAt(idx);
                for (let p = 0; p < periodCount; p++) {
                    sums[p] += (v[p] || 0);
                }
            }
            row.values = sums;
        }
    }

    return resolved.map(r => {
        const out = { type: r.type };
        if (r.label !== undefined) out.label = r.label;
        if (Array.isArray(r.values)) out.values = r.values;
        if (r.isNegative === true) out.isNegative = true;
        return out;
    });
}

module.exports = { processProfitLossTemplate };