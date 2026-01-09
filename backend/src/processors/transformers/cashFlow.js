// processors/transformers/cashFlow.js

/**
 * Cash Flow Transformer - Enhanced Version
 * Transforms detailed line items to IFRS structure with intelligent grouping
 */

function transformToIFRSCashFlow(dataMap) {
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
        }
    };

    // Group items by classification
    const groupedItems = {
        'OPERATING ACTIVITIES': {},
        'INVESTING ACTIVITIES': {},
        'FINANCING ACTIVITIES': {}
    };

    // Extract section totals
    const operatingTotal = dataMap.get('operating_section_total')?.netAmount || 0;
    const investingTotal = dataMap.get('investing_section_total')?.netAmount || 0;
    const financingTotal = dataMap.get('financing_section_total')?.netAmount || 0;

    // Process all line items
    for (const [key, value] of dataMap.entries()) {
        // Skip section headers and subsection totals
        if (value.itemType === 'section_header' || value.itemType === 'subsection_total') {
            continue;
        }

        if (value.itemType === 'line_item') {
            const section = value.section;
            const classification = value.classification;

            // Group items by classification
            if (!groupedItems[section][classification]) {
                groupedItems[section][classification] = {
                    classification: classification,
                    items: [],
                    total: 0,
                    flowType: value.flowType
                };
            }

            groupedItems[section][classification].items.push({
                name: value.originalName,
                amount: value.netAmount
            });
            groupedItems[section][classification].total += value.netAmount;
        }
    }

    // Convert grouped items to section items
    for (const [sectionName, classifications] of Object.entries(groupedItems)) {
        const sortedClassifications = Object.entries(classifications).sort((a, b) => {
            // Sort inflows before outflows
            if (a[1].flowType === 'inflow' && b[1].flowType === 'outflow') return -1;
            if (a[1].flowType === 'outflow' && b[1].flowType === 'inflow') return 1;
            // Then by absolute amount (descending)
            return Math.abs(b[1].total) - Math.abs(a[1].total);
        });

        for (const [classification, data] of sortedClassifications) {
            const amount = data.total;

            // Main classification line
            sections[sectionName].items.push({
                label: classification,
                amount: amount,
                flowType: data.flowType,
                isGroupHeader: data.items.length > 1
            });

            // Add detail items as sub-items (indented)
            if (data.items.length > 1) {
                data.items.forEach(item => {
                    sections[sectionName].items.push({
                        label: item.name,
                        amount: item.amount,
                        flowType: data.flowType,
                        isSubItem: true,
                        indent: 1
                    });
                });
            }

            sections[sectionName].subtotal += amount;
        }
    }

    // Calculate totals
    const netChange = operatingTotal + investingTotal + financingTotal;
    const fxEffects = 0;
    const cashBeginning = 0;
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