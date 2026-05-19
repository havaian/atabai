const MappingSet = require('./models/mappingSet.model');
const RowMapping = require('./models/rowMapping.model');
const EquityMappingConfig = require('./models/equityMappingConfig.model');
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
            // Populate assignedUsers so the admin UI can display "set X is for
            // bank@example.com and audit@example.com" without a separate fetch.
            // Project minimal fields to keep payload small.
            .populate('assignedUsers', 'email name')
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
            .populate('createdBy', 'email name')
            .populate('assignedUsers', 'email name');
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
/**
 * POST /api/admin/mappings/:reportType/draft
 * Create a draft set for a report type by forking the current GLOBAL published
 * set (the one with empty assignedUsers). This is the "standard" path used
 * when admin wants to change the mapping that applies to all users without
 * a custom assignment.
 *
 * For forking a user-specific set or creating a blank user-specific draft,
 * see forkSet and createBlankDraft below.
 */
async function createDraftFromPublished(req, res) {
    try {
        const { reportType } = req.params;
        if (!validateReportType(reportType, res)) return;

        // Only one draft of the global set can exist at a time. User-specific
        // drafts are tracked separately (they have non-empty assignedUsers).
        const existingDraft = await MappingSet.findOne({
            reportType,
            status: 'draft',
            assignedUsers: { $size: 0 }
        });
        if (existingDraft) {
            return res.status(409).json({
                error: 'DRAFT_EXISTS',
                message: 'A draft of the global set already exists for this report type',
                draftId: existingDraft._id
            });
        }

        // Fork the GLOBAL published set, not a user-specific one. There can be
        // at most one such set per reportType (enforced at publish time).
        const published = await MappingSet.findOne({
            reportType,
            status: 'published',
            assignedUsers: { $size: 0 }
        });
        if (!published) {
            return res.status(404).json({
                error: 'NO_PUBLISHED_SET',
                message: 'Cannot create draft: no published global set exists. Run seed first.'
            });
        }

        await cloneSetIntoNewDraft(published, req.user._id, res);
    } catch (error) {
        global.logger.logError(error, { context: 'admin/createDraftFromPublished', reportType: req.params.reportType });
        res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to create draft' });
    }
}

/**
 * POST /api/admin/mappings/sets/:setId/fork
 * Fork an arbitrary set (published or archived) into a new draft. Used when
 * admin wants to create a new version of a specific user-specific set, or
 * to start a new user-specific set from an existing global baseline.
 *
 * Body (optional):
 *   - assignedUsers: [userId] — override the scope of the new draft
 *   - label: string           — override the human label
 *
 * If body fields are omitted, the source set's scope/label are copied.
 */
async function forkSet(req, res) {
    try {
        const { setId } = req.params;
        const source = await MappingSet.findById(setId);
        if (!source) {
            return res.status(404).json({ error: 'SET_NOT_FOUND', message: 'Source set not found' });
        }
        if (source.status === 'draft') {
            return res.status(400).json({
                error: 'CANNOT_FORK_DRAFT',
                message: 'Cannot fork a draft — drafts are edited directly.'
            });
        }

        const overrideAssigned = Array.isArray(req.body?.assignedUsers)
            ? req.body.assignedUsers
            : null;
        const overrideLabel = typeof req.body?.label === 'string' ? req.body.label : null;

        await cloneSetIntoNewDraft(source, req.user._id, res, {
            assignedUsersOverride: overrideAssigned,
            labelOverride: overrideLabel
        });
    } catch (error) {
        global.logger.logError(error, { context: 'admin/forkSet', setId: req.params.setId });
        res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to fork set' });
    }
}

/**
 * POST /api/admin/mappings/:reportType/blank-draft
 * Create an empty draft (no rows / empty equity config) — typically used to
 * start a fresh user-specific mapping set from scratch instead of forking.
 *
 * Body:
 *   - assignedUsers: [userId] (required, non-empty — blank global drafts make
 *     no sense; use the seed flow for that)
 *   - label: string (optional human-readable name)
 */
