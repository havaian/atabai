import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

import type { MembershipDocument } from '../schemas/membership.schema';

/**
 * Pulls the active membership resolved by OrgMembershipGuard off the request.
 * Use as `@CurrentMembership() membership: MembershipDocument`.
 *
 * Throws at request time if used on a route the guard did not run for —
 * indicates a wiring mistake rather than an auth failure.
 */
export const CurrentMembership = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): MembershipDocument => {
    const req = ctx.switchToHttp().getRequest<Request & { membership?: MembershipDocument }>();
    if (!req.membership) {
      throw new Error(
        'CurrentMembership decorator used on a route not protected by OrgMembershipGuard',
      );
    }
    return req.membership;
  },
);
