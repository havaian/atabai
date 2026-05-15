const mongoose = require('mongoose');

/**
 * EquityMappingConfig — special configuration for the equity report type.
 *
 * Unlike balance/cashflow/p&l (row-code → IFRS classification), the equity
 * mapping consists of:
 *   - A set of IFRS equity columns (each backed by zero or more NSBU rows)
 *   - A set of IFRS movement rows (additions / reductions / totals)
 *   - Regex patterns to detect rows and columns in NSBU Form 4 files
 *
 * One config document = the entire equity configuration for a given MappingSet.
 * (i.e. there is exactly one EquityMappingConfig per equity MappingSet.)
 */
const equityMappingConfigSchema = new mongoose.Schema({
    mappingSetId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MappingSet',
        required: true,
        unique: true,
        index: true
    },

    // IFRS equity columns (Share Capital, Retained Earnings, ...)
    // Order of items dictates output column order.
    columns: [{
        _id: false,
        key: {
            type: String,
            required: true
        },
        label: {
            type: String,
            required: true
        },
        nsbuRows: {
            type: [String],
            default: []
        },
        isNegative: {
            type: Boolean,
            default: false
        },
        isCalculated: {
            type: Boolean,
            default: false
        }
    }],

    // Balance sheet row → equity column (used when deriving from balance sheet)
    bsRowToEquityColumn: {
        type: Map,
        of: String,
        default: () => new Map()
    },

    // Movement rows in IFRS Statement of Changes in Equity.
    // Order dictates output row order.
    movementRows: [{
        _id: false,
        key: {
            type: String,
            required: true
        },
        label: {
            type: String,
            required: true
        },
        isTotal: {
            type: Boolean,
            default: false
        }
    }],

    // Regex patterns (stored as source strings) for detecting Form 4 row labels.
    // Stored as string so admin can edit them; compiled at use site.
    rowPatterns: [{
        _id: false,
        key: {
            type: String,
            required: true
        },
        pattern: {
            type: String,
            required: true
        },
        flags: {
            type: String,
            default: 'i'
        }
    }],

    // Regex patterns for detecting Form 4 column headers.
    columnPatterns: [{
        _id: false,
        key: {
            type: String,
            required: true
        },
        pattern: {
            type: String,
            required: true
        },
        flags: {
            type: String,
            default: 'i'
        }
    }],

    notes: {
        type: String,
        default: ''
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('EquityMappingConfig', equityMappingConfigSchema);