async function createBlankDraft(req, res) {
    try {
        const { reportType } = req.params;
        if (!validateReportType(reportType, res)) return;

        const assignedUsers = Array.isArray(req.body?.assignedUsers) ? req.body.assignedUsers : [];
        if (assignedUsers.length === 0) {
            return res.status(400).json({
                error: 'MISSING_ASSIGNED_USERS',
                message: 'Blank drafts must be scoped to one or more users. To recreate the global set, use the seed flow.'
            });
        }

        const lastSet = await MappingSet.findOne({ reportType }).sort({ version: -1 });
        const newVersion = (lastSet?.version || 0) + 1;

        const draft = await MappingSet.create({
            reportType,
            version: newVersion,
            status: 'draft',
            assignedUsers,
            label: req.body?.label || '',
            notes: 'Created as blank user-specific draft',
            createdBy: req.user._id
        });

        // For equity, also create an empty config doc so the editor has
        // something to load (avoids "no config" UI state on a fresh draft).
        if (reportType === 'equity') {
            await EquityMappingConfig.create({
                mappingSetId: draft._id,
                columns: [],
                bsRowToEquityColumn: {},
                movementRows: [],
                rowPatterns: [],
                columnPatterns: []
            });
        }

        global.logger.logInfo(`Blank draft created for ${reportType} v${newVersion}`, {
            adminId: req.user._id,
            draftId: draft._id,
            assignedUsers,
            category: 'admin'
        });

        res.json({ success: true, draft: draft.toObject() });
    } catch (error) {
        global.logger.logError(error, { context: 'admin/createBlankDraft', reportType: req.params.reportType });
        res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to create blank draft' });
    }
}

/**
 * PATCH /api/admin/mappings/sets/:setId/scope
 * Update assignedUsers and/or label on a draft. Only drafts can be modified —
 * published sets are immutable in this regard (publish a new draft instead).
 *
 * Body (any combination):
 *   - assignedUsers: [userId]
 *   - label: string
 */
async function updateSetScope(req, res) {
    try {
        const { setId } = req.params;
        const set = await MappingSet.findById(setId);
        if (!set) {
            return res.status(404).json({ error: 'SET_NOT_FOUND', message: 'Set not found' });
        }
        if (set.status !== 'draft') {
            return res.status(400).json({
                error: 'NOT_A_DRAFT',
                message: 'Scope can only be edited on drafts. Publish creates a new immutable snapshot.'
            });
        }

        if (Array.isArray(req.body?.assignedUsers)) {
            set.assignedUsers = req.body.assignedUsers;
        }
        if (typeof req.body?.label === 'string') {
            set.label = req.body.label;
        }
        await set.save();
        res.json({ success: true, set: set.toObject() });
    } catch (error) {
        global.logger.logError(error, { context: 'admin/updateSetScope', setId: req.params.setId });
        res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to update set scope' });
    }
}

/**
 * Helper used by createDraftFromPublished and forkSet. Clones a source set
 * (its rows or equity config) into a brand-new draft, sends the response.
 *
 * Options:
 *   - assignedUsersOverride: replaces source.assignedUsers in the new draft
 *   - labelOverride:         replaces source.label
 */
