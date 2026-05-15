const mongoose = require('mongoose');

/**
 * RowMapping — single NSBU row code mapping to IFRS classification.
 *
 * Used for: balance_sheet, cash_flow, profit_loss_form2
 * (NOT used for equity — see EquityMappingConfig)
 *
 * Each row belongs to a MappingSet (which carries the version/status).
 *
 * Supports three row types:
 *   1. Direct mapping:   `nsbuCodes` lists source account codes
 *   2. Calculated:       `isCalculated=true`, `formula` describes computation
 *   3. Negative:         `isNegative=true` — value is subtracted in totals
 */
const rowMappingSchema = new mongoose.Schema({
    mappingSetId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MappingSet',
        required: true,
        index: true
    },

    // NSBU row code as it appears on the form (e.g., '010', '012', '460')
    nsbuRowCode: {
        type: String,
        required: true,
        trim: true
    },

    // Source NSBU account codes that feed this row.
    // For calculated rows, contains ['calculated'] or is empty.
    nsbuCodes: {
        type: [String],
        default: []
    },

    nsbuDescription: {
        type: String,
        default: ''
    },

    // IFRS target
    ifrsClassification: {
        type: String,
        required: true
    },

    // Section in the IFRS output (e.g., 'ASSETS - NON-CURRENT', 'OPERATING ACTIVITIES')
    section: {
        type: String,
        default: ''
    },

    // Subsection within section (optional, e.g., 'Property, Plant & Equipment')
    subsection: {
        type: String,
        default: ''
    },

    // Sign / behavior flags
    isNegative: {
        type: Boolean,
        default: false
    },
    isCalculated: {
        type: Boolean,
        default: false
    },

    // Formula for calculated rows. Two supported forms:
    //   - Legacy string form:  "010 - 011"
    //   - Structured form:     { op: 'subtract', operands: ['010', '020'] }
    //                          { op: 'add', operands: [{op:'add',operands:['050','060']}, '070'] }
    // Both are kept as Mixed because the existing files use different shapes.
    formula: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },

    // Cash flow specific: 'inflow' | 'outflow' | 'net'
    flowType: {
        type: String,
        default: null
    },

    // Cash flow specific
    directMethod: {
        type: Boolean,
        default: null
    },
    netCalculation: {
        type: Boolean,
        default: null
    },

    // P/L Form 2 specific: 'revenue' | 'cogs' | 'gross' | 'opex' | ...
    plSection: {
        type: String,
        default: null
    },

    // Display label (for UI; falls back to ifrsClassification)
    label: {
        type: String,
        default: ''
    },

    // Detailed account breakdown (preserved from accountMapping.js)
    accountDetails: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },

    // Free-form admin notes
    notes: {
        type: String,
        default: ''
    }
}, {
    timestamps: true
});

// One row code per set
rowMappingSchema.index({ mappingSetId: 1, nsbuRowCode: 1 }, { unique: true });

module.exports = mongoose.model('RowMapping', rowMappingSchema);
