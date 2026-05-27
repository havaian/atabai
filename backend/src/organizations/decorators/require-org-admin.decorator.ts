import { SetMetadata } from '@nestjs/common';

export const REQUIRE_ORG_ADMIN_KEY = 'org.requireAdmin';

/**
 * Restrict an org-scoped route to admin memberships only. Pair with
 * OrgMembershipGuard — the guard fails the request with 403 INSUFFICIENT_ROLE
 * for non-admin active members. super_admin still passes (its synthetic
 * membership carries role='admin').
 */
export const RequireOrgAdmin = (): MethodDecorator & ClassDecorator =>
  SetMetadata(REQUIRE_ORG_ADMIN_KEY, true);
