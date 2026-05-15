const mongoose = require('mongoose');

/**
 * MappingSet — versioned container of mappings for a single report type.
 *
 * Lifecycle:
 *   - 'draft'     : being edited by admin; not used for transformation
 *   - 'published' : currently applied to transformations
 *   - 'archived'  : previous published version, kept for rollback
 *
 * Invariants enforced at application level (not via DB constraints):
 *   - At most ONE 'published' set per reportType
 *   - At most ONE 'draft' set per reportType
 *
 * Report types:
 *   - balance_sheet
 *   - cash_flow         (covers Form 1 and Form 2)
 *   - profit_loss_form2
 *   - equity            (uses different item schema — see EquityMappingConfig)
 */
const mappingSetSchema = new mongoose.Schema({
    reportType: {
        type: String,
        required: true,
        enum: ['balance_sheet', 'cash_flow', 'profit_loss_form2', 'equity'],
        index: true
    },
    version: {
        type: Number,
        required: true,
        min: 1
    },
    status: {
        type: String,
        required: true,
        enum: ['draft', 'published', 'archived'],
        default: 'draft',
        index: true
    },
    notes: {
        type: String,
        default: ''
    },
    publishedAt: {
        type: Date,
        default: null
    },
    publishedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true
});

// Common query patterns
mappingSetSchema.index({ reportType: 1, status: 1 });
mappingSetSchema.index({ reportType: 1, version: -1 });

module.exports = mongoose.model('MappingSet', mappingSetSchema);
