const mongoose = require('mongoose');
const templateTypes = require('../utils/templateTypes')

const processingJobSchema = new mongoose.Schema({
    // Job identification
    jobId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },

    // Associated resources
    fileId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'File',
        required: true,
        index: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },

    // Processing configuration
    templateType: {
        type: String,
        required: true,
        enum: templateTypes
    },
    options: {
        type: Map,
        of: mongoose.Schema.Types.Mixed,
        default: new Map()
    },

    // Job status
    status: {
        type: String,
        required: true,
        enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
        default: 'pending',
        index: true
    },
    progress: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
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
        worksheets: [{
            name: String,
            originalRows: Number,
            processedRows: Number,
            changes: Number
        }],
        summary: {
            type: String
        },
        warnings: [{
            message: String,
            row: Number,
            column: String,
            severity: {
                type: String,
                enum: ['info', 'warning', 'error'],
                default: 'warning'
            }
        }]
    },

    // Error handling
    error: {
        message: String,
        stack: String,
        name: String,
        details: mongoose.Schema.Types.Mixed
    },
    retryCount: {
        type: Number,
        default: 0,
        min: 0,
        max: 5
    },
    maxRetries: {
        type: Number,
        default: 3,
        min: 0,
        max: 5
    },

    // Processing metadata
    startedAt: {
        type: Date,
        default: null
    },
    completedAt: {
        type: Date,
        default: null
    },

    // Performance metrics
    processingTime: {
        type: Number, // in milliseconds
        default: null
    },
    memoryUsage: {
        type: Number, // in bytes
        default: null
    },

    // Priority and scheduling
    priority: {
        type: String,
        enum: ['low', 'normal', 'high'],
        default: 'normal'
    },
    scheduledFor: {
        type: Date,
        default: Date.now
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
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes for performance
processingJobSchema.index({ userId: 1, createdAt: -1 });
processingJobSchema.index({ status: 1, scheduledFor: 1 });
processingJobSchema.index({ templateType: 1, status: 1 });
processingJobSchema.index({ jobId: 1, userId: 1 });

// Virtual for processing duration
processingJobSchema.virtual('duration').get(function () {
    if (this.completedAt && this.startedAt) {
        return this.completedAt - this.startedAt;
    }
    if (this.startedAt && this.status === 'processing') {
        return Date.now() - this.startedAt;
    }
    return null;
});

// Virtual for status display
processingJobSchema.virtual('statusDisplay').get(function () {
    const statusMap = {
        'pending': 'Pending',
        'processing': 'Processing',
        'completed': 'Completed',
        'failed': 'Failed',
        'cancelled': 'Cancelled'
    };
    return statusMap[this.status] || this.status;
});

// Virtual for progress display
processingJobSchema.virtual('progressDisplay').get(function () {
    return `${this.progress}%`;
});

// Virtual for can retry
processingJobSchema.virtual('canRetry').get(function () {
    return this.status === 'failed' && this.retryCount < this.maxRetries;
});

// Pre-save middleware
processingJobSchema.pre('save', function (next) {
    this.updatedAt = new Date();

    // Set startedAt when status changes to processing
    if (this.isModified('status') && this.status === 'processing' && !this.startedAt) {
        this.startedAt = new Date();
    }

    // Set completedAt and processingTime when job completes
    if (this.isModified('status') && ['completed', 'failed', 'cancelled'].includes(this.status) && !this.completedAt) {
        this.completedAt = new Date();
        if (this.startedAt) {
            this.processingTime = this.completedAt - this.startedAt;
        }
    }

    next();
});

// Static methods
processingJobSchema.statics.findByUserId = function (userId, options = {}) {
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

    return query.populate('fileId', 'originalName fileSize');
};

processingJobSchema.statics.findPendingJobs = function (limit = 10) {
    return this.find({
        status: 'pending',
        scheduledFor: { $lte: new Date() }
    })
        .sort({ priority: -1, scheduledFor: 1 })
        .limit(limit)
        .populate('fileId', 'originalName filePath templateType')
        .populate('userId', 'email name subscriptionType');
};

processingJobSchema.statics.findByJobId = function (jobId, userId = null) {
    const query = { jobId };
    if (userId) {
        query.userId = userId;
    }
    return this.findOne(query).populate('fileId');
};

processingJobSchema.statics.getJobStats = function (userId = null) {
    const matchStage = userId ? { userId: mongoose.Types.ObjectId(userId) } : {};

    return this.aggregate([
        { $match: matchStage },
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 },
                avgProcessingTime: { $avg: '$processingTime' },
                totalRetries: { $sum: '$retryCount' }
            }
        }
    ]);
};

// Instance methods
processingJobSchema.methods.updateProgress = function (progress, status = null) {
    this.progress = Math.max(0, Math.min(100, progress));
    if (status) {
        this.status = status;
    }
    return this.save();
};

processingJobSchema.methods.markAsCompleted = function (result = {}) {
    this.status = 'completed';
    this.progress = 100;
    this.result = { ...this.result, ...result };
    return this.save();
};

processingJobSchema.methods.markAsFailed = function (error) {
    this.status = 'failed';
    this.error = {
        message: error.message || 'Unknown error',
        stack: error.stack,
        code: error.code
    };
    return this.save();
};

processingJobSchema.methods.markAsProcessing = function () {
    this.status = 'processing';
    this.progress = 0;
    return this.save();
};

processingJobSchema.methods.canBeRetried = function () {
    return this.canRetry;
};

processingJobSchema.methods.retry = function () {
    if (!this.canBeRetried()) {
        throw new Error('Job cannot be retried');
    }

    this.status = 'pending';
    this.progress = 0;
    this.retryCount += 1;
    this.error = undefined;
    this.startedAt = null;
    this.completedAt = null;
    this.processingTime = null;
    this.scheduledFor = new Date();

    return this.save();
};

processingJobSchema.methods.cancel = function () {
    if (['completed', 'cancelled'].includes(this.status)) {
        throw new Error('Cannot cancel completed or already cancelled job');
    }

    this.status = 'cancelled';
    return this.save();
};

processingJobSchema.methods.getPublicData = function () {
    return {
        id: this.jobId,
        status: this.status,
        statusDisplay: this.statusDisplay,
        progress: this.progress,
        progressDisplay: this.progressDisplay,
        templateType: this.templateType,
        result: this.result,
        error: this.error?.message,
        retryCount: this.retryCount,
        canRetry: this.canRetry,
        duration: this.duration,
        createdAt: this.createdAt,
        startedAt: this.startedAt,
        completedAt: this.completedAt
    };
};

module.exports = mongoose.model('ProcessingJob', processingJobSchema);