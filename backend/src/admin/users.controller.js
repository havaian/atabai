const User = require('../user/model');
const File = require('../files/model');

/**
 * GET /api/admin/users
 * List users with optional filters and pagination.
 *
 * Query params:
 *   q             — search in email or name (case-insensitive)
 *   role          — filter by role
 *   isActive      — 'true' | 'false'
 *   subscription  — 'basic' | 'premium'
 *   page          — 1-indexed, default 1
 *   limit         — default 25, max 100
 *   sort          — 'createdAt' | 'lastLoginAt' | 'email' | 'filesProcessedThisMonth'
 *   order         — 'asc' | 'desc' (default 'desc')
 */
async function listUsers(req, res) {
    try {
        const {
            q,
            role,
            isActive,
            subscription,
            page = 1,
            limit = 25,
            sort = 'createdAt',
            order = 'desc'
        } = req.query;

        const filter = {};

        if (q) {
            const safe = String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            filter.$or = [
                { email: { $regex: safe, $options: 'i' } },
                { name: { $regex: safe, $options: 'i' } }
            ];
        }

        if (role) filter.role = role;
        if (isActive === 'true') filter.isActive = true;
        if (isActive === 'false') filter.isActive = false;
        if (subscription) filter.subscriptionType = subscription;

        const allowedSort = ['createdAt', 'lastLoginAt', 'email', 'filesProcessedThisMonth'];
        const sortField = allowedSort.includes(sort) ? sort : 'createdAt';
        const sortOrder = order === 'asc' ? 1 : -1;

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));
        const skip = (pageNum - 1) * limitNum;

        const [users, total] = await Promise.all([
            User.find(filter)
                .sort({ [sortField]: sortOrder })
                .skip(skip)
                .limit(limitNum)
                .lean(),
            User.countDocuments(filter)
        ]);

        res.json({
            success: true,
            users,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                pages: Math.ceil(total / limitNum)
            }
        });
    } catch (error) {
        global.logger.logError(error, { context: 'admin/listUsers' });
        res.status(500).json({
            error: 'INTERNAL_ERROR',
            message: 'Failed to list users'
        });
    }
}

/**
 * GET /api/admin/users/:userId
 * Returns user + aggregated stats (file counts by status).
 */
async function getUserDetails(req, res) {
    try {
        const { userId } = req.params;

        const user = await User.findById(userId).lean();
        if (!user) {
            return res.status(404).json({
                error: 'USER_NOT_FOUND',
                message: 'User not found'
            });
        }

        // Aggregate file counts by status for this user
        const fileStatsRaw = await File.aggregate([
            { $match: { userId: user._id } },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 },
                    totalSize: { $sum: '$fileSize' }
                }
            }
        ]);

        const fileStats = {
            total: 0,
            uploaded: 0,
            processing: 0,
            completed: 0,
            failed: 0,
            totalSize: 0
        };
        for (const row of fileStatsRaw) {
            if (row._id in fileStats) fileStats[row._id] = row.count;
            fileStats.total += row.count;
            fileStats.totalSize += row.totalSize || 0;
        }

        res.json({
            success: true,
            user,
            fileStats
        });
    } catch (error) {
        global.logger.logError(error, { context: 'admin/getUserDetails', userId: req.params.userId });
        res.status(500).json({
            error: 'INTERNAL_ERROR',
            message: 'Failed to fetch user details'
        });
    }
}

/**
 * PATCH /api/admin/users/:userId/role
 * Change user's role. super_admin only.
 *
 * Body: { role: 'user' | 'admin' | 'super_admin' }
 *
 * Guardrails:
 *   - Cannot change own role (prevents self-lockout)
 *   - Role must be valid enum value
 */
async function updateUserRole(req, res) {
    try {
        const { userId } = req.params;
        const { role } = req.body;

        const validRoles = ['user', 'admin', 'super_admin'];
        if (!validRoles.includes(role)) {
            return res.status(400).json({
                error: 'INVALID_ROLE',
                message: `Role must be one of: ${validRoles.join(', ')}`
            });
        }

        if (String(req.user._id) === String(userId)) {
            return res.status(400).json({
                error: 'CANNOT_MODIFY_SELF',
                message: 'You cannot change your own role'
            });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                error: 'USER_NOT_FOUND',
                message: 'User not found'
            });
        }

        const previousRole = user.role;
        user.role = role;
        await user.save();

        global.logger.logSecurity('User role changed', {
            adminId: req.user._id,
            targetUserId: user._id,
            previousRole,
            newRole: role
        });

        res.json({
            success: true,
            user: {
                id: user._id,
                email: user.email,
                name: user.name,
                role: user.role
            }
        });
    } catch (error) {
        global.logger.logError(error, { context: 'admin/updateUserRole', userId: req.params.userId });
        res.status(500).json({
            error: 'INTERNAL_ERROR',
            message: 'Failed to update user role'
        });
    }
}

/**
 * PATCH /api/admin/users/:userId/active
 * Activate/deactivate user. super_admin only.
 *
 * Body: { isActive: boolean }
 *
 * Guardrails:
 *   - Cannot deactivate self
 */
