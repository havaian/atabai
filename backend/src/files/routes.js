const express = require('express');
const multer = require('multer');
const path = require('path');
const { authenticateJWT, checkFileProcessingLimit } = require('../middleware/auth');
const {
    uploadAndProcess,
    getFileHistory,
    getTemplateFiles,
    getProcessingStatus,
    getFileDetails,
    downloadFile,
    deleteFile,
    retryProcessing
} = require('./controller');

const router = express.Router();

// Configure multer for file upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Ensure we get the project root directory regardless of where server is started
        const projectRoot = path.resolve(__dirname, '../../..');
        const uploadPath = path.join(projectRoot, 'uploads');
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const fileExtension = path.extname(file.originalname);
        const fileName = `${file.fieldname}-${uniqueSuffix}${fileExtension}`;
        cb(null, fileName);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB limit
    },
    fileFilter: (req, file, cb) => {
        // Accept only Excel files and CSV
        if (file.mimetype.includes('spreadsheet') ||
            file.mimetype.includes('excel') ||
            file.originalname.endsWith('.xlsx') ||
            file.originalname.endsWith('.xls') ||
            file.originalname.endsWith('.csv')) {
            cb(null, true);
        } else {
            cb(new Error('Only Excel and CSV files are allowed'), false);
        }
    }
});

/**
 * @route   POST /api/files/upload
 * @desc    Upload and process Excel file
 * @access  Private
 */
router.post('/upload', authenticateJWT, upload.single('file'), uploadAndProcess);

/**
 * @route   GET /api/files/history
 * @desc    Get user's file processing history
 * @access  Private
 */
router.get('/history', authenticateJWT, getFileHistory);

/**
 * @route   GET /api/files/template/:templateType
 * @desc    Get files processed with specific template
 * @access  Private
 */
router.get('/template/:templateType', authenticateJWT, getTemplateFiles);

/**
 * @route   GET /api/files/status/:jobId
 * @desc    Get file processing status
 * @access  Private
 */
router.get('/status/:jobId', authenticateJWT, getProcessingStatus);

/**
 * @route   GET /api/files/:fileId
 * @desc    Get file details
 * @access  Private
 */
router.get('/:fileId', authenticateJWT, getFileDetails);

/**
 * @route   GET /api/files/:fileId/download
 * @desc    Download processed file
 * @access  Private
 */
router.get('/:fileId/download', authenticateJWT, downloadFile);

/**
 * @route   DELETE /api/files/:fileId
 * @desc    Delete file and cleanup
 * @access  Private
 */
router.delete('/:fileId', authenticateJWT, deleteFile);

/**
 * @route   POST /api/files/retry/:jobId
 * @desc    Retry failed processing
 * @access  Private
 */
router.post('/retry/:jobId', authenticateJWT, retryProcessing);

// Error handling middleware for multer
router.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                error: 'FILE_TOO_LARGE',
                message: 'File size exceeds 50MB limit'
            });
        }
    }
    if (err.message === 'Only Excel and CSV files are allowed') {
        return res.status(400).json({
            success: false,
            error: 'INVALID_FILE_TYPE',
            message: 'Only Excel (.xlsx, .xls) and CSV files are allowed'
        });
    }
    next(err);
});

module.exports = router;