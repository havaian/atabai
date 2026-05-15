/**
 * Admin role middleware.
 * Used to gate /api/admin/* routes by role.
 * Assumes authenticateJWT has already attached req.user.
 */

const AdminSession = require('./models/adminSession.model');

/**
 * Require user to have one of the specified roles.
 * @param  {...string} allowedRoles - e.g. 'admin', 'super_admin'
 */
const requireRole = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                error: 'AUTH_REQUIRED',
                message: 'Authentication is required'
            });
        }

        if (!allowedRoles.includes(req.user.role)) {
            global.logger.logSecurity('Role check failed', {
                userId: req.user._id,
                email: req.user.email,
                userRole: req.user.role,
                requiredRoles: allowedRoles,
                path: req.originalUrl
            });
            return res.status(403).json({
                error: 'FORBIDDEN',
                message: 'Insufficient permissions'
            });
        }

        next();
    };
};

/** Shortcut: admin or super_admin */
const requireAdmin = requireRole('admin', 'super_admin');

/** Shortcut: super_admin only — for role management, dangerous ops */
const requireSuperAdmin = requireRole('super_admin');

/**
 * Require an active AdminSession (i.e. admin has passed 2FA in this session).
 *
 * Client must send the session id in the `X-Admin-Session` header. We verify:
 *   - Session exists
 *   - Belongs to the same user as req.user
 *   - Has not expired (defense in depth — TTL index also cleans these up)
 *
 * If 2FA is not yet enrolled, we return a 403 with code `2FA_REQUIRED_SETUP`
 * so the frontend can route to the setup wizard. If enrolled but no valid
 * session, return `2FA_REQUIRED_VERIFY`.
 */
const requireAdminVerified = async (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            error: 'AUTH_REQUIRED',
            message: 'Authentication is required'
        });
    }

    if (!req.user.totpEnabled) {
        return res.status(403).json({
            error: '2FA_REQUIRED_SETUP',
            message: '2FA enrollment is required before accessing admin features'
        });
    }

    const sid = req.get('X-Admin-Session');
    if (!sid) {
        return res.status(403).json({
            error: '2FA_REQUIRED_VERIFY',
            message: 'Admin session header is missing'
        });
    }

    try {
        const session = await AdminSession.findOne({ sessionId: sid });
        if (!session) {
            return res.status(403).json({
                error: '2FA_REQUIRED_VERIFY',
                message: 'Admin session not found or expired'
            });
        }
        if (String(session.userId) !== String(req.user._id)) {
            // Mismatched session — log and treat as forbidden
            global.logger.logSecurity('Admin session/user mismatch', {
                sessionUserId: session.userId,
                requestUserId: req.user._id,
                requestEmail: req.user.email,
                path: req.originalUrl
            }, 'warn');
            return res.status(403).json({
                error: '2FA_REQUIRED_VERIFY',
                message: 'Admin session does not match user'
            });
        }
        if (session.expiresAt < new Date()) {
            // Defensive: TTL should have removed it, but if not, reject and clean up.
            await AdminSession.deleteOne({ _id: session._id }).catch(() => {});
            return res.status(403).json({
                error: '2FA_REQUIRED_VERIFY',
                message: 'Admin session expired'
            });
        }
        req.adminSession = session;
        next();
    } catch (err) {
        global.logger.logError(err, { context: 'requireAdminVerified', path: req.originalUrl });
        return res.status(500).json({
            error: 'INTERNAL_ERROR',
            message: 'Failed to verify admin session'
        });
    }
};

module.exports = {
    requireRole,
    requireAdmin,
    requireSuperAdmin,
    requireAdminVerified
};