async function updateUserActive(req, res) {
    try {
        const { userId } = req.params;
        const { isActive } = req.body;

        if (typeof isActive !== 'boolean') {
            return res.status(400).json({
                error: 'INVALID_PAYLOAD',
                message: 'isActive must be boolean'
            });
        }

        if (String(req.user._id) === String(userId)) {
            return res.status(400).json({
                error: 'CANNOT_MODIFY_SELF',
                message: 'You cannot deactivate your own account'
            });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                error: 'USER_NOT_FOUND',
                message: 'User not found'
            });
        }

        user.isActive = isActive;
        await user.save();

        global.logger.logInfo(`User ${isActive ? 'activated' : 'deactivated'}: ${user.email}`, {
            adminId: req.user._id,
            targetUserId: user._id,
            category: 'admin'
        });

        res.json({
            success: true,
            user: {
                id: user._id,
                email: user.email,
                isActive: user.isActive
            }
        });
    } catch (error) {
        global.logger.logError(error, { context: 'admin/updateUserActive', userId: req.params.userId });
        res.status(500).json({
            error: 'INTERNAL_ERROR',
            message: 'Failed to update user active state'
        });
    }
}

/**
 * PATCH /api/admin/users/:userId/subscription
 * Update subscription type and expiry. super_admin only.
 *
 * Body: {
 *   subscriptionType: 'basic' | 'premium',
 *   subscriptionExpiresAt?: ISO date string | null
 * }
 *
 * Use case: admin signs offline deal with a customer → manually grants premium
 * for N days/months. Without this endpoint, admin would have to edit MongoDB
 * directly.
 *
 * Notes:
 *  - subscriptionExpiresAt is optional. null/omitted means "no expiry" (i.e.
 *    premium until manually downgraded). For trials, pass a future date.
 *  - When downgrading premium → basic, expiresAt is cleared.
 */
async function updateUserSubscription(req, res) {
    try {
        const { userId } = req.params;
        const { subscriptionType, subscriptionExpiresAt } = req.body || {};

        const VALID_TYPES = ['basic', 'premium'];
        if (!VALID_TYPES.includes(subscriptionType)) {
            return res.status(400).json({
                error: 'INVALID_TYPE',
                message: `subscriptionType must be one of: ${VALID_TYPES.join(', ')}`
            });
        }

        // Parse expiry — accept null, undefined, or ISO string
        let expiresAt = null;
        if (subscriptionExpiresAt) {
            const d = new Date(subscriptionExpiresAt);
            if (isNaN(d.getTime())) {
                return res.status(400).json({
                    error: 'INVALID_EXPIRY',
                    message: 'subscriptionExpiresAt must be a valid date or null'
                });
            }
            expiresAt = d;
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                error: 'USER_NOT_FOUND',
                message: 'User not found'
            });
        }

        const previousType = user.subscriptionType;
        user.subscriptionType = subscriptionType;
        // Downgrading clears expiry; upgrading sets it (or null = forever)
        if (subscriptionType === 'basic') {
            user.subscriptionExpiresAt = null;
        } else {
            user.subscriptionExpiresAt = expiresAt;
        }
        await user.save();

        global.logger.logSecurity('Subscription changed by admin', {
            adminId: req.user._id,
            targetUserId: user._id,
            previousType,
            newType: subscriptionType,
            expiresAt: user.subscriptionExpiresAt
        }, 'info');

        res.json({
            success: true,
            user: {
                id: user._id,
                email: user.email,
                subscriptionType: user.subscriptionType,
                subscriptionExpiresAt: user.subscriptionExpiresAt
            }
        });
    } catch (error) {
        global.logger.logError(error, { context: 'admin/updateUserSubscription', userId: req.params.userId });
        res.status(500).json({
            error: 'INTERNAL_ERROR',
            message: 'Failed to update subscription'
        });
    }
}

/**
 * GET /api/admin/users/:userId/files
 * Files belonging to a specific user with pagination/filters.
 */
async function getUserFiles(req, res) {
    try {
        const { userId } = req.params;
        const {
            status,
            templateType,
            page = 1,
            limit = 25
        } = req.query;

        const userExists = await User.exists({ _id: userId });
        if (!userExists) {
            return res.status(404).json({
                error: 'USER_NOT_FOUND',
                message: 'User not found'
            });
        }

        const filter = { userId };
        if (status) filter.status = status;
        if (templateType) filter.templateType = templateType;

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));
        const skip = (pageNum - 1) * limitNum;

        const [files, total] = await Promise.all([
            File.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNum)
                .lean(),
            File.countDocuments(filter)
        ]);

        res.json({
            success: true,
            files,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                pages: Math.ceil(total / limitNum)
            }
        });
    } catch (error) {
        global.logger.logError(error, { context: 'admin/getUserFiles', userId: req.params.userId });
        res.status(500).json({
            error: 'INTERNAL_ERROR',
            message: 'Failed to fetch user files'
        });
    }
}

module.exports = {
    listUsers,
    getUserDetails,
    updateUserRole,
    updateUserActive,
    updateUserSubscription,
    getUserFiles
};
