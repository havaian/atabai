import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { Error as MongooseError } from 'mongoose';

import { AppLoggerService } from '../logger/app-logger.service';

interface ErrorBody {
  success: false;
  error: string;
  message: string;
  details?: unknown;
  field?: string;
  stack?: string;
  requestId?: string;
}

interface MongoServerErrorLike {
  code?: number;
  keyValue?: Record<string, unknown>;
  name?: string;
}

interface MulterErrorLike {
  code?: string;
  type?: string;
}

interface AppErrorShape {
  statusCode?: number;
  error?: string;
  details?: unknown;
  isOperational?: boolean;
}

/**
 * Global exception filter - ports the legacy errorHandler middleware.
 *
 * Behavior preserved:
 *   - Mongoose CastError → 404 RESOURCE_NOT_FOUND
 *   - MongoDB E11000   → 400 DUPLICATE_FIELD with the offending field
 *   - Mongoose ValidationError → 400 VALIDATION_ERROR with per-field details
 *   - JWT JsonWebTokenError / TokenExpiredError → 401
 *   - MongoServerError → 500 DATABASE_ERROR
 *   - Multer file errors → 400 with specific error codes
 *   - express body-parser entity errors → 400 / 413
 *   - HttpException (Nest's built-in) → its own status/message
 *   - Anything else → 500 INTERNAL_SERVER_ERROR
 *
 * Response shape matches the legacy {success:false, error, message, details?, field?}
 * so the frontend doesn't need any changes to its error handling.
 */
