// processors/transformers/balanceSheet.js

const { BALANCE_SHEET_MAPPING } = require('../../mappings/accountMapping');

/**
 * Balance Sheet Transformer
 * Transforms raw balance sheet data to IFRS structure
 */

/**
 * Transform extracted data to IFRS structure
 * @param {Map} dataMap - Raw data map from extractor
 * @param {Object} [mapping] - Optional mapping (DB-resolved). Defaults to file constant.
 * @returns {Object} IFRS structure
 */
function transformToIFRSStructure(dataMap, mapping) {
    const mappingToUse = mapping || BALANCE_SHEET_MAPPING;

    // Dynamically extract ALL unique section names from the mapping
    const uniqueSections = [...new Set(
        Object.values(mappingToUse).map(m => m.section)
    )];

    // Initialize sections object dynamically
    const sections = {};
    uniqueSections.forEach(sectionName => {
        sections[sectionName] = {
            name: sectionName,
            items: [],
            totalStart: 0,
            totalEnd: 0
        };
    });

    // Process each code in the mapping
    Object.keys(mappingToUse).forEach(code => {
        if (dataMap.has(code)) {
            const nsbuData = dataMap.get(code);
            const mapping = mappingToUse[code];

            // BUG-003 FIX: respect isNegative flag (accumulated depreciation, treasury stock, etc.)
            // These are contra-accounts in NSBU — their NSBU values are stored as positives
            // but must be presented as negatives in IFRS to correctly reduce the section total.
            const isNeg = mapping.isNegative === true;
            const startVal = isNeg ? -(nsbuData.start || 0) : (nsbuData.start || 0);
            const endVal = isNeg ? -(nsbuData.end || 0) : (nsbuData.end || 0);

            const item = {
                nsbuCode: code,
                label: mapping.ifrsClassification,
                start: startVal,
                end: endVal,
                isNegative: isNeg,
                isCalculated: mapping.isCalculated === true
            };

            const sectionKey = mapping.section;

            if (sections[sectionKey]) {
                sections[sectionKey].items.push(item);
                sections[sectionKey].totalStart += item.start;
                sections[sectionKey].totalEnd += item.end;
            }
        }
    });

    // BUG-004 FIX: resolve isCalculated rows (012 Net PP&E, 022 Net Intangibles).
    // These rows never appear in dataMap (the extractor reads raw NSBU rows only),
    // so they were silently dropped. We compute them here from their formula references.
    Object.keys(mappingToUse).forEach(code => {
        const mapping = mappingToUse[code];
        if (!mapping.isCalculated) return;
        if (dataMap.has(code)) return; // already processed above (shouldn't happen, but guard)

        // Parse simple binary formula: '010 - 011' or '020 - 021'
        const formulaMatch = mapping.formula && mapping.formula.match(/^(\w+)\s*([-+])\s*(\w+)$/);
        if (!formulaMatch) return;

        const [, refA, op, refB] = formulaMatch;

        // Retrieve values already placed in the sections (post-sign-correction)
        const findItemValue = (refCode, key) => {
            const refMapping = mappingToUse[refCode];
            if (!refMapping) return 0;
            const sectionItems = sections[refMapping.section]?.items || [];
            const found = sectionItems.find(i => i.label === refMapping.ifrsClassification);
            return found ? found[key] : 0;
        };

        const aStart = findItemValue(refA, 'start');
        const aEnd = findItemValue(refA, 'end');
        const bStart = findItemValue(refB, 'start');
        const bEnd = findItemValue(refB, 'end');

        const calcStart = op === '-' ? aStart - bStart : aStart + bStart;
        const calcEnd = op === '-' ? aEnd - bEnd : aEnd + bEnd;

        const item = {
            nsbuCode: code,
            label: mapping.ifrsClassification,
            start: calcStart,
            end: calcEnd,
            isCalculated: true
        };

        const sectionKey = mapping.section;
        if (sections[sectionKey]) {
            sections[sectionKey].items.push(item);
            // NOTE: do NOT add to section totals — the gross and contra rows that
            // form this net value are already reflected in the running total.
        }
    });

    // Filter out empty sections
    const sectionsArray = Object.values(sections).filter(s => s.items.length > 0);

    // Calculate grand totals dynamically
    const assetSections = sectionsArray.filter(s => s.name.includes('ASSETS'));
    const totalAssetsStart = assetSections.reduce((sum, s) => sum + s.totalStart, 0);
    const totalAssetsEnd = assetSections.reduce((sum, s) => sum + s.totalEnd, 0);

    const nonAssetSections = sectionsArray.filter(s => !s.name.includes('ASSETS'));
    const totalEquityLiabStart = nonAssetSections.reduce((sum, s) => sum + s.totalStart, 0);
    const totalEquityLiabEnd = nonAssetSections.reduce((sum, s) => sum + s.totalEnd, 0);

    return {
        sections: sectionsArray,
        totalAssetsStart,
        totalAssetsEnd,
        totalEquityLiabStart,
        totalEquityLiabEnd
    };
}

module.exports = {
    transformToIFRSStructure
};