const mongoose = require('mongoose');
const MappingSet = require('./models/mappingSet.model');
const RowMapping = require('./models/rowMapping.model');
const EquityMappingConfig = require('./models/equityMappingConfig.model');
const UserMappingOverride = require('./models/userMappingOverride.model');
const User = require('../user/model');
const { runSeed } = require('./mappingSeed');
const { invalidateCache: invalidateMappingCache } = require('../services/mappingResolver');

const REPORT_TYPES = ['balance_sheet', 'cash_flow', 'profit_loss_form2', 'equity'];
const ROW_BASED_TYPES = ['balance_sheet', 'cash_flow', 'profit_loss_form2'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function validateReportType(reportType, res) {
    if (!REPORT_TYPES.includes(reportType)) {
        res.status(400).json({
            error: 'INVALID_REPORT_TYPE',
            message: `reportType must be one of: ${REPORT_TYPES.join(', ')}`
        });
        return false;
    }
    return true;
}

async function loadSetWithItems(set) {
    if (set.reportType === 'equity') {
        const config = await EquityMappingConfig.findOne({ mappingSetId: set._id }).lean();
        return { set: set.toObject(), config };
    }
    const rows = await RowMapping.find({ mappingSetId: set._id })
        .sort({ nsbuRowCode: 1 })
        .lean();
    return { set: set.toObject(), rows };
}

// ─── MappingSet endpoints ─────────────────────────────────────────────────────

/**
 * GET /api/admin/mappings
 * List all MappingSets grouped by report type, with item counts.
 */
async function listMappingSets(req, res) {
    try {
        const sets = await MappingSet.find()
            .sort({ reportType: 1, version: -1 })
            .populate('publishedBy', 'email name')
            .populate('createdBy', 'email name')
            .lean();

        const setIds = sets.map(s => s._id);
        const rowCounts = await RowMapping.aggregate([
            { $match: { mappingSetId: { $in: setIds } } },
            { $group: { _id: '$mappingSetId', count: { $sum: 1 } } }
        ]);
        const countMap = new Map(rowCounts.map(c => [String(c._id), c.count]));

        const enriched = sets.map(s => ({
            ...s,
            itemCount: countMap.get(String(s._id)) || 0
        }));

        const grouped = REPORT_TYPES.reduce((acc, rt) => {
            acc[rt] = enriched.filter(s => s.reportType === rt);
            return acc;
        }, {});

        res.json({ success: true, sets: enriched, grouped });
    } catch (error) {
        global.logger.logError(error, { context: 'admin/listMappingSets' });
        res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to list mapping sets' });
    }
}

/**
 * GET /api/admin/mappings/:reportType/published
 * Get the currently published set for a report type, with all items.
 */
async function getPublishedSet(req, res) {
    try {
        const { reportType } = req.params;
        if (!validateReportType(reportType, res)) return;

        const set = await MappingSet.findOne({ reportType, status: 'published' });
        if (!set) {
            return res.status(404).json({
                error: 'NO_PUBLISHED_SET',
                message: `No published mapping set for ${reportType}`
            });
        }

        const data = await loadSetWithItems(set);
        res.json({ success: true, ...data });
    } catch (error) {
        global.logger.logError(error, { context: 'admin/getPublishedSet', reportType: req.params.reportType });
        res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to fetch published set' });
    }
}

/**
 * GET /api/admin/mappings/:reportType/draft
 * Get the current draft set for a report type, or 404 if none exists.
 */
async function getDraftSet(req, res) {
    try {
        const { reportType } = req.params;
        if (!validateReportType(reportType, res)) return;

        const set = await MappingSet.findOne({ reportType, status: 'draft' });
        if (!set) {
            return res.status(404).json({
                error: 'NO_DRAFT',
                message: `No draft set for ${reportType}`
            });
        }

        const data = await loadSetWithItems(set);
        res.json({ success: true, ...data });
    } catch (error) {
        global.logger.logError(error, { context: 'admin/getDraftSet', reportType: req.params.reportType });
        res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to fetch draft set' });
    }
}

/**
 * GET /api/admin/mappings/sets/:setId
 * Get a specific set by id (works for any status).
 */
async function getSetById(req, res) {
    try {
        const { setId } = req.params;
        const set = await MappingSet.findById(setId)
            .populate('publishedBy', 'email name')
            .populate('createdBy', 'email name');
        if (!set) {
            return res.status(404).json({ error: 'SET_NOT_FOUND', message: 'Mapping set not found' });
        }
        const data = await loadSetWithItems(set);
        res.json({ success: true, ...data });
    } catch (error) {
        global.logger.logError(error, { context: 'admin/getSetById', setId: req.params.setId });
        res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to fetch mapping set' });
    }
}

/**
 * POST /api/admin/mappings/:reportType/draft
 * Create a draft set for a report type by forking from the current published set.
 * If a draft already exists, returns 409.
 */
async function createDraftFromPublished(req, res) {
    try {
        const { reportType } = req.params;
        if (!validateReportType(reportType, res)) return;

        const existingDraft = await MappingSet.findOne({ reportType, status: 'draft' });
        if (existingDraft) {
            return res.status(409).json({
                error: 'DRAFT_EXISTS',
                message: 'A draft already exists for this report type',
                draftId: existingDraft._id
            });
        }

        const published = await MappingSet.findOne({ reportType, status: 'published' });
        if (!published) {
            return res.status(404).json({
                error: 'NO_PUBLISHED_SET',
                message: 'Cannot create draft: no published set exists. Run seed first.'
            });
        }

        // Next version = max existing version + 1
        const lastSet = await MappingSet.findOne({ reportType }).sort({ version: -1 });
        const newVersion = (lastSet?.version || 0) + 1;

        const draft = await MappingSet.create({
            reportType,
            version: newVersion,
            status: 'draft',
            createdBy: req.user._id,
            notes: `Forked from v${published.version}`
        });

        if (reportType === 'equity') {
            const sourceConfig = await EquityMappingConfig.findOne({ mappingSetId: published._id }).lean();
            if (sourceConfig) {
                delete sourceConfig._id;
                delete sourceConfig.createdAt;
                delete sourceConfig.updatedAt;
                await EquityMappingConfig.create({
                    ...sourceConfig,
                    mappingSetId: draft._id
                });
            }
        } else {
            const sourceRows = await RowMapping.find({ mappingSetId: published._id }).lean();
            if (sourceRows.length > 0) {
                const cloned = sourceRows.map(r => {
                    const { _id, createdAt, updatedAt, ...rest } = r;
                    return { ...rest, mappingSetId: draft._id };
                });
                await RowMapping.insertMany(cloned, { ordered: false });
            }
        }

        global.logger.logInfo(`Draft created for ${reportType} v${newVersion}`, {
            adminId: req.user._id,
            draftId: draft._id,
            forkedFrom: published._id,
            category: 'admin'
        });

        res.json({ success: true, draft: draft.toObject() });
    } catch (error) {
        global.logger.logError(error, { context: 'admin/createDraftFromPublished', reportType: req.params.reportType });
        res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to create draft' });
    }
}

/**
 * POST /api/admin/mappings/sets/:setId/publish
 * Publish a draft:
 *   - Current published for this reportType → 'archived'
 *   - This draft → 'published', publishedAt + publishedBy set
 *
 * Atomic via mongoose session/transaction (requires MongoDB replica set).
 * Falls back to sequential update if transactions are unavailable.
 */
async function publishDraft(req, res) {
    let session = null;
    try {
        const { setId } = req.params;
        const draft = await MappingSet.findById(setId);
        if (!draft) {
            return res.status(404).json({ error: 'SET_NOT_FOUND', message: 'Set not found' });
        }
        if (draft.status !== 'draft') {
            return res.status(400).json({
                error: 'NOT_A_DRAFT',
                message: `Cannot publish a set with status '${draft.status}'`
            });
        }

        const reportType = draft.reportType;

        // Try transaction first
        let useTransaction = true;
        try {
            session = await mongoose.startSession();
            session.startTransaction();
        } catch (err) {
            useTransaction = false;
            session = null;
        }

        try {
            const currentPublished = await MappingSet.findOne({ reportType, status: 'published' }, null, session ? { session } : {});
            if (currentPublished) {
                currentPublished.status = 'archived';
                await currentPublished.save(session ? { session } : undefined);
            }

            draft.status = 'published';
            draft.publishedAt = new Date();
            draft.publishedBy = req.user._id;
            if (req.body?.notes) draft.notes = req.body.notes;
            await draft.save(session ? { session } : undefined);

            if (session) await session.commitTransaction();
        } catch (innerErr) {
            if (session) {
                try { await session.abortTransaction(); } catch (_) {}
            }
            throw innerErr;
        } finally {
            if (session) session.endSession();
        }

        global.logger.logSecurity('Mapping set published', {
            adminId: req.user._id,
            adminEmail: req.user.email,
            setId: draft._id,
            reportType,
            version: draft.version,
            atomic: useTransaction
        }, 'info');

        // Invalidate resolver cache so the new mapping takes effect immediately
        invalidateMappingCache(reportType);

        res.json({ success: true, published: draft.toObject() });
    } catch (error) {
        global.logger.logError(error, { context: 'admin/publishDraft', setId: req.params.setId });
        res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to publish draft' });
    }
}

/**
 * DELETE /api/admin/mappings/sets/:setId
 * Delete a set. Only allowed for drafts and archived; published cannot be deleted.
 */
async function deleteSet(req, res) {
    try {
        const { setId } = req.params;
        const set = await MappingSet.findById(setId);
        if (!set) {
            return res.status(404).json({ error: 'SET_NOT_FOUND', message: 'Set not found' });
        }
        if (set.status === 'published') {
            return res.status(400).json({
                error: 'CANNOT_DELETE_PUBLISHED',
                message: 'Published sets cannot be deleted. Publish a new draft to supersede.'
            });
        }

        if (set.reportType === 'equity') {
            await EquityMappingConfig.deleteMany({ mappingSetId: set._id });
        } else {
            await RowMapping.deleteMany({ mappingSetId: set._id });
        }
        await set.deleteOne();

        global.logger.logSecurity('Mapping set deleted', {
            adminId: req.user._id,
            setId,
            reportType: set.reportType,
            version: set.version,
            status: set.status
        }, 'info');

        // Defensive: invalidate cache (published shouldn't be deletable, but safety)
        invalidateMappingCache(set.reportType);

        res.json({ success: true });
    } catch (error) {
        global.logger.logError(error, { context: 'admin/deleteSet', setId: req.params.setId });
        res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to delete set' });
    }
}

// ─── Row editing endpoints (within a draft) ───────────────────────────────────

function ensureDraftSet(set, res) {
    if (!set) {
        res.status(404).json({ error: 'SET_NOT_FOUND', message: 'Set not found' });
        return false;
    }
    if (set.status !== 'draft') {
        res.status(400).json({
            error: 'NOT_A_DRAFT',
            message: 'Only draft sets can be edited. Create a draft first.'
        });
        return false;
    }
    return true;
}

/**
 * POST /api/admin/mappings/sets/:setId/rows
 * Add a row to a draft (row-based report types only).
 */
async function addRow(req, res) {
    try {
        const { setId } = req.params;
        const set = await MappingSet.findById(setId);
        if (!ensureDraftSet(set, res)) return;
        if (!ROW_BASED_TYPES.includes(set.reportType)) {
            return res.status(400).json({
                error: 'WRONG_REPORT_TYPE',
                message: 'Row editing is not applicable for this report type'
            });
        }

        const payload = req.body || {};
        if (!payload.nsbuRowCode || !payload.ifrsClassification) {
            return res.status(400).json({
                error: 'MISSING_FIELDS',
                message: 'nsbuRowCode and ifrsClassification are required'
            });
        }

        const row = await RowMapping.create({
            mappingSetId: set._id,
            nsbuRowCode: payload.nsbuRowCode,
            nsbuCodes: payload.nsbuCodes || [],
            nsbuDescription: payload.nsbuDescription || '',
            ifrsClassification: payload.ifrsClassification,
            section: payload.section || '',
            subsection: payload.subsection || '',
            isNegative: !!payload.isNegative,
            isCalculated: !!payload.isCalculated,
            formula: payload.formula || null,
            flowType: payload.flowType || null,
            directMethod: typeof payload.directMethod === 'boolean' ? payload.directMethod : null,
            netCalculation: typeof payload.netCalculation === 'boolean' ? payload.netCalculation : null,
            plSection: payload.plSection || null,
            label: payload.label || '',
            accountDetails: payload.accountDetails || null,
            notes: payload.notes || ''
        });

        res.json({ success: true, row });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({
                error: 'DUPLICATE_ROW',
                message: 'A row with this nsbuRowCode already exists in this set'
            });
        }
        global.logger.logError(error, { context: 'admin/addRow', setId: req.params.setId });
        res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to add row' });
    }
}

