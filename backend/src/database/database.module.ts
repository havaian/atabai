import { Module, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

import type { AppConfig } from '../config/configuration';

/**
 * Wraps @nestjs/mongoose with the same connection options the legacy backend
 * used (pool size, timeouts, retry policies). Connection lifecycle events log
 * to Nest's default logger; the Mongoose-style retry-on-fail behavior is now
 * delegated to MongoClient's own reconnect + Nest's graceful shutdown.
 */
@Module({
  imports: [
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppConfig, true>) => {
        const mongo = configService.get('mongo', { infer: true });
        const logger = new Logger('Mongoose');

        return {
          uri: mongo.uri,
          maxPoolSize: 10,
          minPoolSize: 2,
          maxIdleTimeMS: 30_000,
          serverSelectionTimeoutMS: 5_000,
          socketTimeoutMS: 45_000,
          connectTimeoutMS: 10_000,
          heartbeatFrequencyMS: 10_000,
          retryWrites: true,
          retryReads: true,
          connectionFactory: (connection: import('mongoose').Connection) => {
            connection.on('connected', () => logger.log(`MongoDB connected (${mongo.database})`));
            connection.on('error', (err: Error) =>
              logger.error(`MongoDB error: ${err.message}`, err.stack),
            );
            connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
            connection.on('reconnected', () => logger.log('MongoDB reconnected'));
            return connection;
          },
        };
      },
    }),
  ],
  exports: [MongooseModule],
})
export class DatabaseModule {}
