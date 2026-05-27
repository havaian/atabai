import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

/**
 * Pulls the active organization id from the `X-Active-Org-Id` request header.
 *
 * Why a header (vs. a URL segment)?
 *   - The legacy /api/files/* routes don't carry an :orgId. Re-shaping them
 *     to /organizations/:orgId/files/* would break every existing frontend
 *     call site. The header is additive — pre-org clients send nothing,
 *     org-aware clients send the active org id.
 *   - The frontend orgs store already exposes `currentOrgId`; an axios
 *     interceptor attaches it as `X-Active-Org-Id` on every request.
 *
 * This decorator only EXTRACTS the value. Authorization (does this user
 * actually belong to that org?) is the service's responsibility, performed
 * via the existing Membership lookup. Splitting extraction from
 * authorization mirrors the OrgMembershipGuard / @CurrentMembership split.
 *
 * Header value is case-insensitive per HTTP. Express lowercases names on
 * `req.headers` so we always read the lowercase form.
 *
 * Returns `null` when the header is absent. Callers decide whether that's
 * a hard failure (uploads) or a soft empty-state (list endpoints).
 *
 * NOTE: this decorator does NOT validate the format of the id. Mongo will
 * throw `BSONError` if you blindly cast a malformed string to ObjectId, so
 * callers must guard with `isValidObjectId(...)` or equivalent.
 */
export const ActiveOrgId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | null => {
    const req = ctx.switchToHttp().getRequest<Request>();
    const raw = req.headers['x-active-org-id'];
    // Express may give us a string or string[] depending on whether the
    // header appeared multiple times. Take the first non-empty value.
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (!value || typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  },
);