/**
 * PATCH /api/admin/mappings/rows/:rowId
 * Update a row in a draft.
 */
async function updateRow(req, res) {
    try {
        const { rowId } = req.params;
        const row = await RowMapping.findById(rowId);
        if (!row) {
            return res.status(404).json({ error: 'ROW_NOT_FOUND', message: 'Row not found' });
        }
        const set = await MappingSet.findById(row.mappingSetId);
        if (!ensureDraftSet(set, res)) return;

        const editable = [
            'nsbuRowCode', 'nsbuCodes', 'nsbuDescription', 'ifrsClassification',
            'section', 'subsection', 'isNegative', 'isCalculated', 'formula',
            'flowType', 'directMethod', 'netCalculation', 'plSection',
            'label', 'accountDetails', 'notes'
        ];
        for (const field of editable) {
            if (field in req.body) row[field] = req.body[field];
        }
        await row.save();
        res.json({ success: true, row });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({
                error: 'DUPLICATE_ROW',
                message: 'Another row with this nsbuRowCode already exists in this set'
            });
        }
        global.logger.logError(error, { context: 'admin/updateRow', rowId: req.params.rowId });
        res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to update row' });
    }
}

/**
 * DELETE /api/admin/mappings/rows/:rowId
 */
async function deleteRow(req, res) {
    try {
        const { rowId } = req.params;
        const row = await RowMapping.findById(rowId);
        if (!row) {
            return res.status(404).json({ error: 'ROW_NOT_FOUND', message: 'Row not found' });
        }
        const set = await MappingSet.findById(row.mappingSetId);
        if (!ensureDraftSet(set, res)) return;

        await row.deleteOne();
        res.json({ success: true });
    } catch (error) {
        global.logger.logError(error, { context: 'admin/deleteRow', rowId: req.params.rowId });
        res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to delete row' });
    }
}

