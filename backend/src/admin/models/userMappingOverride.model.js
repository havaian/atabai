const mongoose = require('mongoose');

/**
 * UserMappingOverride — per-user customization of a mapping row.
 *
 * Resolution order at transformation time:
 *   1. UserMappingOverride (this collection) — if exists for (userId, reportType, nsbuRowCode)
 *   2. RowMapping in current published MappingSet for reportType
 *   3. Otherwise: unmapped, logged in transformation.json
 *
 * Overrides are NOT versioned — they always apply on top of whatever global
 * version is currently published.
 *
 * Only used for row-based mappings (balance_sheet, cash_flow, profit_loss_form2).
 * Equity overrides are not supported in MVP — its schema is too different.
 */
const userMappingOverrideSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    reportType: {
        type: String,
        required: true,
        enum: ['balance_sheet', 'cash_flow', 'profit_loss_form2']
    },
    nsbuRowCode: {
        type: String,
        required: true,
        trim: true
    },

    // Same shape as RowMapping (minus mappingSetId)
    nsbuCodes: {
        type: [String],
        default: []
    },
    nsbuDescription: { type: String, default: '' },
    ifrsClassification: { type: String, required: true },
    section: { type: String, default: '' },
    subsection: { type: String, default: '' },
    isNegative: { type: Boolean, default: false },
    isCalculated: { type: Boolean, default: false },
    formula: { type: mongoose.Schema.Types.Mixed, default: null },
    flowType: { type: String, default: null },
    directMethod: { type: Boolean, default: null },
    netCalculation: { type: Boolean, default: null },
    plSection: { type: String, default: null },
    label: { type: String, default: '' },
    accountDetails: { type: mongoose.Schema.Types.Mixed, default: null },
    notes: { type: String, default: '' }
}, {
    timestamps: true
});

// One override per (user, reportType, nsbuRowCode)
userMappingOverrideSchema.index(
    { userId: 1, reportType: 1, nsbuRowCode: 1 },
    { unique: true }
);

module.exports = mongoose.model('UserMappingOverride', userMappingOverrideSchema);
