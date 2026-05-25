// @ts-nocheck
/**
 * Auto-converted from src/processors/transformers/profitLossForm2.js.
 * Algorithm preserved verbatim; only module syntax was changed.
 *  keeps Phase 6 unblocked while the deep typing work is
 * deferred — every export is consumed via PROCESSOR_SERVICE which is
 * typed against IProcessorService at the boundary.
 */

// processors/transformers/profitLossForm2.js
//
// Transforms NSBU Form 2 extracted data into IFRS P&L layout descriptor.
// Layout follows the canonical NSBU Form 2 row order (010 → 270) with
// English IFRS classifications. Calculated row formulas come from the
// mapping's `formula` field — the mapping is the single source of truth.
//
// SIGN CONVENTION:
//   NSBU Form 2 stores all values as positive magnitudes. The mapping
//   marks deduction rows (cost of sales, expenses, taxes) with isNegative:
//   true. At render time we negate the values for those items so that
//   plain summation in subtotal rows produces the correct signed result.
//   The styler doesn't need to know about signs — the values it sums
//   already encode them.import {FORM2_ROW_CODES} from '../../mappings/profit-loss-form2.mapping';
export function transformForm2ToIFRS(extracted, mapping) {
    const mappingToUse = mapping || FORM2_ROW_CODES;

    global.logger.logInfo('[PL-F2 TRANSFORMER] Starting transformation');

    const { periods, dataMap, valuesArePreSigned } = extracted;
    const n = periods.length;

    const nullArr = () => new Array(n).fill(null);
    const norm = (arr) => {
        if (!arr || arr.length === 0) return nullArr();
        return arr.map(v => (v === undefined ? null : v));
    };

    const rows = [];
    // code → layout row index, populated as we render
    const codeToRowIdx = {};

    // ─── Helpers (closures over rows, codeToRowIdx, dataMap, etc.) ───────────

    function hasNonNullValue(arr) {
        return Array.isArray(arr) && arr.some(v => v != null && v !== 0);
    }

    function pushSection(label) {
        rows.push({ type: 'title', label });
    }

    function pushItemIfPresent(code) {
        const row = dataMap[code];
        if (!row) return false;
        const def = mappingToUse[code];
        if (!def) return false;

        const labelText = def.ifrsClassification || def.label || row.label || code;
        // Apply sign convention only if extractor didn't already produce signed
        // values. Two-axis source layouts compute net = income - expense, so
        // values are already correctly signed; applying isNegative again would
        // double-negate.
        const sign = (def.isNegative === true && !valuesArePreSigned) ? -1 : 1;
        const rawValues = norm(row.values);
        const signedValues = rawValues.map(v => v == null ? null : sign * v);

        codeToRowIdx[code] = rows.length;
        rows.push({
            type: 'item',
            label: labelText,
            values: signedValues,
            nsbuCode: code,
            isNegative: def.isNegative === true,
        });
        return true;
    }

    function pushCalculatedFromMapping(code, displayLabel) {
        const def = mappingToUse[code];
        if (!def) return;

        codeToRowIdx[code] = rows.length;
        rows.push({
            type: 'calculated',
            label: displayLabel,
            nsbuCode: code,
            // addRefs filled in second pass after all rows are placed
            addRefs: [],
        });
    }

    // ─── Render rows in canonical NSBU Form 2 order ──────────────────────────

    pushSection('I. REVENUE');
    pushItemIfPresent('010');
    rows.push({ type: 'blank' });

    pushSection('II. COST OF SALES');
    pushItemIfPresent('020');
    rows.push({ type: 'blank' });

    // 030 = Gross profit (010 + 020 — sign already applied to 020)
    pushCalculatedFromMapping('030', 'III. GROSS PROFIT');
    rows.push({ type: 'blank' });

    // Period expenses section — only render if any sub-item present
    const anyOpex = !!(dataMap['050'] || dataMap['060'] || dataMap['070'] || dataMap['080']);
    if (anyOpex) {
        pushSection('IV. PERIOD EXPENSES');
        pushItemIfPresent('050');
        pushItemIfPresent('060');
        pushItemIfPresent('070');
        pushItemIfPresent('080');
        // 040 = total period expenses
        pushCalculatedFromMapping('040', 'Total period expenses');
        rows.push({ type: 'blank' });
    }

    if (dataMap['090']) {
        pushSection('V. OTHER OPERATING INCOME');
        pushItemIfPresent('090');
        rows.push({ type: 'blank' });
    }

    // 100 = Operating profit (030 + 040 + 090; signs baked in)
    pushCalculatedFromMapping('100', 'VI. OPERATING PROFIT / (LOSS)');
    rows.push({ type: 'blank' });

    const anyFinanceIncome = !!(dataMap['120'] || dataMap['130'] || dataMap['140'] ||
                                dataMap['150'] || dataMap['160']);
    if (anyFinanceIncome) {
        pushSection('VII. FINANCE INCOME');
        pushItemIfPresent('120');
        pushItemIfPresent('130');
        pushItemIfPresent('140');
        pushItemIfPresent('150');
        pushItemIfPresent('160');
        pushCalculatedFromMapping('110', 'Total finance income');
        rows.push({ type: 'blank' });
    }

    const anyFinanceCost = !!(dataMap['180'] || dataMap['190'] || dataMap['200'] || dataMap['210']);
    if (anyFinanceCost) {
        pushSection('VIII. FINANCE COSTS');
        pushItemIfPresent('180');
        pushItemIfPresent('190');
        pushItemIfPresent('200');
        pushItemIfPresent('210');
        pushCalculatedFromMapping('170', 'Total finance costs');
        rows.push({ type: 'blank' });
    }

    // 220 = Profit from operations and finance (100 + 110 + 170)
    // Signs already baked into 170's items, so this sums correctly.
    pushCalculatedFromMapping('220', 'IX. PROFIT FROM OPERATIONS AND FINANCE');
    rows.push({ type: 'blank' });

    // 230 = Other gains/losses (only render if non-zero in source)
    if (dataMap['230'] && hasNonNullValue(dataMap['230'].values)) {
        pushSection('X. OTHER GAINS / (LOSSES)');
        pushItemIfPresent('230');
        rows.push({ type: 'blank' });
    }

    // 240 = Profit before tax
    pushCalculatedFromMapping('240', 'XI. PROFIT BEFORE TAX');
    rows.push({ type: 'blank' });

    if (dataMap['250'] || dataMap['260']) {
        pushSection('XII. INCOME TAX');
        pushItemIfPresent('250');
        pushItemIfPresent('260');
        rows.push({ type: 'blank' });
    }

    // 270 = Net profit
    pushCalculatedFromMapping('270', 'XIII. NET PROFIT / (LOSS)');

    // ─── Second pass: resolve calculated rows' formulas into addRefs ─────────
    // Walk each `calculated` row, look up its formula in the mapping, and
    // translate operand codes into layout row indices. Codes not present in
    // codeToRowIdx (i.e., the underlying item wasn't in dataMap) are silently
    // skipped — the calculated row will just sum what's available.
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (row.type !== 'calculated') continue;

        const def = mappingToUse[row.nsbuCode];
        if (!def || !def.formula) continue;

        row.addRefs = resolveFormulaToAddRefs(def.formula, codeToRowIdx);
    }

    global.logger.logInfo(`[PL-F2 TRANSFORMER] valuesArePreSigned: ${valuesArePreSigned}`);
    global.logger.logInfo(`[PL-F2 TRANSFORMER] Output rows: ${rows.length}, mapped codes: ${Object.keys(codeToRowIdx).length}`);

    // No named refs needed — formula resolution uses layout indices only.
    return { periods, rows, namedRefs: {} };
}

/**
 * Walk a structured formula and collect layout row indices for each operand
 * code. Signs are NOT applied here — they're baked into the stored item
 * values via isNegative handling at render time, so plain summation works.
 *
 * Formula AST shapes:
 *   { op: 'add', operands: [code1, code2, ...] }
 *   { op: 'subtract', operands: [a, b] }     — second operand should be isNegative in mapping
 *   { op: 'negate', operand: code }          — operand should be isNegative in mapping
 *   { op: 'compose', operands: [...] }       — flatten all operands
 */
export function resolveFormulaToAddRefs(formula, codeToRowIdx) {
    const refs = [];
    walkFormula(formula, codeToRowIdx, refs);
    return refs;
}

export function walkFormula(node, codeToRowIdx, out) {
    if (!node) return;

    if (typeof node === 'string') {
        const idx = codeToRowIdx[node];
        if (idx !== undefined) out.push(idx);
        return;
    }

    if (typeof node === 'object' && node.op) {
        const operands = node.operands || (node.operand !== undefined ? [node.operand] : []);
        for (const operand of operands) {
            walkFormula(operand, codeToRowIdx, out);
        }
    }
}

