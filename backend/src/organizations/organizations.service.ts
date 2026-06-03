import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Types, isValidObjectId } from 'mongoose';

import { AppLoggerService } from '../common/logger/app-logger.service';
import {
  type UserDocument,
  type UserModel,
  User,
} from '../users/schemas/user.schema';
import {
  Membership,
  type MembershipDocument,
  type MembershipModel,
} from './schemas/membership.schema';
import {
  Organization,
  type OrganizationDocument,
  type OrganizationModel,
} from './schemas/organization.schema';
import type { CreateOrganizationDto } from './dto/create-organization.dto';
import type { InviteMemberDto } from './dto/invite-member.dto';
import type { UpdateMembershipDto } from './dto/update-membership.dto';

/**
 * Access spine service — architecture doc §7.6.
 *
 * Invariants enforced here, never in the schema:
 *   - Never-last-admin: a demotion, revocation or role change that would leave
 *     the org with zero active admins is rejected.
 *   - Bootstrap-admin: creating an Organization always pairs it with an admin
 *     Membership for the creator. If the membership write fails, the org is
 *     deleted so we don't leak orphan tenants.
 *   - Pending-email invites resolve on registration (resolvePendingInvitesForUser),
 *     not on invite-creation. The invitee still has to accept after they log in.
 *
 * Authorization checks live in the controller via OrgMembershipGuard. The service
 * trusts that req.membership exists and belongs to the right org. The
 * never-last-admin check IS authorization-adjacent but lives here because it
 * touches multiple rows and needs the org_id context — pushing it to the guard
 * would duplicate the same DB read.
 */
@Injectable()
export class OrganizationsService {
  constructor(
    @InjectModel(Organization.name) private readonly orgModel: OrganizationModel,
    @InjectModel(Membership.name) private readonly membershipModel: MembershipModel,
    @InjectModel(User.name) private readonly userModel: UserModel,
    private readonly logger: AppLoggerService,
  ) {}

  // ─── Create ────────────────────────────────────────────────────────────────

  async createOrganization(
    user: UserDocument,
    dto: CreateOrganizationDto,
  ): Promise<{ organization: OrganizationDocument; membership: MembershipDocument }> {
    const organization = await this.orgModel.create({
      name: dto.name.trim(),
      createdBy: user._id,
    });

    let membership: MembershipDocument;
    try {
      membership = await this.membershipModel.create({
        organizationId: organization._id,
        userId: user._id,
        role: 'admin',
        capabilities: [],
        status: 'active',
        acceptedAt: new Date(),
      });
    } catch (err) {
      // Don't leave an orphan org — we'd never let a tenant exist without an admin.
      await this.orgModel.deleteOne({ _id: organization._id });
      throw err;
    }

    this.logger.logAction('organization.created', {
      orgId: organization._id.toString(),
      orgName: organization.name,
      createdBy: user._id.toString(),
    });

    return { organization, membership };
  }

  // ─── Listing ───────────────────────────────────────────────────────────────

  async listMyOrganizations(user: UserDocument): Promise<
    Array<{
      organization: OrganizationDocument;
      membership: MembershipDocument;
    }>
  > {
    const memberships = await this.membershipModel
      .find({ userId: user._id, status: 'active' })
      .sort({ updatedAt: -1 });

    if (memberships.length === 0) return [];

    const orgIds = memberships.map((m) => m.organizationId);
    const orgs = await this.orgModel.find({ _id: { $in: orgIds }, isActive: true });
    const orgById = new Map(orgs.map((o) => [o._id.toString(), o]));

    return memberships
      .map((m) => {
        const org = orgById.get(m.organizationId.toString());
        return org ? { organization: org, membership: m } : null;
      })
      .filter((x): x is { organization: OrganizationDocument; membership: MembershipDocument } => x !== null);
  }

  async listMyPendingInvites(
    user: UserDocument,
  ): Promise<Array<{ organization: OrganizationDocument; membership: MembershipDocument }>> {
    const memberships = await this.membershipModel
      .find({ userId: user._id, status: 'invited' })
      .sort({ createdAt: -1 });

    if (memberships.length === 0) return [];

    const orgIds = memberships.map((m) => m.organizationId);
    const orgs = await this.orgModel.find({ _id: { $in: orgIds } });
    const orgById = new Map(orgs.map((o) => [o._id.toString(), o]));

    return memberships
      .map((m) => {
        const org = orgById.get(m.organizationId.toString());
        return org ? { organization: org, membership: m } : null;
      })
      .filter((x): x is { organization: OrganizationDocument; membership: MembershipDocument } => x !== null);
  }

