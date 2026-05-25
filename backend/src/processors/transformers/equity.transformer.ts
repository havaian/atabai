// @ts-nocheck
/**
 * Auto-converted from src/processors/transformers/equity.js.
 * Algorithm preserved verbatim; only module syntax was changed.
 *  keeps Phase 6 unblocked while the deep typing work is
 * deferred — every export is consumed via PROCESSOR_SERVICE which is
 * typed against IProcessorService at the boundary.
 */

// processors/transformers/equity.js
// Transforms extracted equity data into the IFRS Statement of Changes in Equity
// layout descriptor consumed by the equity styler.
//
// Handles two source types:
//   'balanceSheet' — only opening/closing available; net change computed
//   'form4'        — full movement breakdown availableimport {EQUITY_COLUMNS, EQUITY_MOVEMENT_ROWS} from '../../mappings/equity.mapping';
/**
 * Build the layout descriptor for the equity statement.
 *
 * @param {Object} extracted - Output of extractEquityData()
 * @returns {Object} Layout descriptor with columns, rows, companyName
 */
export function transformToIFRSEquity(extracted) {
    global.logger.logInfo('[EQUITY TRANSFORMER] Starting transformation');
    global.logger.logInfo(`[EQUITY TRANSFORMER] Source type: ${extracted.type}`);

    if (extracted.type === 'balanceSheet') {
        return transformFromBalanceSheet(extracted);
    }
    return transformFromForm4(extracted);
}

// ─── Balance sheet source (opening / closing only) ────────────────────────────

export function transformFromBalanceSheet(extracted) {
    const { equityData, companyName } = extracted;

    // Compute totals
    const totalStart = EQUITY_COLUMNS
        .filter(c => !c.isCalculated)
        .reduce((sum, c) => sum + (equityData[c.key]?.start || 0), 0);
    const totalEnd = EQUITY_COLUMNS
        .filter(c => !c.isCalculated)
        .reduce((sum, c) => sum + (equityData[c.key]?.end || 0), 0);

    // Build simplified rows: opening, net change, closing
    const outputRows = [
        {
            key: 'openingBalance',
            label: 'Balance at beginning of period',
            isTotal: true,
            values: buildColumnValues(equityData, 'start', totalStart),
        },
        {
            key: 'netChange',
            label: 'Net change during the period',
            isTotal: false,
            values: buildColumnValues(equityData, 'change', totalEnd - totalStart),
        },
        {
            key: 'closingBalance',
            label: 'Balance at end of period',
            isTotal: true,
            values: buildColumnValues(equityData, 'end', totalEnd),
        },
    ];

    const sourceNote = 'Sourced from balance sheet opening/closing balances. Upload a dedicated Form 4 file for full movement breakdown.';

    global.logger.logInfo('[EQUITY TRANSFORMER] Balance sheet transformation complete');

    return {
        columns: EQUITY_COLUMNS,
        rows: outputRows,
        companyName,
        sourceNote,
        sourceType: 'balanceSheet',
    };
}

export function buildColumnValues(equityData, valueType, totalValue) {
    const values = {};
    EQUITY_COLUMNS.forEach(col => {
        if (col.isCalculated) {
            values[col.key] = totalValue;
            return;
        }
        const entry = equityData[col.key] || { start: 0, end: 0 };
        if (valueType === 'start') values[col.key] = entry.start;
        if (valueType === 'end') values[col.key] = entry.end;
        if (valueType === 'change') values[col.key] = entry.end - entry.start;
    });
    return values;
}

// ─── Form 4 source (full movements) ──────────────────────────────────────────

export function transformFromForm4(extracted) {
    const { movements, companyName } = extracted;

    const outputRows = [];

    for (const movDef of EQUITY_MOVEMENT_ROWS) {
        const movData = movements[movDef.key];
        if (!movData) continue;

        // Check if this movement row has any non-null values
        const hasData = EQUITY_COLUMNS.some(col => {
            if (col.isCalculated) return false;
            return movData[col.key] !== null && movData[col.key] !== 0;
        });

        // Always include opening/closing/total rows even if zero; skip empty intermediate rows
        if (!hasData && !movDef.isTotal) continue;

        // Compute total column value
        const rowTotal = EQUITY_COLUMNS
            .filter(c => !c.isCalculated)
            .reduce((sum, c) => sum + (movData[c.key] || 0), 0);

        const values = {};
        EQUITY_COLUMNS.forEach(col => {
            values[col.key] = col.isCalculated ? rowTotal : (movData[col.key] || 0);
        });

        outputRows.push({
            key: movDef.key,
            label: movDef.label,
            isTotal: movDef.isTotal,
            values,
        });
    }

    global.logger.logInfo(`[EQUITY TRANSFORMER] Form 4 transformation complete. Output rows: ${outputRows.length}`);

    return {
        columns: EQUITY_COLUMNS,
        rows: outputRows,
        companyName,
        sourceNote: null,
        sourceType: 'form4',
    };
}

