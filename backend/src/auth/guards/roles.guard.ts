import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { AppLoggerService } from '../../common/logger/app-logger.service';
import type { UserDocument, UserRole } from '../../users/schemas/user.schema';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * Role gate for admin routes. Ported from backend/src/admin/middleware.js
 * `requireRole`. Pair with `@Roles(...)` decorator. Assumes JwtAuthGuard ran
 * first and attached `req.user`.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly logger: AppLoggerService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const allowed = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!allowed || allowed.length === 0) return true;

    const req = context.switchToHttp().getRequest<Request & { user?: UserDocument }>();
    const user = req.user;
    if (!user) {
      throw new UnauthorizedException({ error: 'AUTH_REQUIRED', message: 'Authentication is required' });
    }

    if (!allowed.includes(user.role)) {
      this.logger.logSecurity('Role check failed', {
        userId: user._id.toString(),
        email: user.email,
        userRole: user.role,
        requiredRoles: allowed,
        path: req.originalUrl ?? req.url,
      });
      throw new ForbiddenException({ error: 'FORBIDDEN', message: 'Insufficient permissions' });
    }

    return true;
  }
}
