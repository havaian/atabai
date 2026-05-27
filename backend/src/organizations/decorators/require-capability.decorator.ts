import { SetMetadata } from '@nestjs/common';

import type { MembershipCapability } from '../constants/membership-capabilities';

export const REQUIRE_CAPABILITY_KEY = 'org.requireCapability';

/**
 * Restrict a route to memberships that hold at least one of the listed
 * capabilities (OR membership.role === 'admin', which implies all). Pair with
 * OrgMembershipGuard.
 *
 * If a route is org-scoped but doesn't need a specific capability beyond
 * "active member of this org," omit this decorator — the guard still resolves
 * and attaches `req.membership`.
 */
export const RequireCapability = (
  ...caps: MembershipCapability[]
): MethodDecorator & ClassDecorator => SetMetadata(REQUIRE_CAPABILITY_KEY, caps);
