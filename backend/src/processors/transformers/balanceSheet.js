// processors/transformers/balanceSheetTransformer.js

const { BALANCE_SHEET_MAPPING } = require('../../mappings/accountMapping');

/**
 * Balance Sheet Transformer
 * Transforms raw balance sheet data to IFRS structure
 */

/**
 * Transform extracted data to IFRS structure
 * @param {Map} dataMap - Raw data map from extractor
 * @returns {Object} IFRS structure
 */
function transformToIFRSStructure(dataMap) {
    // Dynamically extract ALL unique section names from the mapping
    const uniqueSections = [...new Set(
        Object.values(BALANCE_SHEET_MAPPING).map(m => m.section)
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
    Object.keys(BALANCE_SHEET_MAPPING).forEach(code => {
        if (dataMap.has(code)) {
            const nsbuData = dataMap.get(code);
            const mapping = BALANCE_SHEET_MAPPING[code];

            const item = {
                label: mapping.ifrsClassification,
                start: nsbuData.start || 0,
                end: nsbuData.end || 0
            };

            const sectionKey = mapping.section;

            if (sections[sectionKey]) {
                sections[sectionKey].items.push(item);
                sections[sectionKey].totalStart += item.start;
                sections[sectionKey].totalEnd += item.end;
            }
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