import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import type { AppConfig } from './config/configuration';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    bodyParser: false,
  });

  // Use Winston as the application logger (set in AppModule via nest-winston)
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));

  const configService = app.get(ConfigService<AppConfig, true>);
  const port = configService.get('backendPort', { infer: true });
  const nodeEnv = configService.get('nodeEnv', { infer: true });
  const frontendUrl = configService.get('frontendUrl', { infer: true });

  // Trust proxy (behind reverse proxy like nginx)
  app.set('trust proxy', 1);

  // Body parsers — large limit to support spreadsheet payloads
  // Stripe webhook needs raw body, so we add a route-level raw parser inside the stripe controller.
  const { json, urlencoded } = await import('express');
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ limit: '50mb', extended: true }));
  app.use(cookieParser());

  // Security headers — preserves the CSP from the legacy Express app
  app.use(
    helmet({
      crossOriginEmbedderPolicy: false,
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      },
    }),
  );

  app.use(compression());

  // CORS — explicit allowlist (matches legacy behavior, supports null origin for native apps)
  const allowedOrigins = [
    frontendUrl,
    'http://localhost:8080',
    'http://localhost:3000',
    'http://localhost:80',
    'http://localhost:7777',
  ];
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    optionsSuccessStatus: 200,
  });

  // Global API prefix matches legacy /api/* routes
  app.setGlobalPrefix('api', { exclude: ['health', '/'] });

  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1', prefix: false });

  // Class-validator/transformer pipeline — DTOs are validated on every request
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Global exception filter — mirrors legacy errorHandler shape
  app.useGlobalFilters(app.get(AllExceptionsFilter));

  // Graceful shutdown hooks (Nest will close modules in reverse dependency order)
  app.enableShutdownHooks();

  await app.listen(port, '0.0.0.0');

  const logger = app.get(WINSTON_MODULE_NEST_PROVIDER);
  logger.log(`Server listening on port ${port} (${nodeEnv})`, 'Bootstrap');
}

void bootstrap();
