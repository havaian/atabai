const fs = require('fs').promises;
const path = require('path');
const ExcelJS = require('exceljs');
const crypto = require('crypto');
const File = require('./model');
const ProcessingJob = require('../jobs/model');
const { processDepreciationTemplate } = require('../processing/depreciation');
const { processDiscountsTemplate } = require('../processing/discounts');
const { processImpairmentTemplate } = require('../processing/impairment');

/**
 * Upload and process Excel file
 */
async function uploadAndProcess(req, res) {
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
        if (!template) {
            return res.status(400).json({
                success: false,
                error: 'NO_TEMPLATE',
                message: 'Template type is required'
            });
        }

        // Validate template type
        const validTemplates = ['depreciation', 'discounts', 'impairment'];
        if (!validTemplates.includes(template)) {
            return res.status(400).json({
                success: false,
                error: 'INVALID_TEMPLATE',
                message: 'Invalid template type'
            });
        }

        // Generate job ID
        const jobId = crypto.randomUUID();

        // Create file record
        const fileRecord = new File({
            originalName: req.file.originalname,
            fileName: req.file.filename,
            filePath: req.file.path,
            fileSize: req.file.size,
            mimeType: req.file.mimetype,
            templateType: template,
            userId: req.user._id,
            status: 'uploaded',
            jobId: jobId
        });

        await fileRecord.save();

        // Create processing job
        const processingJob = new ProcessingJob({
            jobId: jobId,
            fileId: fileRecord._id,
            userId: req.user._id,
            templateType: template,
            status: 'pending',
            progress: 0
        });

        await processingJob.save();

        // Start background processing
        processFileAsync(fileRecord, processingJob);

        // Update user's monthly file count
        req.user.filesProcessedThisMonth += 1;
        await req.user.save();

        global.logger.logInfo(`File uploaded successfully: ${req.file.originalname} by ${req.user.email}`);

        res.status(200).json({
            success: true,
            message: 'File uploaded and processing started',
            jobId: jobId,
            fileId: fileRecord._id.toString(),
            templateType: template
        });

    } catch (error) {
        global.logger.logError('Upload and process error:', error);

        // Clean up uploaded file if it exists
        if (req.file?.path) {
            try {
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

/**
 * Get file processing history
 */
async function getFileHistory(req, res) {
    try {
        const { limit = 50, offset = 0, status } = req.query;

        const query = { userId: req.user._id };
        if (status) {
            query.status = status;
        }

        const files = await File.find(query)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip(parseInt(offset))
            .lean();

        const totalCount = await File.countDocuments(query);

        res.status(200).json({
            success: true,
            files: files.map(file => ({
                id: file._id.toString(),
                originalName: file.originalName,
                templateType: file.templateType,
                status: file.status,
                fileSize: file.fileSize,
                createdAt: file.createdAt,
                completedAt: file.completedAt,
                jobId: file.jobId,
                transformations: file.result?.transformations || 0,
                changes: file.result?.changes || 0
            })),
            totalCount,
            hasMore: offset + files.length < totalCount
        });

    } catch (error) {
        global.logger.logError('Get file history error:', error);
        res.status(500).json({
            success: false,
            error: 'FETCH_ERROR',
            message: 'Failed to fetch file history'
        });
    }
}

/**
 * Get files processed with specific template
 */
async function getTemplateFiles(req, res) {
    try {
        const { templateType } = req.params;
        const { limit = 20, offset = 0, status } = req.query;

        // Validate template type
        const validTemplates = ['depreciation', 'discounts', 'impairment'];
        if (!validTemplates.includes(templateType)) {
            return res.status(400).json({
                success: false,
                error: 'INVALID_TEMPLATE',
                message: 'Invalid template type'
            });
        }

        const query = {
            userId: req.user._id,
            templateType: templateType
        };

        if (status) {
            query.status = status;
        }

        const files = await File.find(query)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip(parseInt(offset))
            .lean();

        const totalCount = await File.countDocuments(query);

        // Get status summary
        const statusCounts = await File.aggregate([
            { $match: { userId: req.user._id, templateType: templateType } },
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);

        const statusSummary = {
            total: totalCount,
            completed: 0,
            processing: 0,
            failed: 0,
            pending: 0
        };

        statusCounts.forEach(item => {
            if (statusSummary.hasOwnProperty(item._id)) {
                statusSummary[item._id] = item.count;
            }
        });

        res.status(200).json({
            success: true,
            templateType,
            files: files.map(file => ({
                id: file._id.toString(),
                originalName: file.originalName,
                status: file.status,
                fileSize: file.fileSize,
                createdAt: file.createdAt,
                completedAt: file.completedAt,
                jobId: file.jobId,
                transformations: file.result?.transformations || 0,
                changes: file.result?.changes || 0,
                processedFilePath: file.processedFilePath,
                hasProcessedFile: !!file.processedFilePath
            })),
            statusSummary,
            pagination: {
                total: totalCount,
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: offset + files.length < totalCount
            }
        });

    } catch (error) {
        global.logger.logError('Get template files error:', error);
        res.status(500).json({
            success: false,
            error: 'FETCH_ERROR',
            message: 'Failed to fetch template files'
        });
    }
}

/**
 * Get processing status for a job
 */
async function getProcessingStatus(req, res) {
    try {
        const { jobId } = req.params;

        const job = await ProcessingJob.findOne({
            jobId: jobId,
            userId: req.user._id
        }).populate('fileId');

        if (!job) {
            return res.status(404).json({
                success: false,
                error: 'JOB_NOT_FOUND',
                message: 'Processing job not found'
            });
        }

        res.status(200).json({
            success: true,
            job: {
                id: job.jobId,
                fileId: job.fileId?._id?.toString(),
                fileName: job.fileId?.originalName,
                templateType: job.templateType,
                status: job.status,
                progress: job.progress,
                error: job.error,
                result: job.result,
                createdAt: job.createdAt,
                completedAt: job.completedAt,
                retryCount: job.retryCount || 0
            }
        });

    } catch (error) {
        global.logger.logError('Get processing status error:', error);
        res.status(500).json({
            success: false,
            error: 'FETCH_ERROR',
            message: 'Failed to get processing status'
        });
    }
}

/**
 * Get file details with before/after data
 */
async function getFileDetails(req, res) {
    try {
        const { fileId } = req.params;

        const file = await File.findOne({
            _id: fileId,
            userId: req.user._id
        }).lean();

        if (!file) {
            return res.status(404).json({
                success: false,
                error: 'FILE_NOT_FOUND',
                message: 'File not found'
            });
        }

        // Prepare response with before/after data for completed files
        let beforeData = null;
        let afterData = null;

        if (file.status === 'completed' && file.processedFilePath) {
            try {
                // Read original file for before data
                const originalWorkbook = new ExcelJS.Workbook();
                await originalWorkbook.xlsx.readFile(file.filePath);

                // Get first worksheet data (limited to first 20 rows for preview)
                const originalWs = originalWorkbook.worksheets[0];
                beforeData = extractWorksheetPreview(originalWs);

                // Read processed file for after data
                const processedWorkbook = new ExcelJS.Workbook();
                await processedWorkbook.xlsx.readFile(file.processedFilePath);

                const processedWs = processedWorkbook.worksheets[0];
                afterData = extractWorksheetPreview(processedWs);

            } catch (fileError) {
                global.logger.logWarn(`Failed to read file data for preview: ${fileError.message}`);
            }
        }

        res.status(200).json({
            success: true,
            file: {
                id: file._id.toString(),
                originalName: file.originalName,
                templateType: file.templateType,
                status: file.status,
                fileSize: file.fileSize,
                createdAt: file.createdAt,
                completedAt: file.completedAt,
                jobId: file.jobId,
                transformations: file.result?.transformations || 0,
                changes: file.result?.changes || 0,
                warnings: file.result?.warnings || [],
                hasProcessedFile: !!file.processedFilePath,
                beforeData,
                afterData
            }
        });

    } catch (error) {
        global.logger.logError('Get file details error:', error);
        res.status(500).json({
            success: false,
            error: 'FETCH_ERROR',
            message: 'Failed to get file details'
        });
    }
}

/**
 * Download processed file
 */
async function downloadFile(req, res) {
    try {
        const { fileId } = req.params;
        const { type = 'processed' } = req.query; // 'original' or 'processed'

        const file = await File.findOne({
            _id: fileId,
            userId: req.user._id
        });

        if (!file) {
            return res.status(404).json({
                success: false,
                error: 'FILE_NOT_FOUND',
                message: 'File not found'
            });
        }

        let downloadPath;
        let downloadName;

        if (type === 'original') {
            downloadPath = file.filePath;
            downloadName = file.originalName;
        } else {
            if (!file.processedFilePath) {
                return res.status(400).json({
                    success: false,
                    error: 'NO_PROCESSED_FILE',
                    message: 'Processed file not available'
                });
            }
            downloadPath = file.processedFilePath;
            const ext = path.extname(file.originalName);
            const name = path.basename(file.originalName, ext);
            downloadName = `${name}_ifrs${ext}`;
        }

        // Check if file exists
        try {
            await fs.access(downloadPath);
        } catch (err) {
            return res.status(404).json({
                success: false,
                error: 'FILE_NOT_ACCESSIBLE',
                message: 'File not found on server'
            });
        }

        // Set download headers
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);

        // Stream file
        const fileStream = require('fs').createReadStream(downloadPath);
        fileStream.pipe(res);

        global.logger.logInfo(`File downloaded: ${downloadName} by ${req.user.email}`);

    } catch (error) {
        global.logger.logError('Download file error:', error);
        res.status(500).json({
            success: false,
            error: 'DOWNLOAD_ERROR',
            message: 'Failed to download file'
        });
    }
}

/**
 * Delete file and cleanup
 */
async function deleteFile(req, res) {
    try {
        const { fileId } = req.params;

        const file = await File.findOne({
            _id: fileId,
            userId: req.user._id
        });

        if (!file) {
            return res.status(404).json({
                success: false,
                error: 'FILE_NOT_FOUND',
                message: 'File not found'
            });
        }

        // Delete physical files
        const filesToDelete = [file.filePath];
        if (file.processedFilePath) {
            filesToDelete.push(file.processedFilePath);
        }

        await Promise.allSettled(filesToDelete.map(async (filePath) => {
            try {
                await fs.unlink(filePath);
                global.logger.logInfo(`Deleted file: ${filePath}`);
            } catch (error) {
                global.logger.logWarn(`Failed to delete file: ${filePath}`, error);
            }
        }));

        // Delete processing job
        await ProcessingJob.deleteOne({ fileId: file._id });

        // Delete file record
        await File.deleteOne({ _id: file._id });

        res.status(200).json({
            success: true,
            message: 'File deleted successfully'
        });

    } catch (error) {
        global.logger.logError('Delete file error:', error);
        res.status(500).json({
            success: false,
            error: 'DELETE_ERROR',
            message: 'Failed to delete file'
        });
    }
}

/**
 * Retry failed processing
 */
async function retryProcessing(req, res) {
    try {
        const { jobId } = req.params;

        const job = await ProcessingJob.findOne({
            jobId: jobId,
            userId: req.user._id
        }).populate('fileId');

        if (!job) {
            return res.status(404).json({
                success: false,
                error: 'JOB_NOT_FOUND',
                message: 'Processing job not found'
            });
        }

        if (job.status !== 'failed') {
            return res.status(400).json({
                success: false,
                error: 'INVALID_STATUS',
                message: 'Only failed jobs can be retried'
            });
        }

        // Reset job status
        job.status = 'pending';
        job.progress = 0;
        job.error = null;
        job.retryCount = (job.retryCount || 0) + 1;
        await job.save();

        // Start processing again
        processFileAsync(job.fileId, job);

        res.status(200).json({
            success: true,
            message: 'Processing retry initiated',
            job: {
                id: job.jobId,
                status: job.status,
                progress: job.progress,
                retryCount: job.retryCount
            }
        });

    } catch (error) {
        global.logger.logError('Retry processing error:', error);
        res.status(500).json({
            success: false,
            error: 'RETRY_ERROR',
            message: 'Failed to retry processing'
        });
    }
}

/**
 * Background file processing
 */
async function processFileAsync(fileRecord, processingJob) {
    try {
        global.logger.logInfo(`Starting background processing for file: ${fileRecord.originalName}`);

        // Update status to processing
        processingJob.status = 'processing';
        processingJob.progress = 10;
        await processingJob.save();

        // Read Excel file
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(fileRecord.filePath);

        processingJob.progress = 30;
        await processingJob.save();

        // Process based on template type
        let result;
        switch (fileRecord.templateType) {
            case 'depreciation':
                result = await processDepreciationTemplate(workbook);
                break;
            case 'discounts':
                result = await processDiscountsTemplate(workbook);
                break;
            case 'impairment':
                result = await processImpairmentTemplate(workbook);
                break;
            default:
                throw new Error(`Unknown template type: ${fileRecord.templateType}`);
        }

        processingJob.progress = 70;
        await processingJob.save();

        // Save processed file
        const processedFilename = `${path.parse(fileRecord.fileName).name}_ifrs${path.extname(fileRecord.fileName)}`;
        const processedFilePath = path.join(path.dirname(fileRecord.filePath), processedFilename);

        await result.workbook.xlsx.writeFile(processedFilePath);

        processingJob.progress = 90;
        await processingJob.save();

        // Update file record
        fileRecord.status = 'completed';
        fileRecord.processedFilePath = processedFilePath;
        fileRecord.result = result.summary;
        fileRecord.completedAt = new Date();
        await fileRecord.save();

        // Complete job
        processingJob.status = 'completed';
        processingJob.progress = 100;
        processingJob.result = result.summary;
        processingJob.completedAt = new Date();
        await processingJob.save();

        global.logger.logInfo(`File processing completed: ${fileRecord.originalName}`);

    } catch (error) {
        global.logger.logError(`File processing failed: ${fileRecord.originalName}`, error);

        // Update job as failed
        processingJob.status = 'failed';
        processingJob.error = error.message;
        await processingJob.save();

        // Update file record
        fileRecord.status = 'failed';
        fileRecord.error = error.message;
        await fileRecord.save();
    }
}

/**
 * Helper function to extract worksheet preview data (first 20 rows)
 */
function extractWorksheetPreview(worksheet) {
    const preview = {
        headers: [],
        rows: [],
        totalRows: worksheet.rowCount
    };

    // Get headers from first row
    const headerRow = worksheet.getRow(1);
    headerRow.eachCell((cell, colNumber) => {
        preview.headers[colNumber - 1] = cell.value || `Column ${colNumber}`;
    });

    // Get up to 20 rows of data
    const maxRows = Math.min(20, worksheet.rowCount);
    for (let rowNum = 2; rowNum <= maxRows; rowNum++) {
        const row = worksheet.getRow(rowNum);
        const rowData = [];

        row.eachCell((cell, colNumber) => {
            rowData[colNumber - 1] = cell.value;
        });

        preview.rows.push(rowData);
    }

    return preview;
}

module.exports = {
    uploadAndProcess,
    getFileHistory,
    getTemplateFiles,
    getProcessingStatus,
    getFileDetails,
    downloadFile,
    deleteFile,
    retryProcessing
};