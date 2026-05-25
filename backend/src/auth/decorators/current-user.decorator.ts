import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

import type { UserDocument } from '../../users/schemas/user.schema';

/**
 * Pulls the authenticated user off the request — the JwtAuthGuard puts it there.
 * Use as `@CurrentUser() user: UserDocument` in controller methods.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): UserDocument => {
    const req = ctx.switchToHttp().getRequest<Request & { user?: UserDocument }>();
    if (!req.user) throw new Error('CurrentUser decorator used on an unauthenticated route');
    return req.user;
  },
);
