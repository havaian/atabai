import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';

import type { IUserMethods, UserDocument } from '../../users/schemas/user.schema';
import { UsersService } from '../../users/users.service';
import { JwtTokenService } from '../jwt-token.service';

/**
 * Attaches the user to the request if a valid token is provided, but never
 * fails the request when missing/invalid - for endpoints where logged-in vs.
 * anonymous changes behavior but both are allowed. Ports the legacy
 * `optionalAuth` middleware.
 */
@Injectable()
export class OptionalJwtAuthGuard implements CanActivate {
  constructor(
    private readonly users: UsersService,
    private readonly tokens: JwtTokenService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { user?: UserDocument; token?: string }>();
    const token = this.tokens.extractTokenFromHeader(req.headers.authorization);
    if (!token) return true;
    if (await this.tokens.isTokenBlacklisted(token)) return true;

    const decoded = this.tokens.decode(token);
    if (!decoded?.userId) return true;

    const user = await this.users.findByIdWithSecrets(decoded.userId);
    if (!user || !user.isActive) return true;

    try {
      await this.tokens.verifyAccessToken(token, user);
      await (user as unknown as IUserMethods).resetMonthlyCounterIfNeeded();
      req.user = user;
      req.token = token;
    } catch {
      // ignore - anonymous is fine
    }
    return true;
  }
}
