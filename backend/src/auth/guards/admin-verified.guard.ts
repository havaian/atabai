import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

import { AppLoggerService } from '../../common/logger/app-logger.service';
import type { UserDocument } from '../../users/schemas/user.schema';
import type { AdminSessionDocument } from '../schemas/admin-session.schema';
import { TwoFactorService } from '../two-factor.service';

/**
 * Requires the admin to have a live AdminSession (i.e. passed 2FA recently).
 * Ports the legacy `requireAdminVerified` middleware verbatim, including the
 * error codes the frontend admin store keys off:
 *
 *   - 2FA_REQUIRED_SETUP - admin hasn't enrolled yet
 *   - 2FA_REQUIRED_VERIFY - enrolled but no/expired/mismatched session
 *
 * The session id arrives in the `X-Admin-Session` header.
 */
@Injectable()
export class AdminVerifiedGuard implements CanActivate {
  constructor(
    private readonly twoFactor: TwoFactorService,
    private readonly logger: AppLoggerService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<
      Request & { user?: UserDocument; adminSession?: AdminSessionDocument }
    >();

    if (!req.user) {
      throw new UnauthorizedException({ error: 'AUTH_REQUIRED', message: 'Authentication is required' });
    }

    if (!req.user.totpEnabled) {
      throw new ForbiddenException({
        error: '2FA_REQUIRED_SETUP',
        message: '2FA enrollment is required before accessing admin features',
      });
    }

    const sid = req.get?.('X-Admin-Session');
    if (!sid) {
      throw new ForbiddenException({
        error: '2FA_REQUIRED_VERIFY',
        message: 'Admin session header is missing',
      });
    }

    const session = await this.twoFactor.findSession(sid);
    if (!session) {
      throw new ForbiddenException({
        error: '2FA_REQUIRED_VERIFY',
        message: 'Admin session not found or expired',
      });
    }
    if (String(session.userId) !== String(req.user._id)) {
      this.logger.logSecurity(
        'Admin session/user mismatch',
        {
          sessionUserId: session.userId.toString(),
          requestUserId: req.user._id.toString(),
          requestEmail: req.user.email,
          path: req.originalUrl ?? req.url,
        },
        'warn',
      );
      throw new ForbiddenException({
        error: '2FA_REQUIRED_VERIFY',
        message: 'Admin session does not match user',
      });
    }
    if (session.expiresAt < new Date()) {
      // Defensive: TTL should sweep it but reject + clean up if not.
      await this.twoFactor.deleteSessionById(session._id);
      throw new ForbiddenException({
        error: '2FA_REQUIRED_VERIFY',
        message: 'Admin session expired',
      });
    }

    req.adminSession = session;
    return true;
  }
}
