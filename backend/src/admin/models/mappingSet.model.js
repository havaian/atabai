const mongoose = require('mongoose');

/**
 * MappingSet — versioned container of mappings for a single report type.
 *
 * Lifecycle:
 *   - 'draft'     : being edited by admin; not used for transformation
 *   - 'published' : currently applied to transformations
 *   - 'archived'  : previous published version, kept for rollback
 *
 * Scope (assignedUsers):
 *   - [] (empty)     : GLOBAL set — applied to any user that has no
 *                      user-specific published set for this reportType
 *   - [userId, ...]  : USER-SPECIFIC set — only used for the listed users
 *
 * Resolution order at transformation time (see services/mappingResolver):
 *   1. published user-specific set whose assignedUsers contains the user
 *   2. published global set (assignedUsers empty)
 *
 * Invariants enforced at application level:
 *   - At most ONE 'published' GLOBAL set per reportType
 *   - At most ONE 'draft' set per (reportType, scope) combination
 *   - A user cannot have TWO published user-specific sets for the same
 *     reportType simultaneously (enforced at publish time)
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
    // Per-user assignment. Empty array = global set (default — backwards
    // compatible with all existing mapping sets that pre-date this feature).
    // When non-empty, only these users will pick up this set during file
    // transformation.
    assignedUsers: {
        type: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }],
        default: []
    },
    // Optional human-readable label so admins can distinguish multiple
    // user-specific sets in the list view (e.g. "Bank X custom chart").
    label: {
        type: String,
        default: ''
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
// Speed up resolution for "find user-specific published set for user X"
mappingSetSchema.index({ reportType: 1, status: 1, assignedUsers: 1 });

module.exports = mongoose.model('MappingSet', mappingSetSchema);
