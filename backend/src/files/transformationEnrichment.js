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
        case 'profitLossForm2':
            return enrichProfitLossForm2(transformationJson);
        case 'cashFlow':
            return enrichCashFlow(transformationJson);
        case 'profitLoss':
            return enrichProfitLoss(transformationJson);
        case 'equity':
            return enrichEquity(transformationJson);
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

function enrichProfitLossForm2(json) {
    const enrichedRows = (json.source?.rows || []).map(row => {
        const mapping = FORM2_ROW_CODES[row.nsbuCode] || null;

        const mappingSummary = mapping ? {
            ifrsClassification: mapping.ifrsClassification,
            section: mapping.section,
            nsbuDescription: mapping.nsbuDescription,
            isNegative: mapping.isNegative === true,
        } : null;

        return { ...row, mapping: mappingSummary };
    });

    return {
        ...json,
        source: {
            ...json.source,
            rows: enrichedRows,
        },
        // target returned as-is — already in the shape the frontend needs
    };
}

/**
 * Cash flow enricher.
 *
 * Unlike balance sheet and Form 2, cashFlow source rows are not keyed by
 * NSBU code — they're keyed by synthetic identifiers (section_subsection_label).
 * The classification is already encoded in the `section` field on each row,
 * which serves as the "mapping" for visual purposes.
 *
 * No additional metadata join is performed; this is effectively a passthrough.
 * Kept as a distinct function so future improvements (e.g., fuzzy-matching
 * lineItem text to CASH_FLOW_MAPPING.nsbuDescription for tooltip enrichment)
 * have a single place to land.
 */
function enrichCashFlow(json) {
    return json;
}

/**
 * Equity enricher.
 *
 * Equity has its own classification system (equity columns) that's already
 * encoded in the source rows via `columnKey` (balanceSheet path) or per-row
 * `values` map (form4 path). No additional metadata join needed.
 *
 * Passthrough; reserved for future tooltip enrichments.
 */
function enrichEquity(json) {
    return json;
}

module.exports = { enrichTransformation };