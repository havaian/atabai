const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
    // File metadata
    originalName: {
        type: String,
        required: true,
        trim: true,
        maxlength: 255
    },
    fileName: {
        type: String,
        required: true,
        trim: true,
        maxlength: 255
    },
    filePath: {
        type: String,
        required: true
    },
    processedFilePath: {
        type: String,
        default: null
    },
    fileSize: {
        type: Number,
        required: true,
        min: 0
    },
    mimeType: {
        type: String,
        required: true
    },

    // Processing metadata
    templateType: {
        type: String,
        required: true,
        enum: ['depreciation', 'discounts', 'impairment', 'reports']
    },
    status: {
        type: String,
        required: true,
        enum: ['uploaded', 'processing', 'completed', 'failed'],
        default: 'uploaded'
    },
    jobId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },

    // User association
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },

    // Processing results
    result: {
        transformations: {
            type: Number,
            default: 0
        },
        changes: {
            type: Number,
            default: 0
        },
        originalRows: {
            type: Number,
            default: 0
        },
        processedRows: {
            type: Number,
            default: 0
        },
        warnings: [{
            type: String
        }],
        summary: {
            type: String
        }
    },

    // Error handling
    error: {
        type: String,
        default: null
    },
    retryCount: {
        type: Number,
        default: 0,
        min: 0
    },

    // Timestamps
    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    },
    updatedAt: {
        type: Date,
        default: Date.now
    },
    completedAt: {
        type: Date,
        default: null
    },

    // File expiry (for cleanup)
    expiresAt: {
        type: Date,
        default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        index: { expireAfterSeconds: 0 }
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes for performance
fileSchema.index({ userId: 1, createdAt: -1 });
fileSchema.index({ status: 1, createdAt: -1 });
fileSchema.index({ templateType: 1, createdAt: -1 });
fileSchema.index({ jobId: 1, userId: 1 });

// Virtual for processing duration
fileSchema.virtual('processingDuration').get(function () {
    if (this.completedAt && this.createdAt) {
        return this.completedAt - this.createdAt;
    }
    return null;
});

// Virtual for file size in human readable format
fileSchema.virtual('fileSizeFormatted').get(function () {
    const bytes = this.fileSize;
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
});

// Virtual for status display
fileSchema.virtual('statusDisplay').get(function () {
    const statusMap = {
        'uploaded': 'Uploaded',
        'processing': 'Processing',
        'completed': 'Completed',
        'failed': 'Failed'
    };
    return statusMap[this.status] || this.status;
});

// Pre-save middleware to update timestamps
fileSchema.pre('save', function (next) {
    this.updatedAt = new Date();

    if (this.status === 'completed' && !this.completedAt) {
        this.completedAt = new Date();
    }

    next();
});

// Static methods
fileSchema.statics.findByUserId = function (userId, options = {}) {
    const query = this.find({ userId });

    if (options.status) {
        query.where({ status: options.status });
    }

    if (options.templateType) {
        query.where({ templateType: options.templateType });
    }

    query.sort({ createdAt: -1 });

    if (options.limit) {
        query.limit(options.limit);
    }

    if (options.skip) {
        query.skip(options.skip);
    }

    return query;
};

fileSchema.statics.findByJobId = function (jobId, userId) {
    return this.findOne({ jobId, userId });
};

fileSchema.statics.getProcessingStats = function (userId) {
    return this.aggregate([
        { $match: { userId: mongoose.Types.ObjectId(userId) } },
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 },
                totalSize: { $sum: '$fileSize' }
            }
        }
    ]);
};

// Instance methods
fileSchema.methods.canBeDeleted = function () {
    // Files can always be deleted by the owner
    return true;
};

fileSchema.methods.canBeDownloaded = function () {
    // Only completed files can be downloaded
    return this.status === 'completed' && this.processedFilePath;
};

fileSchema.methods.canBeRetried = function () {
    // Only failed files can be retried
    return this.status === 'failed';
};

fileSchema.methods.getPublicData = function () {
    return {
        id: this._id.toString(),
        originalName: this.originalName,
        templateType: this.templateType,
        status: this.status,
        statusDisplay: this.statusDisplay,
        fileSize: this.fileSize,
        fileSizeFormatted: this.fileSizeFormatted,
        createdAt: this.createdAt,
        updatedAt: this.updatedAt,
        completedAt: this.completedAt,
        processingDuration: this.processingDuration,
        result: this.result,
        error: this.error,
        retryCount: this.retryCount,
        jobId: this.jobId
    };
};

module.exports = mongoose.model('File', fileSchema);