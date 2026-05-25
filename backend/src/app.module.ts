import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

import { AppController } from './app.controller';
import { configuration, validateEnv, type AppConfig } from './config/configuration';
import { LoggerModule } from './common/logger/logger.module';
import { CommonModule } from './common/common.module';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AdminModule } from './admin/admin.module';
import { FilesModule } from './files/files.module';
import { JobsModule } from './jobs/jobs.module';
import { MappingsModule } from './mappings/mappings.module';
import { ProcessorsModule } from './processors/processors.module';
import { TemplatesModule } from './templates/templates.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnv,
      cache: true,
      // Look in backend/.env first (per-service), then fall back to the
      // repo-root .env that the legacy layout uses. ConfigModule walks the
      // list and uses the first existing file.
      envFilePath: ['.env', '../.env'],
    }),

    // Global rate limiter — matches legacy: 600 req / 15min per IP
    // Auth routes get a stricter override applied at the controller level (30 / 15min, skipSuccessfulRequests)
    ThrottlerModule.forRoot({
      throttlers: [
        {
          name: 'global',
          ttl: 15 * 60 * 1000,
          limit: 600,
        },
      ],
    }),

    ScheduleModule.forRoot(),

    LoggerModule,
    CommonModule,
    DatabaseModule,
    RedisModule,
    UsersModule,
    AuthModule,
    MappingsModule,
    AdminModule,
    ProcessorsModule,
    FilesModule,
    TemplatesModule,
    JobsModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}

// Re-export so other modules can reference the validated config shape
export type { AppConfig };
