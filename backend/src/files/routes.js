const express = require('express');
const upload = require('../config/multer');
const filesController = require('./controller');
const { authenticateJWT, checkFileProcessingLimit } = require('../middleware/auth');

const router = express.Router();

/**
 * @route   POST /api/files/upload
 * @desc    Upload and process Excel file
 * @access  Private
 */
router.post('/upload', 
    authenticateJWT,
    checkFileProcessingLimit,
    upload.single('file'),
    filesController.uploadAndProcess
);

/**
 * @route   GET /api/files/history
 * @desc    Get file processing history
 * @access  Private
 */
router.get('/history', authenticateJWT, filesController.getFileHistory);

/**
 * @route   GET /api/files/template/:templateType
 * @desc    Get files processed with specific template
 * @access  Private
 */
router.get('/template/:templateType', authenticateJWT, filesController.getTemplateFiles);

/**
 * @route   GET /api/files/status/:jobId
 * @desc    Get processing status for a job
 * @access  Private
 */
router.get('/status/:jobId', authenticateJWT, filesController.getProcessingStatus);

/**
 * @route   POST /api/files/retry/:jobId
 * @desc    Retry failed processing
 * @access  Private
 */
router.post('/retry/:jobId', authenticateJWT, filesController.retryProcessing);

/**
 * @route   GET /api/files/:fileId/download
 * @desc    Download processed file
 * @access  Private
 */
router.get('/:fileId/download', authenticateJWT, filesController.downloadFile);

/**
 * @route   GET /api/files/:fileId/transformation
 * @desc    Get enriched before/after transformation data for a completed file
 * @access  Private
 */
router.get('/:fileId/transformation', authenticateJWT, filesController.getTransformation);

/**
 * @route   POST /api/files/:fileId/transformation/regenerate
 * @desc    Re-run the processor on the original to produce transformation JSON
 *          (used for files processed before this feature existed)
 * @access  Private
 */
router.post('/:fileId/transformation/regenerate',
    authenticateJWT,
    filesController.regenerateTransformation
);

/**
 * @route   GET /api/files/:fileId
 * @desc    Get file details with before/after data
 * @access  Private
 */
router.get('/:fileId', authenticateJWT, filesController.getFileDetails);

/**
 * @route   DELETE /api/files/:fileId
 * @desc    Delete file and cleanup
 * @access  Private
 */
router.delete('/:fileId', authenticateJWT, filesController.deleteFile);

module.exports = router;