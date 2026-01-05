// processors/transformers/cashFlow.js

const { CASH_FLOW_MAPPING } = require('../../mappings/cashFlowMapping');

/**
 * Cash Flow Transformer
 * Transforms raw cash flow data to IFRS structure
 */

/**
 * Transform extracted data to IFRS structure
 * @param {Map} dataMap - Raw data map from extractor
 * @returns {Object} IFRS structure
 */
function transformToIFRSCashFlow(dataMap) {
    // Initialize sections
    const sections = {
        'OPERATING ACTIVITIES': {
            name: 'OPERATING ACTIVITIES',
            items: [],
            subtotal: 0
        },
        'INVESTING ACTIVITIES': {
            name: 'INVESTING ACTIVITIES',
            items: [],
            subtotal: 0
        },
        'FINANCING ACTIVITIES': {
            name: 'FINANCING ACTIVITIES',
            items: [],
            subtotal: 0
        },
        'RECONCILIATION': {
            name: 'RECONCILIATION',
            items: [],
            subtotal: 0
        }
    };

    // Process each mapped line
    Object.keys(CASH_FLOW_MAPPING).forEach(lineCode => {
        const mapping = CASH_FLOW_MAPPING[lineCode];
        const nsbuData = dataMap.get(lineCode);

        // Skip if no data found for this line
        if (!nsbuData) return;

        // Determine the amount based on flow type
        let amount = 0;

        if (mapping.flowType === 'inflow') {
            amount = nsbuData.inflow || nsbuData.netAmount;
        } else if (mapping.flowType === 'outflow') {
            amount = -(nsbuData.outflow || Math.abs(nsbuData.netAmount));
        } else if (mapping.flowType === 'net' || mapping.netCalculation) {
            amount = nsbuData.netAmount;
        } else if (mapping.flowType === 'subtotal' || mapping.flowType === 'total') {
            amount = nsbuData.netAmount;
        } else if (mapping.flowType === 'balance') {
            amount = nsbuData.netAmount || nsbuData.inflow;
        } else if (mapping.flowType === 'adjustment') {
            amount = nsbuData.netAmount;
        }

        const item = {
            lineCode: lineCode,
            label: mapping.ifrsClassification,
            amount: amount,
            flowType: mapping.flowType,
            isCalculated: mapping.isCalculated || false
        };

        sections[mapping.section].items.push(item);

        // Add to section subtotal (exclude calculated subtotals)
        if (!mapping.isCalculated && mapping.flowType !== 'subtotal' &&
            mapping.flowType !== 'total' && mapping.section !== 'RECONCILIATION') {
            sections[mapping.section].subtotal += amount;
        }
    });

    // Calculate section totals
    const operatingTotal = sections['OPERATING ACTIVITIES'].subtotal;
    const investingTotal = sections['INVESTING ACTIVITIES'].subtotal;
    const financingTotal = sections['FINANCING ACTIVITIES'].subtotal;

    // Get reconciliation values
    const fxEffects = dataMap.get('221')?.netAmount || 0;
    const cashBeginning = dataMap.get('230')?.netAmount || dataMap.get('230')?.inflow || 0;

    // Calculate net change in cash
    const netChange = operatingTotal + investingTotal + financingTotal;

    // Calculate ending cash
    const cashEnding = cashBeginning + netChange + fxEffects;

    return {
        sections: Object.values(sections).filter(s => s.items.length > 0),
        operatingTotal,
        investingTotal,
        financingTotal,
        netChange,
        fxEffects,
        cashBeginning,
        cashEnding
    };
}

module.exports = {
    transformToIFRSCashFlow
};