// ─── Equity editing ───────────────────────────────────────────────────────────

/**
 * PUT /api/admin/mappings/sets/:setId/equity
 * Replace the entire equity config for a draft equity set.
 * (Granular editing would be too noisy given the patterns/arrays nature.)
 */
async function updateEquityConfig(req, res) {
    try {
        const { setId } = req.params;
        const set = await MappingSet.findById(setId);
        if (!ensureDraftSet(set, res)) return;
        if (set.reportType !== 'equity') {
            return res.status(400).json({
                error: 'WRONG_REPORT_TYPE',
                message: 'This endpoint is only for equity sets'
            });
        }

        const { columns, bsRowToEquityColumn, movementRows, rowPatterns, columnPatterns, notes } = req.body || {};

        const update = {};
        if (Array.isArray(columns)) update.columns = columns;
        if (bsRowToEquityColumn && typeof bsRowToEquityColumn === 'object') {
            update.bsRowToEquityColumn = new Map(Object.entries(bsRowToEquityColumn));
        }
        if (Array.isArray(movementRows)) update.movementRows = movementRows;
        if (Array.isArray(rowPatterns)) update.rowPatterns = rowPatterns;
        if (Array.isArray(columnPatterns)) update.columnPatterns = columnPatterns;
        if (typeof notes === 'string') update.notes = notes;

        // Validate regex patterns compile before saving
        const allPatterns = [...(update.rowPatterns || []), ...(update.columnPatterns || [])];
        for (const p of allPatterns) {
            try {
                new RegExp(p.pattern, p.flags || 'i');
            } catch (e) {
                return res.status(400).json({
                    error: 'INVALID_REGEX',
                    message: `Pattern '${p.pattern}' for key '${p.key}' is not a valid regex: ${e.message}`
                });
            }
        }

        const config = await EquityMappingConfig.findOneAndUpdate(
            { mappingSetId: set._id },
            update,
            { new: true, upsert: true }
        );

        res.json({ success: true, config });
    } catch (error) {
        global.logger.logError(error, { context: 'admin/updateEquityConfig', setId: req.params.setId });
        res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to update equity config' });
    }
}