  async getOrganization(orgId: string): Promise<OrganizationDocument> {
    if (!isValidObjectId(orgId)) {
      throw new NotFoundException({ error: 'ORG_NOT_FOUND', message: 'Organization not found' });
    }
    const org = await this.orgModel.findById(orgId);
    if (!org || !org.isActive) {
      throw new NotFoundException({ error: 'ORG_NOT_FOUND', message: 'Organization not found' });
    }
    return org;
  }

  async listMembers(orgId: string): Promise<MembershipDocument[]> {
    // Populate the linked User so the controller can surface a human-readable
    // name/email in the members list instead of the raw ObjectId. Pending
    // email invites have userId:null and fall back to invitedEmail.
    return this.membershipModel
      .find({ organizationId: new Types.ObjectId(orgId), status: { $ne: 'revoked' } })
      .populate('userId', 'name email')
      .sort({ status: 1, createdAt: 1 });
  }

  // ─── Invite ────────────────────────────────────────────────────────────────

  async inviteMember(
    actor: UserDocument,
    orgId: string,
    dto: InviteMemberDto,
  ): Promise<MembershipDocument> {
    const orgObjectId = new Types.ObjectId(orgId);
    const normalizedEmail = dto.email.toLowerCase().trim();

    const existingUser = await this.userModel.findOne({ email: normalizedEmail }).lean();

    // Guard against duplicate invites — schema's partial-unique indexes catch
    // race conditions, but we want a clear error message rather than E11000.
    if (existingUser) {
      const collision = await this.membershipModel.findOne({
        organizationId: orgObjectId,
        userId: existingUser._id,
        status: { $ne: 'revoked' },
      });
      if (collision) {
        throw new ConflictException({
          error: 'ALREADY_MEMBER',
          message: 'This user is already a member or has an outstanding invite',
        });
      }
    } else {
      const collision = await this.membershipModel.findOne({
        organizationId: orgObjectId,
        invitedEmail: normalizedEmail,
        status: { $ne: 'revoked' },
      });
      if (collision) {
        throw new ConflictException({
          error: 'INVITE_PENDING',
          message: 'An invite to this email is already pending for this organization',
        });
      }
    }

    const membership = await this.membershipModel.create({
      organizationId: orgObjectId,
      userId: existingUser?._id ?? null,
      invitedEmail: existingUser ? null : normalizedEmail,
      role: dto.role,
      capabilities: dto.role === 'admin' ? [] : (dto.capabilities ?? []),
      status: 'invited',
      invitedBy: actor._id,
      invitedAt: new Date(),
    });

    this.logger.logAction('organization.invite.sent', {
      orgId,
      membershipId: membership._id.toString(),
      invitedEmail: normalizedEmail,
      invitedUserId: existingUser?._id.toString() ?? null,
      role: dto.role,
      invitedBy: actor._id.toString(),
    });

    return membership;
  }

  // ─── Accept ────────────────────────────────────────────────────────────────

  async acceptInvite(user: UserDocument, membershipId: string): Promise<MembershipDocument> {
    if (!isValidObjectId(membershipId)) {
      throw new NotFoundException({
        error: 'INVITE_NOT_FOUND',
        message: 'Invitation not found',
      });
    }

    const membership = await this.membershipModel.findOne({
      _id: new Types.ObjectId(membershipId),
      userId: user._id,
      status: 'invited',
    });

    if (!membership) {
      throw new NotFoundException({
        error: 'INVITE_NOT_FOUND',
        message: 'Invitation not found or already resolved',
      });
    }

    membership.status = 'active';
    membership.acceptedAt = new Date();
    await membership.save();

    this.logger.logAction('organization.invite.accepted', {
      orgId: membership.organizationId.toString(),
      membershipId: membership._id.toString(),
      userId: user._id.toString(),
    });

    return membership;
  }

  // ─── Update / Revoke ───────────────────────────────────────────────────────

