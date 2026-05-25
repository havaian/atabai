import { Inject, Injectable } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import type { Logger as WinstonLogger } from 'winston';

type LogMeta = Record<string, unknown>;

/**
 * Structured logger that preserves the named "categories" the legacy logger
 * used everywhere (auth, file-processing, database, security, performance,
 * action, system, http). Services inject this when they want categorized
 * events with arbitrary metadata; Nest's built-in `Logger` is used for plain
 * controller/service traces.
 *
 * Backed by the same Winston instance Nest uses as the application logger,
 * so output is unified.
 */
@Injectable()
export class AppLoggerService {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly winston: WinstonLogger,
  ) {}

  info(message: string, meta: LogMeta = {}, context?: string): void {
    this.winston.info(message, this.withContext(meta, context));
  }

  warn(message: string, meta: LogMeta = {}, context?: string): void {
    this.winston.warn(message, this.withContext(meta, context));
  }

  debug(message: string, meta: LogMeta = {}, context?: string): void {
    this.winston.debug(message, this.withContext(meta, context));
  }

  verbose(message: string, meta: LogMeta = {}, context?: string): void {
    this.winston.verbose(message, this.withContext(meta, context));
  }

  /**
   * Mirrors the legacy logError helper — accepts an Error or string + context.
   */
  error(error: unknown, meta: LogMeta = {}, context?: string): void {
    if (error instanceof Error) {
      this.winston.error(
        error.message,
        this.withContext(
          {
            ...meta,
            error: { name: error.name, message: error.message, stack: error.stack },
          },
          context,
        ),
      );
    } else {
      this.winston.error(String(error), this.withContext(meta, context));
    }
  }

  /** Named categories preserved from the legacy logger for log-grepability. */
  logAuth(event: string, meta: LogMeta = {}): void {
    this.info(`AUTH: ${event}`, { ...meta, category: 'auth' });
  }
  logFileProcessing(event: string, meta: LogMeta = {}): void {
    this.info(`FILE: ${event}`, { ...meta, category: 'file-processing' });
  }
  logDatabase(operation: string, collection: string, meta: LogMeta = {}): void {
    this.debug(`DB: ${operation} on ${collection}`, {
      ...meta,
      operation,
      collection,
      category: 'database',
    });
  }
  logSecurity(event: string, meta: LogMeta = {}, level: 'warn' | 'info' = 'warn'): void {
    const payload = { ...meta, category: 'security' };
    if (level === 'warn') this.warn(`SECURITY: ${event}`, payload);
    else this.info(`SECURITY: ${event}`, payload);
  }
  logPerformance(metric: string, value: number, unit: string, meta: LogMeta = {}): void {
    this.info(`PERF: ${metric} = ${value}${unit}`, {
      ...meta,
      metric,
      value,
      unit,
      category: 'performance',
    });
  }
  logAction(action: string, meta: LogMeta = {}): void {
    this.info(action, { ...meta, category: 'action' });
  }

  private withContext(meta: LogMeta, context?: string): LogMeta {
    return context ? { ...meta, context } : meta;
  }
}
