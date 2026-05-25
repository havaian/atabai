import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import type { IUserMethods, UserDocument } from '../../users/schemas/user.schema';
import { UsersService } from '../../users/users.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { JwtTokenService } from '../jwt-token.service';

/**
 * Replaces the legacy `authenticateJWT` Express middleware. Validates the
 * Bearer token using the user's personal refresh-token secret, attaches the
 * `UserDocument` to `request.user`, and resets the monthly file counter when
 * a month has rolled over (preserving the legacy side-effect).
 *
 * Routes can opt out with `@Public()`.
 *
 * Error codes the frontend depends on are preserved exactly:
 *   ACCESS_TOKEN_REQUIRED, TOKEN_REVOKED, INVALID_TOKEN, USER_NOT_FOUND,
 *   ACCESS_TOKEN_EXPIRED, INVALID_ACCESS_TOKEN, AUTHENTICATION_FAILED.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly users: UsersService,
    private readonly tokens: JwtTokenService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<Request & { user?: UserDocument; token?: string }>();
    const token = this.tokens.extractTokenFromHeader(req.headers.authorization);
    if (!token) throw new UnauthorizedException({ error: 'ACCESS_TOKEN_REQUIRED', message: 'Access token is required' });

    if (await this.tokens.isTokenBlacklisted(token)) {
      throw new UnauthorizedException({ error: 'TOKEN_REVOKED', message: 'Token has been revoked' });
    }

    const decoded = this.tokens.decode(token);
    if (!decoded?.userId) {
      throw new UnauthorizedException({ error: 'INVALID_TOKEN', message: 'Invalid token format' });
    }

    const user = await this.users.findByIdWithSecrets(decoded.userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedException({ error: 'USER_NOT_FOUND', message: 'User not found or inactive' });
    }

    try {
      await this.tokens.verifyAccessToken(token, user);
    } catch (err) {
      const message = (err as Error).message;
      if (message === 'ACCESS_TOKEN_EXPIRED') {
        throw new UnauthorizedException({ error: 'ACCESS_TOKEN_EXPIRED', message: 'Access token has expired' });
      }
      if (message === 'INVALID_ACCESS_TOKEN') {
        throw new UnauthorizedException({ error: 'INVALID_ACCESS_TOKEN', message: 'Invalid access token' });
      }
      throw new UnauthorizedException({ error: 'AUTHENTICATION_FAILED', message: 'Authentication failed' });
    }

    await (user as unknown as IUserMethods).resetMonthlyCounterIfNeeded();

    req.user = user;
    req.token = token;
    return true;
  }
}
