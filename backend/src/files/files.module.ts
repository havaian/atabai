import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { MulterModule } from '@nestjs/platform-express';

import { AuthModule } from '../auth/auth.module';
import type { AppConfig } from '../config/configuration';
import {
  ProcessingJob,
  ProcessingJobSchema,
} from '../jobs/schemas/processing-job.schema';
// OrganizationsModule re-exports MongooseModule for Membership/Organization,
// which FilesService injects to verify the X-Active-Org-Id header against
// the caller's active memberships (Task 6).
import { OrganizationsModule } from '../organizations/organizations.module';
import { ProcessorsModule } from '../processors/processors.module';
import { User, UserSchema } from '../users/schemas/user.schema';
import { UsersModule } from '../users/users.module';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { File, FileSchema } from './schemas/file.schema';
import { SourceWorkbookParser } from './source-workbook-parser';
import { TransformationEnrichmentService } from './transformation-enrichment.service';
import { buildMulterOptions } from './utils/multer-config';
import { TransformationLockService } from './utils/transformation-lock';

@Module({
  imports: [
    AuthModule,
    // UsersModule is required because JwtAuthGuard / FileProcessingLimitGuard
    // (re-exported by AuthModule) depend on UsersService, which lives here.
    UsersModule,
    OrganizationsModule,
    ProcessorsModule,
    MulterModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppConfig, true>) =>
        buildMulterOptions(configService),
    }),
    MongooseModule.forFeature([
      { name: File.name, schema: FileSchema },
      { name: ProcessingJob.name, schema: ProcessingJobSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [FilesController],
  providers: [
    FilesService,
    SourceWorkbookParser,
    TransformationEnrichmentService,
    TransformationLockService,
  ],
  exports: [FilesService, MongooseModule],
})
export class FilesModule {}
