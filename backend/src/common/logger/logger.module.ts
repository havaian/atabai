import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { WinstonModule } from 'nest-winston';

import type { AppConfig } from '../../config/configuration';
import { AppLoggerService } from './app-logger.service';
import { buildWinstonOptions } from './winston.config';

/**
 * Global logger module - every other module gets `AppLoggerService` and the
 * underlying Winston instance for free, without having to re-import.
 */
@Global()
@Module({
  imports: [
    WinstonModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppConfig, true>) => {
        const level = configService.get('logLevel', { infer: true });
        return buildWinstonOptions(level);
      },
    }),
  ],
  providers: [AppLoggerService],
  exports: [WinstonModule, AppLoggerService],
})
export class LoggerModule {}