  async updateMembership(
    actor: UserDocument,
    orgId: string,
    membershipId: string,
    dto: UpdateMembershipDto,
  ): Promise<MembershipDocument> {
    if (dto.role === undefined && dto.capabilities === undefined) {
      throw new BadRequestException({
        error: 'EMPTY_UPDATE',
        message: 'Provide at least one of: role, capabilities',
      });
    }

    const membership = await this.requireMembership(orgId, membershipId);

    // Demoting an admin requires another active admin to remain.
    if (
      dto.role !== undefined &&
      dto.role !== 'admin' &&
      membership.role === 'admin' &&
      membership.status === 'active'
    ) {
      await this.requireAnotherAdminExists(membership.organizationId, membership._id);
    }

    if (dto.role !== undefined) {
      membership.role = dto.role;
      // Admins implicitly hold every capability — clear the list to avoid drift.
      if (dto.role === 'admin') membership.capabilities = [];
    }
    if (dto.capabilities !== undefined && membership.role !== 'admin') {
      membership.capabilities = dto.capabilities;
    }

    await membership.save();

    this.logger.logAction('organization.member.updated', {
      orgId,
      membershipId,
      actor: actor._id.toString(),
      newRole: membership.role,
      newCapabilities: membership.capabilities,
    });

    return membership;
  }

  async revokeMembership(
    actor: UserDocument,
    orgId: string,
    membershipId: string,
  ): Promise<MembershipDocument> {
    const membership = await this.requireMembership(orgId, membershipId);

    if (membership.status === 'revoked') {
      throw new BadRequestException({
        error: 'ALREADY_REVOKED',
        message: 'Membership is already revoked',
      });
    }

    if (membership.role === 'admin' && membership.status === 'active') {
      await this.requireAnotherAdminExists(membership.organizationId, membership._id);
    }

    membership.status = 'revoked';
    membership.revokedAt = new Date();
    await membership.save();

    this.logger.logAction('organization.member.revoked', {
      orgId,
      membershipId,
      actor: actor._id.toString(),
      revokedUserId: membership.userId?.toString() ?? null,
      revokedEmail: membership.invitedEmail,
    });

    return membership;
  }

  // ─── Registration hook: resolve pending email invites ──────────────────────

  /**
   * Called after a user authenticates (registers or logs in). Finds any
   * memberships pending against their email address with a null userId and
   * resolves them by stamping the userId. Status stays 'invited' — the user
   * still has to accept the invite from their dashboard.
   *
   * Idempotent: no-op when no pending invites exist for the email.
   */
  async resolvePendingInvitesForUser(user: UserDocument): Promise<number> {
    const email = user.email.toLowerCase().trim();
    const result = await this.membershipModel.updateMany(
      { invitedEmail: email, userId: null, status: 'invited' },
      { $set: { userId: user._id, invitedEmail: null } },
    );

    if (result.modifiedCount > 0) {
      this.logger.logAction('organization.invite.resolved', {
        userId: user._id.toString(),
        email,
        invitesResolved: result.modifiedCount,
      });
    }

    return result.modifiedCount;
  }

  // ─── Internal helpers ──────────────────────────────────────────────────────

  private async requireMembership(
    orgId: string,
    membershipId: string,
  ): Promise<MembershipDocument> {
    if (!isValidObjectId(membershipId)) {
      throw new NotFoundException({
        error: 'MEMBER_NOT_FOUND',
        message: 'Membership not found',
      });
    }
    const membership = await this.membershipModel.findOne({
      _id: new Types.ObjectId(membershipId),
      organizationId: new Types.ObjectId(orgId),
    });
    if (!membership) {
      throw new NotFoundException({
        error: 'MEMBER_NOT_FOUND',
        message: 'Membership not found in this organization',
      });
    }
    return membership;
  }

  /**
   * Never-last-admin invariant — throws if the org has no OTHER active admin
   * beyond the one whose role / status is about to change.
   */
  private async requireAnotherAdminExists(
    orgId: Types.ObjectId,
    exceptMembershipId: Types.ObjectId,
  ): Promise<void> {
    const otherActiveAdmins = await this.membershipModel.countDocuments({
      organizationId: orgId,
      role: 'admin',
      status: 'active',
      _id: { $ne: exceptMembershipId },
    });
    if (otherActiveAdmins === 0) {
      throw new ForbiddenException({
        error: 'LAST_ADMIN',
        message:
          'Cannot demote or revoke the last active admin. Promote someone else to admin first.',
      });
    }
  }
}
