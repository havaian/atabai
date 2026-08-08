import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  mixin,
  Type,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

import type { SubscriptionType } from '../../common/constants/subscription';
import type { UserDocument } from '../../users/schemas/user.schema';

/**
 * Mixin guard factory - yields a guard that requires a specific subscription
 * tier. Use as `@UseGuards(RequireSubscription('premium'))`. Ported from the
 * legacy `requireSubscription` middleware.
 */
export function RequireSubscription(required: SubscriptionType = 'premium'): Type<CanActivate> {
  @Injectable()
  class SubscriptionGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
      const req = context.switchToHttp().getRequest<Request & { user?: UserDocument }>();
      const user = req.user;
      if (!user) {
        throw new UnauthorizedException({
          error: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication required',
        });
      }
      if (required === 'premium' && user.subscriptionType !== 'premium') {
        throw new ForbiddenException({
          error: 'PREMIUM_REQUIRED',
          message: 'Premium subscription required for this feature',
        });
      }
      if (user.subscriptionType === 'premium') {
        if (!user.subscriptionExpiresAt || user.subscriptionExpiresAt < new Date()) {
          throw new ForbiddenException({
            error: 'SUBSCRIPTION_EXPIRED',
            message: 'Your premium subscription has expired',
          });
        }
      }
      return true;
    }
  }

  return mixin(SubscriptionGuard);
}
