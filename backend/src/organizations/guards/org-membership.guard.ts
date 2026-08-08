import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectModel } from '@nestjs/mongoose';
import type { Request } from 'express';
import { Types, isValidObjectId } from 'mongoose';

import { AppLoggerService } from '../../common/logger/app-logger.service';
import type { UserDocument } from '../../users/schemas/user.schema';
import {
  MEMBERSHIP_CAPABILITIES,
  type MembershipCapability,
} from '../constants/membership-capabilities';
import { REQUIRE_CAPABILITY_KEY } from '../decorators/require-capability.decorator';
import { REQUIRE_ORG_ADMIN_KEY } from '../decorators/require-org-admin.decorator';
import {
  Membership,
  type MembershipDocument,
  type MembershipModel,
} from '../schemas/membership.schema';

type RequestWithMembership = Request & {
  user?: UserDocument;
  membership?: MembershipDocument;
  params?: Record<string, string>;
  body?: Record<string, unknown>;
};

/**
 * Org-scoped authorization, parallel to RolesGuard (architecture doc §7.6).
 *
 * Order of operations:
 *   1. Verify JwtAuthGuard ran (req.user populated) - else 401.
 *   2. Resolve org id from :orgId / :organizationId / body.organizationId.
 *   3. super_admin: audit the access, attach a synthetic membership, allow.
 *   4. Find an active Membership for (orgId, userId) - else 403.
 *   5. Attach req.membership. If @RequireCapability(...) is present, allow
 *      when role === 'admin' OR the cap intersection is non-empty; else 403.
 *
 * Inline ownership checks (`org.createdBy.equals(user._id)`) are NOT
 * permitted anywhere in the codebase - they would re-couple authorization
 * to a single grantee shape and block the future Firm layer.
 */
@Injectable()
export class OrgMembershipGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly logger: AppLoggerService,
    @InjectModel(Membership.name) private readonly membershipModel: MembershipModel,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<RequestWithMembership>();

    const user = req.user;
    if (!user) {
      throw new UnauthorizedException({
        error: 'AUTH_REQUIRED',
        message: 'Authentication is required',
      });
    }

    const orgId = this.resolveOrgId(req);
    if (!orgId) {
      throw new ForbiddenException({
        error: 'ORG_NOT_RESOLVED',
        message: 'Organization id not present on request',
      });
    }
    if (!isValidObjectId(orgId)) {
      throw new ForbiddenException({
        error: 'ORG_INVALID',
        message: 'Organization id is not a valid identifier',
      });
    }

    const requiredCaps = this.reflector.getAllAndOverride<MembershipCapability[]>(
      REQUIRE_CAPABILITY_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (user.role === 'super_admin') {
      this.logger.logSecurity(
        'super_admin org access',
        {
          userId: user._id.toString(),
          email: user.email,
          orgId,
          requiredCapabilities: requiredCaps ?? [],
          path: req.originalUrl ?? req.url,
        },
        'info',
      );
      req.membership = this.syntheticSuperAdminMembership(orgId, user);
      return true;
    }

    const membership = await this.membershipModel.findOne({
      organizationId: new Types.ObjectId(orgId),
      userId: user._id,
      status: 'active',
    });

    if (!membership) {
      throw new ForbiddenException({
        error: 'NOT_A_MEMBER',
        message: 'You are not an active member of this organization',
      });
    }

    req.membership = membership;

    const requireAdmin = this.reflector.getAllAndOverride<boolean>(REQUIRE_ORG_ADMIN_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (requireAdmin && membership.role !== 'admin') {
      this.logger.logSecurity('Admin-only route blocked', {
        userId: user._id.toString(),
        email: user.email,
        orgId,
        role: membership.role,
        path: req.originalUrl ?? req.url,
      });
      throw new ForbiddenException({
        error: 'INSUFFICIENT_ROLE',
        message: 'This action requires admin role within the organization',
      });
    }

    if (!requiredCaps || requiredCaps.length === 0) return true;
    if (membership.role === 'admin') return true;

    const hasAny = requiredCaps.some((cap) => membership.capabilities.includes(cap));
    if (!hasAny) {
      this.logger.logSecurity('Capability check failed', {
        userId: user._id.toString(),
        email: user.email,
        orgId,
        role: membership.role,
        capabilities: membership.capabilities,
        requiredCapabilities: requiredCaps,
        path: req.originalUrl ?? req.url,
      });
      throw new ForbiddenException({
        error: 'INSUFFICIENT_CAPABILITY',
        message: 'Insufficient capabilities for this action',
      });
    }

    return true;
  }

  private resolveOrgId(req: RequestWithMembership): string | null {
    const fromParams = req.params?.orgId ?? req.params?.organizationId;
    if (fromParams) return fromParams;
    const fromBody = req.body?.organizationId;
    return typeof fromBody === 'string' ? fromBody : null;
  }

  /**
   * Synthetic, unsaved membership doc for the super_admin bypass path. Carries
   * admin role + full capability set so downstream `@CurrentMembership` users
   * see a consistent shape. Never persisted - `.isNew` will be true if anyone
   * needs to distinguish a real membership from a recovery-path one.
   */
  private syntheticSuperAdminMembership(orgId: string, user: UserDocument): MembershipDocument {
    return new this.membershipModel({
      organizationId: new Types.ObjectId(orgId),
      userId: user._id,
      role: 'admin',
      status: 'active',
      capabilities: Object.values(MEMBERSHIP_CAPABILITIES),
    });
  }
}