async function cloneSetIntoNewDraft(sourceSet, adminId, res, opts = {}) {
    const reportType = sourceSet.reportType;

    // Next version = max existing version + 1 across ALL sets for this
    // reportType (regardless of scope). Versions are globally monotonic so
    // we never reuse a number once it's been used.
    const lastSet = await MappingSet.findOne({ reportType }).sort({ version: -1 });
    const newVersion = (lastSet?.version || 0) + 1;

    const draft = await MappingSet.create({
        reportType,
        version: newVersion,
        status: 'draft',
        assignedUsers: opts.assignedUsersOverride !== null && opts.assignedUsersOverride !== undefined
            ? opts.assignedUsersOverride
            : (sourceSet.assignedUsers || []),
        label: opts.labelOverride !== null && opts.labelOverride !== undefined
            ? opts.labelOverride
            : (sourceSet.label || ''),
        notes: `Forked from v${sourceSet.version}`,
        createdBy: adminId
    });

    if (reportType === 'equity') {
        const sourceConfig = await EquityMappingConfig.findOne({ mappingSetId: sourceSet._id }).lean();
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
        const sourceRows = await RowMapping.find({ mappingSetId: sourceSet._id }).lean();
        if (sourceRows.length > 0) {
            const cloned = sourceRows.map(r => {
                const { _id, createdAt, updatedAt, ...rest } = r;
                return { ...rest, mappingSetId: draft._id };
            });
            await RowMapping.insertMany(cloned, { ordered: false });
        }
    }

    global.logger.logInfo(`Draft created for ${reportType} v${newVersion}`, {
        adminId,
        draftId: draft._id,
        forkedFrom: sourceSet._id,
        assignedUsers: draft.assignedUsers,
        category: 'admin'
    });

    res.json({ success: true, draft: draft.toObject() });
}

/**
 * POST /api/admin/mappings/sets/:setId/publish
 * Publish a draft.
 *
 * Scope-aware archival:
 *   - GLOBAL draft (assignedUsers empty) — archives the current GLOBAL
 *     published set for this reportType. User-specific published sets are
 *     untouched.
 *   - USER-SPECIFIC draft — archives any USER-SPECIFIC published sets whose
 *     assignedUsers overlap with the new draft's. This enforces the invariant
 *     "a user has at most one published user-specific set per reportType at a
 *     time". The global set is untouched.
 *
 * Sequential (non-transactional) — see comment inside for rationale.
 */
async function publishDraft(req, res) {
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
        const isUserSpecific = Array.isArray(draft.assignedUsers) && draft.assignedUsers.length > 0;

        // Sequential publish — no transaction.
        // Transactions require a MongoDB replica set; on standalone deployments
        // (like the current production VPS) startTransaction throws inside the
        // first session-bound query. The window between the archive(s) and the
        // publish below is microseconds; worst case is briefly having zero
        // published sets for some users — much better than a 500 on every
        // publish attempt. If/when we move to a replica set, this can be
        // wrapped in a transaction by reverting to the version in git history
        // before the standalone fix.

        if (isUserSpecific) {
            // Find published user-specific sets that overlap with this draft's
            // assigned users — those are the ones being superseded. The
            // assignedUsers index speeds up this query.
            const overlapping = await MappingSet.find({
                reportType,
                status: 'published',
                assignedUsers: { $in: draft.assignedUsers, $ne: [] }
            });
            for (const set of overlapping) {
                set.status = 'archived';
                await set.save();
            }
        } else {
            // Global draft — archive the current global published set if any.
            const currentGlobal = await MappingSet.findOne({
                reportType,
                status: 'published',
                assignedUsers: { $size: 0 }
            });
            if (currentGlobal) {
                currentGlobal.status = 'archived';
                await currentGlobal.save();
            }
        }

        draft.status = 'published';
        draft.publishedAt = new Date();
        draft.publishedBy = req.user._id;
        if (req.body?.notes) draft.notes = req.body.notes;
        await draft.save();

        global.logger.logSecurity('Mapping set published', {
            adminId: req.user._id,
            adminEmail: req.user.email,
            setId: draft._id,
            reportType,
            version: draft.version,
            scope: isUserSpecific ? 'user-specific' : 'global',
            assignedUsersCount: draft.assignedUsers.length
        }, 'info');

        // Invalidate resolver cache so the new mapping takes effect immediately.
        // User-specific publishes don't pollute the global cache (resolver
        // looks up per-user), but invalidating both is safe and simple.
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
    forkSet,
    createBlankDraft,
    updateSetScope,
    publishDraft,
    deleteSet,
    addRow,
    updateRow,
    deleteRow,
    updateEquityConfig,
    manualSeed
};
