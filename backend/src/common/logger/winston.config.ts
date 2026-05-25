import * as fs from 'fs';
import * as path from 'path';
import * as winston from 'winston';
import 'winston-daily-rotate-file';
import DailyRotateFile from 'winston-daily-rotate-file';

import { safeStringify } from './safe-stringify';

/**
 * Build the Winston logger options used both as the Nest application logger
 * (via nest-winston) and for direct use by services that want structured logs
 * keyed by category/context.
 *
 * Behavior parity with the legacy logger:
 *   - Tashkent (UTC+5) timestamps in every line
 *   - Console output is colorized and human-readable in dev
 *   - File transports are JSON-ish lines and split by level (error / http / combined)
 *   - Daily rotation, 100MB per file, 5 generations, gzipped
 */
export function buildWinstonOptions(logLevel: string): winston.LoggerOptions {
  const logsDir = path.join(process.cwd(), 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  const tashkentTimestamp = winston.format.timestamp({
    format: () => {
      const now = new Date();
      const utc = now.getTime() + now.getTimezoneOffset() * 60000;
      const tashkent = new Date(utc + 5 * 3600000);
      return tashkent.toISOString().replace('T', ' ').replace(/\..+/, '');
    },
  });

  // File format — verbose, includes context + meta JSON, easy to grep.
  const fileFormat = winston.format.combine(
    tashkentTimestamp,
    winston.format.errors({ stack: true }),
    winston.format.printf((info) => {
      const { timestamp, level, message, context, stack, ...meta } = info as Record<
        string,
        unknown
      > & { timestamp: string; level: string; message: unknown; context?: string; stack?: string };

      const safeMessage = Buffer.isBuffer(message) ? message.toString('utf8') : String(message);
      const ctx = context ? ` [${context}]` : '';
      let line = `${timestamp} [${level.toUpperCase()}]${ctx}: ${safeMessage}`;

      const cleanMeta = { ...meta };
      delete (cleanMeta as Record<string, unknown>).service;
      if (Object.keys(cleanMeta).length > 0) {
        line += ` | ${safeStringify(cleanMeta, 0)}`;
      }
      if (stack) line += `\n${stack}`;
      return line;
    }),
  );

  // Console format — colorized, compact.
  const consoleFormat = winston.format.combine(
    winston.format.colorize({ all: true }),
    tashkentTimestamp,
    winston.format.printf((info) => {
      const { timestamp, level, message, context, ...meta } = info as Record<string, unknown> & {
        timestamp: string;
        level: string;
        message: unknown;
        context?: string;
      };
      const safeMessage = Buffer.isBuffer(message) ? message.toString('utf8') : String(message);
      const ctx = context ? ` [${String(context)}]` : '';
      let line = `${timestamp} ${level}${ctx}: ${safeMessage}`;

      const cleanMeta = { ...meta };
      delete (cleanMeta as Record<string, unknown>).service;
      if (Object.keys(cleanMeta).length > 0) {
        line += ` ${safeStringify(cleanMeta, 0)}`;
      }
      return line;
    }),
  );

  const isProd = process.env.NODE_ENV === 'production';

  return {
    level: logLevel,
    levels: winston.config.npm.levels,
    defaultMeta: { service: 'atabai-api' },
    exitOnError: false,
    transports: [
      new DailyRotateFile({
        filename: path.join(logsDir, 'error-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        level: 'error',
        maxSize: '100m',
        maxFiles: '5',
        zippedArchive: true,
        format: fileFormat,
        handleExceptions: true,
        handleRejections: true,
      }),
      new DailyRotateFile({
        filename: path.join(logsDir, 'http-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        level: 'http',
        maxSize: '100m',
        maxFiles: '5',
        zippedArchive: true,
        format: fileFormat,
      }),
      new DailyRotateFile({
        filename: path.join(logsDir, 'combined-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        maxSize: '100m',
        maxFiles: '5',
        zippedArchive: true,
        format: fileFormat,
      }),
      new winston.transports.Console({
        level: isProd ? 'info' : 'debug',
        format: consoleFormat,
        handleExceptions: true,
        handleRejections: true,
      }),
    ],
  };
}
