import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

import { getFileLimit } from '../../common/constants/subscription';
import { AppLoggerService } from '../../common/logger/app-logger.service';
import type { IUserMethods, UserDocument } from '../../users/schemas/user.schema';

/**
 * Verifies the user hasn't exceeded their monthly file processing quota.
 * Ports the legacy `checkFileProcessingLimit` middleware. Used on the
 * /files/upload route.
 */
@Injectable()
export class FileProcessingLimitGuard implements CanActivate {
  constructor(private readonly logger: AppLoggerService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { user?: UserDocument }>();
    const user = req.user;
    if (!user) {
      throw new UnauthorizedException({
        error: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required',
      });
    }

    try {
      const canProcess = await (user as unknown as IUserMethods).canProcessFiles();
      if (!canProcess) {
        const limit = getFileLimit(user.subscriptionType);
        throw new ForbiddenException({
          error: 'MONTHLY_LIMIT_REACHED',
          message: 'Monthly file processing limit reached',
          limit,
          processed: user.filesProcessedThisMonth,
          resetDate: user.monthlyResetDate,
        });
      }
      return true;
    } catch (err) {
      if (err instanceof ForbiddenException) throw err;
      this.logger.error(err, { context: 'FileProcessingLimitGuard' });
      throw new InternalServerErrorException({
        error: 'LIMIT_CHECK_FAILED',
        message: 'Failed to check processing limit',
      });
    }
  }
}
