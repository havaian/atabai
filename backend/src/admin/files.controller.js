const fs = require('fs').promises;
const fsSync = require('fs');
const File = require('../files/model');
const User = require('../user/model');
const templateTypes = require('../utils/templateTypes');

/**
 * GET /api/admin/files
 * List ALL files across users with filters and pagination.
 *
 * Query params:
 *   userId        — filter by owner
 *   userEmail     — filter by owner email (case-insensitive contains)
 *   status        — 'uploaded' | 'processing' | 'completed' | 'failed'
 *   templateType  — one of templateTypes enum
 *   q             — search in originalName
 *   from, to      — ISO date range on createdAt
 *   page, limit   — pagination (limit max 100)
 */
async function listAllFiles(req, res) {
    try {
        const {
            userId,
            userEmail,
            status,
            templateType,
            q,
            from,
            to,
            page = 1,
            limit = 25
        } = req.query;

        const filter = {};

        if (userId) filter.userId = userId;

        if (userEmail) {
            const safe = String(userEmail).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const matchingUsers = await User.find(
                { email: { $regex: safe, $options: 'i' } },
                { _id: 1 }
            ).lean();
            filter.userId = { $in: matchingUsers.map(u => u._id) };
        }

        if (status) filter.status = status;
        if (templateType) filter.templateType = templateType;

        if (q) {
            const safe = String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            filter.originalName = { $regex: safe, $options: 'i' };
        }

        if (from || to) {
            filter.createdAt = {};
            if (from) filter.createdAt.$gte = new Date(from);
            if (to) filter.createdAt.$lte = new Date(to);
        }

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));
        const skip = (pageNum - 1) * limitNum;

        const [files, total] = await Promise.all([
            File.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNum)
                .populate('userId', 'email name')
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
        global.logger.logError(error, { context: 'admin/listAllFiles' });
        res.status(500).json({
            error: 'INTERNAL_ERROR',
            message: 'Failed to list files'
        });
    }
}

/**
 * GET /api/admin/files/:fileId
 * File details by id, regardless of owner.
 */
async function getFileDetails(req, res) {
    try {
        const { fileId } = req.params;

        const file = await File.findById(fileId)
            .populate('userId', 'email name role')
            .lean();

        if (!file) {
            return res.status(404).json({
                error: 'FILE_NOT_FOUND',
                message: 'File not found'
            });
        }

        res.json({
            success: true,
            file
        });
    } catch (error) {
        global.logger.logError(error, { context: 'admin/getFileDetails', fileId: req.params.fileId });
        res.status(500).json({
            error: 'INTERNAL_ERROR',
            message: 'Failed to fetch file details'
        });
    }
}

/**
 * GET /api/admin/files/:fileId/download?type=original|processed
 * Download original or processed file.
 */
async function downloadFile(req, res) {
    try {
        const { fileId } = req.params;
        const { type = 'processed' } = req.query;

        const file = await File.findById(fileId);
        if (!file) {
            return res.status(404).json({
                error: 'FILE_NOT_FOUND',
                message: 'File not found'
            });
        }

        let downloadPath;
        let downloadName;

        if (type === 'original') {
            downloadPath = `/uploads/${file.filePath}`;
            downloadName = file.filePath;
        } else if (type === 'processed') {
            if (!file.processedFilePath) {
                return res.status(400).json({
                    error: 'NO_PROCESSED_FILE',
                    message: 'Processed file not available'
                });
            }
            downloadPath = `/uploads/${file.processedFilePath}`;
            downloadName = file.processedFilePath;
        } else {
            return res.status(400).json({
                error: 'INVALID_TYPE',
                message: "Query param 'type' must be 'original' or 'processed'"
            });
        }

        try {
            await fs.access(downloadPath);
        } catch (err) {
            return res.status(404).json({
                error: 'FILE_NOT_ACCESSIBLE',
                message: 'File not found on server'
            });
        }

        global.logger.logSecurity('Admin downloaded user file', {
            adminId: req.user._id,
            adminEmail: req.user.email,
            fileId: file._id,
            fileOwnerId: file.userId,
            type
        }, 'info');

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);

        const stream = fsSync.createReadStream(downloadPath);
        stream.pipe(res);
    } catch (error) {
        global.logger.logError(error, { context: 'admin/downloadFile', fileId: req.params.fileId });
        if (!res.headersSent) {
            res.status(500).json({
                error: 'INTERNAL_ERROR',
                message: 'Failed to download file'
            });
        }
    }
}

