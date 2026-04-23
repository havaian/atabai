// backend/src/files/transformationEnrichment.js
// Joins stored transformation JSON with live mapping metadata at read time,
// so mapping improvements apply retroactively without rewriting stored JSONs.

'use strict';

const { BALANCE_SHEET_MAPPING } = require('../mappings/accountMapping');

/**
 * Enrich a stored transformation JSON with mapping metadata.
 * Throws TEMPLATE_NOT_SUPPORTED for templates that don't have an enricher yet.
 *
 * @param {string} templateType
 * @param {Object} transformationJson - parsed contents of the .transformation.json file
 * @returns {Object} enriched transformation (same shape with source.rows[].mapping attached)
 */
function enrichTransformation(templateType, transformationJson) {
    switch (templateType) {
        case 'balanceSheet':
            return enrichBalanceSheet(transformationJson);
        case 'cashFlow':
        case 'profitLoss':
        case 'profitLossForm2':
        case 'equity':
            // Will be implemented in later steps as each processor learns to produce
            // result.transformation. For now, signal the caller to respond accordingly.
            {
                const err = new Error(`Template '${templateType}' transformation enrichment not yet implemented`);
                err.code = 'TEMPLATE_NOT_SUPPORTED';
                throw err;
            }
        default:
            {
                const err = new Error(`Unknown template type: ${templateType}`);
                err.code = 'UNKNOWN_TEMPLATE';
                throw err;
            }
    }
}

function enrichBalanceSheet(json) {
    const enrichedRows = (json.source?.rows || []).map(row => {
        const mapping = BALANCE_SHEET_MAPPING[row.nsbuCode] || null;

        const mappingSummary = mapping ? {
            ifrsClassification: mapping.ifrsClassification,
            section: mapping.section,
            subsection: mapping.subsection,
            nsbuDescription: mapping.nsbuDescription,
            isNegative: mapping.isNegative === true,
            isCalculated: mapping.isCalculated === true,
            accountDetails: mapping.accountDetails || null,
            formula: mapping.formula || null
        } : null;

        return { ...row, mapping: mappingSummary };
    });

    return {
        ...json,
        source: {
            ...json.source,
            rows: enrichedRows
        }
        // target is returned as-is; it's already in the shape the frontend needs
    };
}

module.exports = { enrichTransformation };