const ProcessingJob = require('../jobs/model')
const File = require('../files/model')

class JobCleanupMiddleware {
    constructor() {
        this.isRunning = false
        this.cleanupInterval = null
    }

    /**
     * Start the cleanup service - runs immediately then on schedule
     */
    async start() {
        if (this.isRunning) {
            global.logger.logWarn('Job cleanup service already running')
            return
        }

        global.logger.logInfo('Starting job cleanup service...')
        this.isRunning = true

        try {
            // Run cleanup immediately on startup
            await this.cleanupStuckJobs()
            
            // Then schedule regular cleanup every 2 minutes
            this.cleanupInterval = setInterval(async () => {
                try {
                    await this.cleanupStuckJobs()
                } catch (error) {
                    global.logger.logError('Error in scheduled cleanup:', error)
                }
            }, 2 * 60 * 1000) // 2 minutes

            global.logger.logInfo('Job cleanup service started successfully')
        } catch (error) {
            global.logger.logError('Failed to start job cleanup service:', error)
            this.isRunning = false
        }
    }

    /**
     * Stop the cleanup service
     */
    stop() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval)
            this.cleanupInterval = null
        }
        this.isRunning = false
        global.logger.logInfo('Job cleanup service stopped')
    }

    /**
     * Main cleanup function - finds and marks stuck jobs as failed
     */
    async cleanupStuckJobs() {
        try {
            const timeoutMinutes = 5
            const timeoutMs = timeoutMinutes * 60 * 1000
            const timeoutTime = new Date(Date.now() - timeoutMs)

            global.logger.logDebug(`Looking for stuck jobs older than ${timeoutMinutes} minutes...`)

            // Find stuck jobs - including 'uploaded' status
            const stuckJobs = await ProcessingJob.find({
                status: { $in: ['uploaded', 'pending', 'processing'] },
                updatedAt: { $lt: timeoutTime }
            }).populate('fileId')

            if (stuckJobs.length === 0) {
                global.logger.logDebug('No stuck jobs found')
                return
            }

            global.logger.logInfo(`Found ${stuckJobs.length} stuck jobs to clean up`)

            for (const job of stuckJobs) {
                await this.markJobAsFailed(job)
            }

            global.logger.logInfo(`Cleaned up ${stuckJobs.length} stuck jobs`)

        } catch (error) {
            global.logger.logError('Error during job cleanup:', error)
        }
    }

    /**
     * Mark a single job and its associated file as failed
     */
    async markJobAsFailed(job) {
        try {
            const jobAge = Date.now() - new Date(job.updatedAt).getTime()
            const ageMinutes = Math.round(jobAge / (60 * 1000))

            global.logger.logInfo(`Marking job ${job.jobId} as failed (stuck for ${ageMinutes} minutes)`)

            // Update the processing job
            job.status = 'failed'
            job.error = {
                message: `Job timed out after ${ageMinutes} minutes - processing took too long`,
                type: 'timeout',
                originalStatus: job.status,
                timeoutAt: new Date()
            }
            job.completedAt = new Date()
            await job.save()

            // Update the associated file if it exists
            if (job.fileId) {
                const file = await File.findById(job.fileId)
                if (file) {
                    file.status = 'failed'
                    file.error = `Processing timed out after ${ageMinutes} minutes`
                    file.completedAt = new Date()
                    await file.save()
                    
                    global.logger.logDebug(`Updated file ${file._id} status to failed`)
                }
            }

        } catch (error) {
            global.logger.logError(`Error marking job ${job.jobId} as failed:`, error)
        }
    }

    /**
     * Get cleanup service status
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            hasInterval: !!this.cleanupInterval,
            uptime: this.isRunning ? Date.now() - this.startTime : 0
        }
    }

    /**
     * Manual cleanup trigger (useful for testing)
     */
    async triggerCleanup() {
        global.logger.logInfo('Manual cleanup triggered')
        await this.cleanupStuckJobs()
    }
}

// Create singleton instance
const jobCleanupMiddleware = new JobCleanupMiddleware()

module.exports = jobCleanupMiddleware