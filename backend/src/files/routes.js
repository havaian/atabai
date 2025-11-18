const express = require('express');
const multer = require('multer');
const path = require('path');
const { authenticateJWT, checkFileProcessingLimit } = require('../middleware/auth');

// Simple inline handlers to avoid controller dependency issues for now
const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Ensure we get the project root directory regardless of where server is started
        const projectRoot = path.resolve(__dirname, '../../..');
        const uploadPath = path.join(projectRoot, 'uploads');
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        const name = path.basename(file.originalname, ext);
        cb(null, `${name}-${uniqueSuffix}${ext}`);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'application/octet-stream'
    ];
    
    const allowedExtensions = ['.xlsx', '.xls'];
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error('Only Excel files (.xlsx, .xls) are allowed'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
        files: 1
    }
});

/**
 * @route   POST /api/files/upload
 * @desc    Upload and process Excel file
 * @access  Private
 */
router.post('/upload',
    authenticateJWT,
    checkFileProcessingLimit,
    upload.single('file'),
    async (req, res) => {
        try {
            global.logger.logInfo(`File upload initiated by user: ${req.user.email}`);
            
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    error: 'NO_FILE',
                    message: 'No file uploaded'
                });
            }

            const { template } = req.body;
            if (!template || !['depreciation', 'discounts', 'impairment'].includes(template)) {
                return res.status(400).json({
                    success: false,
                    error: 'INVALID_TEMPLATE',
                    message: 'Invalid template type'
                });
            }

            // Generate job ID
            const jobId = require('crypto').randomUUID();
            
            // For now, simulate processing without actual file processing
            // This avoids the need for models and processing services
            global.logger.logInfo(`File uploaded successfully: ${req.file.originalname} by ${req.user.email}`);

            res.status(200).json({
                success: true,
                message: 'File uploaded and processing started',
                jobId: jobId,
                templateType: template,
                fileName: req.file.originalname,
                fileSize: req.file.size
            });

        } catch (error) {
            global.logger.logError('Upload and process error:', error);
            
            // Clean up uploaded file if it exists
            if (req.file?.path) {
                try {
                    const fs = require('fs').promises;
                    await fs.unlink(req.file.path);
                } catch (unlinkError) {
                    global.logger.logError('Failed to clean up uploaded file:', unlinkError);
                }
            }

            res.status(500).json({
                success: false,
                error: 'PROCESSING_ERROR',
                message: 'Failed to process file'
            });
        }
    }
);

/**
 * @route   GET /api/files/history
 * @desc    Get user's file processing history
 * @access  Private
 */
router.get('/history', authenticateJWT, async (req, res) => {
    try {
        const { limit = 50, offset = 0 } = req.query;
        
        // Mock data for now
        const mockFiles = [
            {
                id: 'mock_1',
                originalName: 'sample_depreciation.xlsx',
                templateType: 'depreciation',
                status: 'completed',
                fileSize: 25600,
                createdAt: new Date(Date.now() - 86400000), // 1 day ago
                completedAt: new Date(Date.now() - 86300000),
                transformations: 15,
                changes: 42
            },
            {
                id: 'mock_2',
                originalName: 'revenue_data.xlsx',
                templateType: 'discounts',
                status: 'processing',
                fileSize: 51200,
                createdAt: new Date(Date.now() - 3600000), // 1 hour ago
                transformations: 0,
                changes: 0
            }
        ];

        res.status(200).json({
            success: true,
            files: mockFiles.map(file => ({
                id: file.id,
                originalName: file.originalName,
                templateType: file.templateType,
                status: file.status,
                fileSize: file.fileSize,
                createdAt: file.createdAt,
                completedAt: file.completedAt,
                transformations: file.transformations || 0,
                changes: file.changes || 0
            })),
            totalCount: mockFiles.length,
            hasMore: false
        });

    } catch (error) {
        global.logger.logError('Get file history error:', error);
        res.status(500).json({
            success: false,
            error: 'FETCH_ERROR',
            message: 'Failed to fetch file history'
        });
    }
});

/**
 * @route   GET /api/files/status/:jobId
 * @desc    Get file processing status
 * @access  Private
 */
router.get('/status/:jobId', authenticateJWT, async (req, res) => {
    try {
        const { jobId } = req.params;
        
        // Mock status data
        const mockStatus = {
            id: jobId,
            status: 'completed',
            progress: 100,
            templateType: 'depreciation',
            fileName: 'sample_file.xlsx',
            createdAt: new Date(Date.now() - 300000), // 5 minutes ago
            completedAt: new Date(),
            result: {
                transformations: 15,
                changes: 42,
                processedRows: 25,
                warnings: 2
            }
        };

        res.status(200).json({
            success: true,
            job: mockStatus
        });

    } catch (error) {
        global.logger.logError('Get processing status error:', error);
        res.status(500).json({
            success: false,
            error: 'STATUS_ERROR',
            message: 'Failed to get processing status'
        });
    }
});

/**
 * @route   GET /api/files/:fileId/download
 * @desc    Download processed file
 * @access  Private
 */
router.get('/:fileId/download', authenticateJWT, async (req, res) => {
    try {
        const { fileId } = req.params;
        const { type = 'processed' } = req.query;
        
        // For now, return a simple response
        res.status(200).json({
            success: false,
            error: 'NOT_IMPLEMENTED',
            message: 'File download not implemented yet - coming in next update'
        });

    } catch (error) {
        global.logger.logError('Download file error:', error);
        res.status(500).json({
            success: false,
            error: 'DOWNLOAD_ERROR',
            message: 'Failed to download file'
        });
    }
});

module.exports = router;