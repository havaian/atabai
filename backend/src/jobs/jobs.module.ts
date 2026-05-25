import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { File, FileSchema } from '../files/schemas/file.schema';
import { JobCleanupService } from './job-cleanup.service';
import { ProcessingJob, ProcessingJobSchema } from './schemas/processing-job.schema';

/**
 * Owns the ProcessingJob model and the periodic stuck-job sweeper.
 *
 * The @nestjs/schedule runtime is bootstrapped in AppModule; this module just
 * registers the cron-decorated service so the scheduler finds it.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ProcessingJob.name, schema: ProcessingJobSchema },
      { name: File.name, schema: FileSchema },
    ]),
  ],
  providers: [JobCleanupService],
  exports: [MongooseModule, JobCleanupService],
})
export class JobsModule {}
