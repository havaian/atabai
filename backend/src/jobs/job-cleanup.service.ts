import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Model } from 'mongoose';

import { File, type FileDocument, type FileModel } from '../files/schemas/file.schema';
import {
  ProcessingJob,
  type ProcessingJobDocument,
} from './schemas/processing-job.schema';

const STUCK_JOB_TIMEOUT_MINUTES = 5;
const STUCK_JOB_TIMEOUT_MS = STUCK_JOB_TIMEOUT_MINUTES * 60 * 1000;

/**
 * Sweeps "uploaded", "pending", and "processing" jobs that haven't updated
 * within STUCK_JOB_TIMEOUT_MINUTES and marks them — plus their owning files —
 * as failed with a timeout error.
 *
 * Replaces backend/src/middleware/jobCleanup.js, which used setInterval
 * directly. Now driven by @nestjs/schedule's @Cron, which integrates with
 * Nest lifecycle (stops cleanly on shutdown). We also run once at app
 * bootstrap so a process restart immediately surfaces any stale jobs left
 * behind by the previous run.
 */
@Injectable()
export class JobCleanupService implements OnApplicationBootstrap {
  private readonly logger = new Logger(JobCleanupService.name);

  constructor(
    @InjectModel(ProcessingJob.name)
    private readonly jobModel: Model<ProcessingJobDocument>,
    @InjectModel(File.name) private readonly fileModel: FileModel,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    this.logger.log('Job cleanup service started — running initial sweep');
    await this.cleanupStuckJobs();
  }

  /**
   * Cron: every 2 minutes (matches the legacy setInterval cadence).
   * `EVERY_2_MINUTES` lives in CronExpression as `EVERY_30_MINUTES` etc.;
   * we use the explicit pattern for 2-minute since there's no constant for it.
   */
  @Cron('0 */2 * * * *', { name: 'job-cleanup-stuck-jobs' })
  async runScheduled(): Promise<void> {
    await this.cleanupStuckJobs();
  }

  async cleanupStuckJobs(): Promise<{ swept: number }> {
    try {
      const timeoutTime = new Date(Date.now() - STUCK_JOB_TIMEOUT_MS);

      this.logger.debug(
        `Looking for stuck jobs older than ${STUCK_JOB_TIMEOUT_MINUTES} minutes`,
      );

      const stuckJobs = await this.jobModel
        .find({
          status: { $in: ['uploaded', 'pending', 'processing'] },
          updatedAt: { $lt: timeoutTime },
        })
        .populate('fileId');

      if (stuckJobs.length === 0) {
        this.logger.debug('No stuck jobs found');
        return { swept: 0 };
      }

      this.logger.log(`Found ${stuckJobs.length} stuck jobs to clean up`);
      for (const job of stuckJobs) {
        await this.markJobAsFailed(job);
      }
      this.logger.log(`Cleaned up ${stuckJobs.length} stuck jobs`);
      return { swept: stuckJobs.length };
    } catch (err) {
      this.logger.error(`Error during job cleanup: ${(err as Error).message}`);
      return { swept: 0 };
    }
  }

  private async markJobAsFailed(job: ProcessingJobDocument): Promise<void> {
    try {
      const updatedAt = (job as unknown as { updatedAt: Date }).updatedAt;
      const ageMinutes = Math.round((Date.now() - updatedAt.getTime()) / (60 * 1000));
      const originalStatus = job.status;

      this.logger.log(`Marking job ${job.jobId} as failed (stuck for ${ageMinutes} minutes)`);

      job.status = 'failed';
      job.error = {
        message: `Job timed out after ${ageMinutes} minutes - processing took too long`,
        name: 'TimeoutError',
        details: { originalStatus, timeoutAt: new Date() },
      };
      job.completedAt = new Date();
      await job.save();

      // Update owning file record if it exists. populate('fileId') may have
      // returned a hydrated File doc or just the id — handle both.
      const populated = job.fileId as unknown;
      let file: FileDocument | null = null;
      if (populated && typeof populated === 'object' && 'status' in (populated as object)) {
        file = populated as FileDocument;
      } else if (populated) {
        file = await this.fileModel.findById(populated as string);
      }

      if (file) {
        file.status = 'failed';
        file.error = `Processing timed out after ${ageMinutes} minutes`;
        file.completedAt = new Date();
        await file.save();
        this.logger.debug(`Updated file ${file._id.toString()} status to failed`);
      }
    } catch (err) {
      this.logger.error(`Error marking job ${job.jobId} as failed: ${(err as Error).message}`);
    }
  }
}