// ─── User overrides ───────────────────────────────────────────────────────────

/**
 * GET /api/admin/users/:userId/overrides
 * List overrides for a user.
 */
async function listUserOverrides(req, res) {
    try {
        const { userId } = req.params;
        const { reportType } = req.query;

        const filter = { userId };
        if (reportType) filter.reportType = reportType;

        const overrides = await UserMappingOverride.find(filter)
            .sort({ reportType: 1, nsbuRowCode: 1 })
            .lean();

        res.json({ success: true, overrides });
    } catch (error) {
        global.logger.logError(error, { context: 'admin/listUserOverrides', userId: req.params.userId });
        res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to list overrides' });
    }
}

/**
 * PUT /api/admin/users/:userId/overrides/:reportType/:nsbuRowCode
 * Upsert an override for a user. Admin manages overrides for users in MVP
 * (no self-service yet).
 */
async function upsertUserOverride(req, res) {
    try {
        const { userId, reportType, nsbuRowCode } = req.params;
        if (!['balance_sheet', 'cash_flow', 'profit_loss_form2'].includes(reportType)) {
            return res.status(400).json({
                error: 'INVALID_REPORT_TYPE',
                message: 'Overrides are not supported for equity'
            });
        }

        const userExists = await User.exists({ _id: userId });
        if (!userExists) {
            return res.status(404).json({ error: 'USER_NOT_FOUND', message: 'User not found' });
        }

        const payload = req.body || {};
        if (!payload.ifrsClassification) {
            return res.status(400).json({
                error: 'MISSING_FIELDS',
                message: 'ifrsClassification is required'
            });
        }

        const override = await UserMappingOverride.findOneAndUpdate(
            { userId, reportType, nsbuRowCode },
            {
                userId,
                reportType,
                nsbuRowCode,
                nsbuCodes: payload.nsbuCodes || [],
                nsbuDescription: payload.nsbuDescription || '',
                ifrsClassification: payload.ifrsClassification,
                section: payload.section || '',
                subsection: payload.subsection || '',
                isNegative: !!payload.isNegative,
                isCalculated: !!payload.isCalculated,
                formula: payload.formula || null,
                flowType: payload.flowType || null,
                directMethod: typeof payload.directMethod === 'boolean' ? payload.directMethod : null,
                netCalculation: typeof payload.netCalculation === 'boolean' ? payload.netCalculation : null,
                plSection: payload.plSection || null,
                label: payload.label || '',
                accountDetails: payload.accountDetails || null,
                notes: payload.notes || ''
            },
            { new: true, upsert: true }
        );

        res.json({ success: true, override });
    } catch (error) {
        global.logger.logError(error, { context: 'admin/upsertUserOverride' });
        res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to upsert override' });
    }
}