@Injectable()
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: AppLoggerService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const body = this.toErrorBody(exception);

    // Log with request context, matching the legacy errorHandler shape.
    this.logger.error(exception instanceof Error ? exception : new Error(body.message), {
      method: request.method,
      url: request.originalUrl ?? request.url,
      ip: request.ip,
      userAgent: request.get?.('User-Agent'),
      userId: (request as Request & { user?: { id?: string; _id?: string } }).user?.id,
      body: request.method !== 'GET' ? request.body : undefined,
      status: this.statusFromBody(body, exception),
    });

    const status = this.statusFromBody(body, exception);

    if (process.env.NODE_ENV === 'development' && exception instanceof Error) {
      body.stack = exception.stack;
    }

    const requestId = (request as Request & { requestId?: string }).requestId;
    if (requestId) body.requestId = requestId;

    response.status(status).json(body);
  }

  private toErrorBody(exception: unknown): ErrorBody {
    // Mongoose CastError (bad ObjectId, etc.)
    if (this.isMongooseError(exception, 'CastError')) {
      return {
        success: false,
        error: 'RESOURCE_NOT_FOUND',
        message: 'Resource not found',
      };
    }

    // Mongoose duplicate key
    if (this.isMongoDuplicateKey(exception)) {
      const dup = exception as MongoServerErrorLike;
      const field = dup.keyValue ? Object.keys(dup.keyValue)[0] : undefined;
      return {
        success: false,
        error: 'DUPLICATE_FIELD',
        message: field ? `${field} already exists` : 'Duplicate field',
        field,
      };
    }

    // Mongoose ValidationError
    if (this.isMongooseError(exception, 'ValidationError')) {
      const err = exception as MongooseError.ValidationError;
      const fieldErrors = Object.values(err.errors ?? {});
      return {
        success: false,
        error: 'VALIDATION_ERROR',
        message: fieldErrors.map((e) => e.message).join(', '),
        details: fieldErrors.map((e) => ({
          field: (e as MongooseError.ValidatorError).path,
          message: e.message,
          value: (e as MongooseError.ValidatorError).value,
        })),
      };
    }

    // JWT errors
    if (this.isErrorWithName(exception, 'JsonWebTokenError')) {
      return { success: false, error: 'INVALID_TOKEN', message: 'Invalid token' };
    }
    if (this.isErrorWithName(exception, 'TokenExpiredError')) {
      return { success: false, error: 'TOKEN_EXPIRED', message: 'Token expired' };
    }

    // Mongo driver errors
    if (
      this.isErrorWithName(exception, 'MongoError') ||
      this.isErrorWithName(exception, 'MongoServerError')
    ) {
      return {
        success: false,
        error: 'DATABASE_ERROR',
        message: 'Database operation failed',
      };
    }

    // Multer
    if (this.isMulterCode(exception, 'LIMIT_FILE_SIZE')) {
      return { success: false, error: 'FILE_TOO_LARGE', message: 'File size exceeds limit' };
    }
    if (this.isMulterCode(exception, 'LIMIT_FILE_COUNT')) {
      return { success: false, error: 'TOO_MANY_FILES', message: 'Too many files uploaded' };
    }
    if (this.isMulterCode(exception, 'LIMIT_UNEXPECTED_FILE')) {
      return { success: false, error: 'UNEXPECTED_FILE', message: 'Unexpected file field' };
    }

    // express body-parser
    const errType = (exception as { type?: string })?.type;
    if (errType === 'entity.parse.failed') {
      return { success: false, error: 'INVALID_JSON', message: 'Invalid JSON in request body' };
    }
    if (errType === 'entity.too.large') {
      return { success: false, error: 'PAYLOAD_TOO_LARGE', message: 'Request payload too large' };
    }

    // Nest HttpException (covers BadRequest, Unauthorized, Forbidden, NotFound, etc.)
    if (exception instanceof HttpException) {
      const resp = exception.getResponse();
      if (typeof resp === 'object' && resp !== null) {
        const r = resp as Record<string, unknown>;
        return {
          success: false,
          error: typeof r.error === 'string' ? r.error : exception.name,
          message:
            typeof r.message === 'string'
              ? r.message
              : Array.isArray(r.message)
                ? (r.message as string[]).join(', ')
                : exception.message,
          details: r.details ?? (Array.isArray(r.message) ? r.message : undefined),
        };
      }
      return {
        success: false,
        error: exception.name,
        message: typeof resp === 'string' ? resp : exception.message,
      };
    }

    // Custom AppError-like (statusCode / error / isOperational)
    if (this.isAppErrorShape(exception)) {
      const e = exception as AppErrorShape & { message?: string };
      return {
        success: false,
        error: e.error ?? 'APPLICATION_ERROR',
        message: e.message ?? 'Application error',
        details: e.details,
      };
    }

    const fallbackMessage =
      exception instanceof Error ? exception.message : 'Internal server error';

    return {
      success: false,
      error: 'INTERNAL_SERVER_ERROR',
      message: fallbackMessage,
    };
  }

  private statusFromBody(body: ErrorBody, exception: unknown): number {
    if (exception instanceof HttpException) return exception.getStatus();
    if (this.isMongooseError(exception, 'CastError')) return HttpStatus.NOT_FOUND;
    if (this.isMongoDuplicateKey(exception)) return HttpStatus.BAD_REQUEST;
    if (this.isMongooseError(exception, 'ValidationError')) return HttpStatus.BAD_REQUEST;
    if (this.isErrorWithName(exception, 'JsonWebTokenError')) return HttpStatus.UNAUTHORIZED;
    if (this.isErrorWithName(exception, 'TokenExpiredError')) return HttpStatus.UNAUTHORIZED;
    if (this.isErrorWithName(exception, 'MongoServerError')) return HttpStatus.INTERNAL_SERVER_ERROR;
    if (this.isMulterCode(exception, 'LIMIT_FILE_SIZE')) return HttpStatus.BAD_REQUEST;
    if (this.isMulterCode(exception, 'LIMIT_FILE_COUNT')) return HttpStatus.BAD_REQUEST;
    if (this.isMulterCode(exception, 'LIMIT_UNEXPECTED_FILE')) return HttpStatus.BAD_REQUEST;

    const errType = (exception as { type?: string })?.type;
    if (errType === 'entity.parse.failed') return HttpStatus.BAD_REQUEST;
    if (errType === 'entity.too.large') return HttpStatus.PAYLOAD_TOO_LARGE;

    if (this.isAppErrorShape(exception)) {
      return (exception as AppErrorShape).statusCode ?? HttpStatus.INTERNAL_SERVER_ERROR;
    }
    void body;
    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private isErrorWithName(e: unknown, name: string): e is Error & { name: string } {
    return typeof e === 'object' && e !== null && (e as { name?: string }).name === name;
  }

  private isMongooseError(e: unknown, name: 'CastError' | 'ValidationError'): boolean {
    return this.isErrorWithName(e, name);
  }

  private isMongoDuplicateKey(e: unknown): boolean {
    return typeof e === 'object' && e !== null && (e as MongoServerErrorLike).code === 11000;
  }

  private isMulterCode(e: unknown, code: string): boolean {
    return typeof e === 'object' && e !== null && (e as MulterErrorLike).code === code;
  }

  private isAppErrorShape(e: unknown): boolean {
    return (
      typeof e === 'object' &&
      e !== null &&
      ((e as AppErrorShape).isOperational === true ||
        typeof (e as AppErrorShape).statusCode === 'number')
    );
  }
}
