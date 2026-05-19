const express = require('express');
const { authenticateJWT } = require('../middleware/auth');
const { requireAdmin, requireSuperAdmin, requireAdminVerified } = require('./middleware');
const usersController = require('./users.controller');
const filesController = require('./files.controller');
const mappingsController = require('./mappings.controller');
const twoFactorController = require('./twoFactor.controller');
const localesController = require('./locales.controller');
const whitelistController = require('./whitelist.controller');

const router = express.Router();

// All admin routes require JWT + admin role.
// 2FA verification is enforced selectively below.
router.use(authenticateJWT);
router.use(requireAdmin);

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC (admin-only but 2FA-pre-gate) endpoints
// These are intentionally NOT behind requireAdminVerified because they are
// either status checks or the 2FA enrollment / verification flow itself.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/admin/me
 * Confirms admin access. Also includes 2FA status so the client knows
 * whether to render setup/verify wizard.
 */
router.get('/me', (req, res) => {
    res.json({
        success: true,
        admin: {
            id: req.user._id,
            email: req.user.email,
            name: req.user.name,
            role: req.user.role,
            totpEnabled: !!req.user.totpEnabled
        }
    });
});

// 2FA management
router.get('/2fa/status', twoFactorController.getStatus);
router.post('/2fa/setup', twoFactorController.setup);
router.post('/2fa/confirm', twoFactorController.confirm);
router.post('/2fa/verify', twoFactorController.verify);
router.post('/2fa/logout', twoFactorController.logoutSession);
router.post('/2fa/disable', twoFactorController.disable);
router.post('/2fa/backup-codes/regenerate', twoFactorController.regenerateBackupCodes);

// ─────────────────────────────────────────────────────────────────────────────
// PROTECTED endpoints — require active AdminSession (X-Admin-Session header).
// From here down, all routes go through requireAdminVerified.
// ─────────────────────────────────────────────────────────────────────────────

router.use(requireAdminVerified);

/**
 * GET /api/admin/stats
 * Dashboard aggregated stats.
 */
router.get('/stats', filesController.getStats);

// --- Users ---

router.get('/users', usersController.listUsers);
router.get('/users/:userId', usersController.getUserDetails);
router.get('/users/:userId/files', usersController.getUserFiles);

// Role and active toggles — super_admin only
router.patch('/users/:userId/role', requireSuperAdmin, usersController.updateUserRole);
router.patch('/users/:userId/active', requireSuperAdmin, usersController.updateUserActive);
router.patch('/users/:userId/subscription', requireSuperAdmin, usersController.updateUserSubscription);

// --- Email whitelist ---
router.get('/whitelist', whitelistController.listWhitelist);
router.post('/whitelist', requireSuperAdmin, whitelistController.addEntry);
router.post('/whitelist/bulk', requireSuperAdmin, whitelistController.bulkAdd);
router.delete('/whitelist/:entryId', requireSuperAdmin, whitelistController.removeEntry);

// --- Files ---

router.get('/files', filesController.listAllFiles);
router.get('/files/:fileId', filesController.getFileDetails);
router.get('/files/:fileId/download', filesController.downloadFile);
router.get('/files/:fileId/transformation', filesController.getTransformation);

// --- Mappings ---

// List all mapping sets across report types
router.get('/mappings', mappingsController.listMappingSets);

// Manual seed trigger — super_admin only
router.post('/mappings/seed', requireSuperAdmin, mappingsController.manualSeed);

// Per-report-type lookups
router.get('/mappings/:reportType/published', mappingsController.getPublishedSet);
router.get('/mappings/:reportType/draft', mappingsController.getDraftSet);

// Draft management (super_admin only for mutations)
router.post('/mappings/:reportType/draft', requireSuperAdmin, mappingsController.createDraftFromPublished);
// Blank user-specific draft (assignedUsers required in body)
router.post('/mappings/:reportType/blank-draft', requireSuperAdmin, mappingsController.createBlankDraft);

// Set-level operations
router.get('/mappings/sets/:setId', mappingsController.getSetById);
router.post('/mappings/sets/:setId/publish', requireSuperAdmin, mappingsController.publishDraft);
// Fork an arbitrary set (published/archived) into a new draft. Body may
// override assignedUsers and label.
router.post('/mappings/sets/:setId/fork', requireSuperAdmin, mappingsController.forkSet);
// Update scope (assignedUsers, label) on a draft only.
router.patch('/mappings/sets/:setId/scope', requireSuperAdmin, mappingsController.updateSetScope);
router.delete('/mappings/sets/:setId', requireSuperAdmin, mappingsController.deleteSet);

// Row editing within a draft (row-based report types)
router.post('/mappings/sets/:setId/rows', requireSuperAdmin, mappingsController.addRow);
router.patch('/mappings/rows/:rowId', requireSuperAdmin, mappingsController.updateRow);
router.delete('/mappings/rows/:rowId', requireSuperAdmin, mappingsController.deleteRow);

// Equity config (replace-all in a draft)
router.put('/mappings/sets/:setId/equity', requireSuperAdmin, mappingsController.updateEquityConfig);

// --- Locales (i18n editor) ---

// Read endpoints — admin or super_admin
router.get('/locales', localesController.listKeys);
router.get('/locales/namespaces', localesController.listNamespaces);
router.get('/locales/stats', localesController.getStats);

// Mutations — super_admin only
router.post('/locales/keys', requireSuperAdmin, localesController.createKey);
router.patch('/locales/keys/:keyId', requireSuperAdmin, localesController.updateKey);
router.delete('/locales/keys/:keyId', requireSuperAdmin, localesController.deleteKey);
router.post('/locales/seed', requireSuperAdmin, localesController.manualSeed);

module.exports = router;