/**
 * DELETE /api/admin/users/:userId/overrides/:reportType/:nsbuRowCode
 */
async function deleteUserOverride(req, res) {
    try {
        const { userId, reportType, nsbuRowCode } = req.params;
        const result = await UserMappingOverride.findOneAndDelete({ userId, reportType, nsbuRowCode });
        if (!result) {
            return res.status(404).json({ error: 'OVERRIDE_NOT_FOUND', message: 'Override not found' });
        }
        res.json({ success: true });
    } catch (error) {
        global.logger.logError(error, { context: 'admin/deleteUserOverride' });
        res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to delete override' });
    }
}

// ─── Seed endpoint ────────────────────────────────────────────────────────────

/**
 * POST /api/admin/mappings/seed
 * Manually trigger seed. super_admin only.
 * Idempotent — does nothing for report types that already have a published set.
 */
async function manualSeed(req, res) {
    try {
        const results = await runSeed({ userId: req.user._id });
        global.logger.logSecurity('Manual mapping seed run', {
            adminId: req.user._id,
            adminEmail: req.user.email,
            results
        }, 'info');
        // Seed may have created new published sets — invalidate all
        invalidateMappingCache();
        res.json({ success: true, results });
    } catch (error) {
        global.logger.logError(error, { context: 'admin/manualSeed' });
        res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Seed failed' });
    }
}

module.exports = {
    listMappingSets,
    getPublishedSet,
    getDraftSet,
    getSetById,
    createDraftFromPublished,
    publishDraft,
    deleteSet,
    addRow,
    updateRow,
    deleteRow,
    updateEquityConfig,
    listUserOverrides,
    upsertUserOverride,
    deleteUserOverride,
    manualSeed
};