/**
 * GET /api/admin/files/:fileId/transformation
 * Returns the transformation.json snapshot for a completed file.
 */
async function getTransformation(req, res) {
    try {
        const { fileId } = req.params;

        const file = await File.findById(fileId).lean();
        if (!file) {
            return res.status(404).json({
                error: 'FILE_NOT_FOUND',
                message: 'File not found'
            });
        }

        if (!file.processedFilePath) {
            return res.status(400).json({
                error: 'NO_PROCESSED_FILE',
                message: 'Processed file not available'
            });
        }

        const jsonPath = `/uploads/${file.processedFilePath}.transformation.json`;

        let raw;
        try {
            raw = await fs.readFile(jsonPath, 'utf8');
        } catch (err) {
            if (err.code === 'ENOENT') {
                return res.status(404).json({
                    error: 'TRANSFORMATION_NOT_AVAILABLE',
                    message: 'Transformation data not available'
                });
            }
            throw err;
        }

        let parsed;
        try {
            parsed = JSON.parse(raw);
        } catch (err) {
            global.logger.logError(err, { context: 'admin/getTransformation - corrupt JSON', jsonPath });
            return res.status(500).json({
                error: 'TRANSFORMATION_CORRUPT',
                message: 'Transformation data is corrupted'
            });
        }

        res.json({
            success: true,
            transformation: parsed
        });
    } catch (error) {
        global.logger.logError(error, { context: 'admin/getTransformation', fileId: req.params.fileId });
        res.status(500).json({
            error: 'INTERNAL_ERROR',
            message: 'Failed to fetch transformation data'
        });
    }
}

/**
 * GET /api/admin/stats
 * Aggregated stats for dashboard:
 *   - users by role and active status
 *   - files by status
 *   - files by template type
 *   - last 7 days file processing volume
 */
async function getStats(req, res) {
    try {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        const [
            usersByRole,
            usersByActive,
            filesByStatus,
            filesByTemplate,
            filesLast7Days,
            totalUsers,
            totalFiles
        ] = await Promise.all([
            User.aggregate([
                { $group: { _id: '$role', count: { $sum: 1 } } }
            ]),
            User.aggregate([
                { $group: { _id: '$isActive', count: { $sum: 1 } } }
            ]),
            File.aggregate([
                { $group: { _id: '$status', count: { $sum: 1 } } }
            ]),
            File.aggregate([
                { $group: { _id: '$templateType', count: { $sum: 1 } } }
            ]),
            File.aggregate([
                { $match: { createdAt: { $gte: sevenDaysAgo } } },
                {
                    $group: {
                        _id: {
                            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
                        },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { _id: 1 } }
            ]),
            User.countDocuments(),
            File.countDocuments()
        ]);

        res.json({
            success: true,
            stats: {
                totalUsers,
                totalFiles,
                usersByRole,
                usersByActive,
                filesByStatus,
                filesByTemplate,
                filesLast7Days,
                templateTypes
            }
        });
    } catch (error) {
        global.logger.logError(error, { context: 'admin/getStats' });
        res.status(500).json({
            error: 'INTERNAL_ERROR',
            message: 'Failed to fetch stats'
        });
    }
}

module.exports = {
    listAllFiles,
    getFileDetails,
    downloadFile,
    getTransformation,
    getStats
};
