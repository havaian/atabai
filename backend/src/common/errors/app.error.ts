/**
 * Ported from the legacy AppError class — used by services that throw
 * typed errors caught by the global AllExceptionsFilter.
 *
 * Prefer Nest's built-in HttpException subclasses (BadRequestException,
 * NotFoundException, etc.) for common cases; reach for AppError when you
 * need a specific machine-readable `error` code that the frontend keys off.
 */
export class AppError extends Error {
  readonly statusCode: number;
  readonly error: string;
  readonly details?: unknown;
  readonly isOperational = true;

  constructor(message: string, statusCode = 500, errorCode = 'APPLICATION_ERROR', details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.error = errorCode;
    this.details = details;
    Error.captureStackTrace?.(this, this.constructor);
  }
}
