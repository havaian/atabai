import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ActiveOrgId } from '../common/decorators/active-org-id.decorator';
import type { UserDocument } from '../users/schemas/user.schema';
import { CurrentMembership } from './decorators/current-membership.decorator';
import { RequireOrgAdmin } from './decorators/require-org-admin.decorator';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMembershipDto } from './dto/update-membership.dto';
import { OrgMembershipGuard } from './guards/org-membership.guard';
import { OrganizationsService } from './organizations.service';
import type {
  MembershipDocument,
  MembershipRole,
  MembershipStatus,
} from './schemas/membership.schema';
import type { OrganizationDocument } from './schemas/organization.schema';

/**
 * Mounted at /api/organizations.
 *
 * Routes split into two zones:
 *   - Bare-authed (JwtAuthGuard only): create, list-mine, list-pending-invites,
 *     accept-invite. The invitee can't yet pass OrgMembershipGuard for the
 *     target org, so accept lives outside the org-scoped namespace.
 *   - Org-scoped (JwtAuthGuard + OrgMembershipGuard via :orgId): get one,
 *     list members, invite, update, revoke. Admin-only writes carry
 *     @RequireOrgAdmin.
 */
@Controller('organizations')
@UseGuards(JwtAuthGuard)
export class OrganizationsController {
  constructor(private readonly orgs: OrganizationsService) {}

  // ─── Bare-authed routes ─────────────────────────────────────────────────────

  @Post()
  async create(@CurrentUser() user: UserDocument, @Body() body: CreateOrganizationDto) {
    const { organization, membership } = await this.orgs.createOrganization(user, body);
    return {
      success: true,
      organization: this.serializeOrganization(organization),
      membership: this.serializeMembership(membership),
    };
  }

  @Get()
  async listMine(@CurrentUser() user: UserDocument) {
    const items = await this.orgs.listMyOrganizations(user);
    return {
      success: true,
      organizations: items.map(({ organization, membership }) => ({
        ...this.serializeOrganization(organization),
        membership: this.serializeMembership(membership),
      })),
    };
  }

  @Get('pending-invites')
  async listPendingInvites(@CurrentUser() user: UserDocument) {
    const items = await this.orgs.listMyPendingInvites(user);
    return {
      success: true,
      invites: items.map(({ organization, membership }) => ({
        organization: this.serializeOrganization(organization),
        membership: this.serializeMembership(membership),
      })),
    };
  }

  /**
   * GET /api/organizations/session — authoritative session resolver.
   *
   * The frontend must NOT gate UI on its own localStorage idea of
   * "current org". It calls this endpoint after auth and on every org
   * switch; the server is the source of truth for:
   *   - which orgs the caller is actually a member of,
   *   - which one is the *valid* active org (the X-Active-Org-Id claim
   *     is honoured only if it matches an active membership; otherwise
   *     the server picks one for the client, or null when none exist),
   *   - what capabilities apply within that active org (so the frontend
   *     can hide actions the user couldn't perform anyway).
   *
   * This is the spine the sidebar nav reads. Same response on every call;
   * if the client lies about activeOrgId the server overrides — keeping
   * presentation and authorization in sync at the only place they can
   * actually be in sync.
   *
   * Pending invites are included so the dashboard / org-list view doesn't
   * have to do a second round-trip on bootstrap.
   */
  @Get('session')
  async getSession(
    @CurrentUser() user: UserDocument,
    @ActiveOrgId() claimedActiveOrgId: string | null,
  ) {
    const [items, invites] = await Promise.all([
      this.orgs.listMyOrganizations(user),
      this.orgs.listMyPendingInvites(user),
    ]);

    // Resolve the activeOrgId:
    //   - If the client claimed an org via header AND it's in their
    //     active memberships, honour it.
    //   - Else, if they have any active org, pick the first (most-
    //     recently-touched per listMyOrganizations sort order). This
    //     keeps the UX sane after a stale localStorage value.
    //   - Else null (the onboarding flow takes over).
    let activeOrgId: string | null = null;
    let activeMembership: MembershipDocument | null = null;
    if (claimedActiveOrgId) {
      const claimed = items.find(
        ({ organization }) => organization._id.toString() === claimedActiveOrgId,
      );
      if (claimed) {
        activeOrgId = claimed.organization._id.toString();
        activeMembership = claimed.membership;
      }
      // Otherwise fall through: the client's claim is invalid (stale
      // localStorage, revoked membership, etc.) and we DON'T silently
      // promote them into another org by accident — but we do default
      // to one below so they have a usable session.
    }
    if (!activeOrgId && items.length > 0) {
      activeOrgId = items[0].organization._id.toString();
      activeMembership = items[0].membership;
    }

    // Derive the capabilities applicable RIGHT NOW. Admin role implies
    // all capabilities — the frontend uses this set to decide which nav
    // items to render and which actions to enable.
    const isAdmin = activeMembership?.role === 'admin';
    const capabilities = activeMembership
      ? isAdmin
        ? ['nsbu.base.read', 'nsbu.base.write', 'ifrs.overlay.read', 'ifrs.overlay.write']
        : [...activeMembership.capabilities]
      : [];

    return {
      success: true,
      session: {
        userId: user._id.toString(),
        // The authoritative active org. Client overwrites its localStorage
        // with this on every /session response; that's how a stale or
        // tampered claim self-corrects on next request.
        activeOrgId,
        // Boolean shortcuts the frontend nav cares about. Backed by the
        // membership row, not by anything client-controllable.
        hasAnyOrg: items.length > 0,
        hasInvites: invites.length > 0,
        isOrgAdmin: !!isAdmin,
        capabilities,
      },
      organizations: items.map(({ organization, membership }) => ({
        ...this.serializeOrganization(organization),
        membership: this.serializeMembership(membership),
      })),
      pendingInvites: invites.map(({ organization, membership }) => ({
        organization: this.serializeOrganization(organization),
        membership: this.serializeMembership(membership),
      })),
    };
  }

  @Post('invites/:membershipId/accept')
  @HttpCode(200)
  async acceptInvite(
    @CurrentUser() user: UserDocument,
    @Param('membershipId') membershipId: string,
  ) {
    const membership = await this.orgs.acceptInvite(user, membershipId);
    return { success: true, membership: this.serializeMembership(membership) };
  }

  // ─── Org-scoped routes ─────────────────────────────────────────────────────

  @Get(':orgId')
  @UseGuards(OrgMembershipGuard)
  async get(@Param('orgId') orgId: string, @CurrentMembership() membership: MembershipDocument) {
    const organization = await this.orgs.getOrganization(orgId);
    return {
      success: true,
      organization: this.serializeOrganization(organization),
      membership: this.serializeMembership(membership),
    };
  }

  @Get(':orgId/members')
  @UseGuards(OrgMembershipGuard)
  async listMembers(@CurrentUser() user: UserDocument, @Param('orgId') orgId: string) {
    const members = await this.orgs.listMembers(orgId);
    return {
      success: true,
      // The caller's own id, so the UI can mark their row as "You" and
      // block self-edit. Sent explicitly rather than inferred client-side
      // because the client doesn't otherwise hold its own user id here.
      currentUserId: user._id.toString(),
      members: members.map((m) => this.serializeMembership(m)),
    };
  }

  @Post(':orgId/invites')
  @UseGuards(OrgMembershipGuard)
  @RequireOrgAdmin()
  async invite(
    @CurrentUser() user: UserDocument,
    @Param('orgId') orgId: string,
    @Body() body: InviteMemberDto,
  ) {
    const membership = await this.orgs.inviteMember(user, orgId, body);
    return { success: true, membership: this.serializeMembership(membership) };
  }

  @Patch(':orgId/members/:membershipId')
  @UseGuards(OrgMembershipGuard)
  @RequireOrgAdmin()
  async updateMember(
    @CurrentUser() user: UserDocument,
    @Param('orgId') orgId: string,
    @Param('membershipId') membershipId: string,
    @Body() body: UpdateMembershipDto,
  ) {
    const membership = await this.orgs.updateMembership(user, orgId, membershipId, body);
    return { success: true, membership: this.serializeMembership(membership) };
  }

  @Delete(':orgId/members/:membershipId')
  @HttpCode(200)
  @UseGuards(OrgMembershipGuard)
  @RequireOrgAdmin()
  async revokeMember(
    @CurrentUser() user: UserDocument,
    @Param('orgId') orgId: string,
    @Param('membershipId') membershipId: string,
  ) {
    const membership = await this.orgs.revokeMembership(user, orgId, membershipId);
    return { success: true, membership: this.serializeMembership(membership) };
  }

  // ─── Serializers ───────────────────────────────────────────────────────────

  private serializeOrganization(org: OrganizationDocument) {
    return {
      id: org._id.toString(),
      name: org.name,
      createdBy: org.createdBy.toString(),
      isActive: org.isActive,
      createdAt: (org as unknown as { createdAt: Date }).createdAt,
      updatedAt: (org as unknown as { updatedAt: Date }).updatedAt,
    };
  }

  private serializeMembership(m: MembershipDocument): {
    id: string;
    organizationId: string;
    userId: string | null;
    userName: string | null;
    userEmail: string | null;
    invitedEmail: string | null;
    role: MembershipRole;
    capabilities: string[];
    status: MembershipStatus;
    invitedBy: string | null;
    invitedAt: Date | null;
    acceptedAt: Date | null;
    revokedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  } {
    // userId may be a raw ObjectId (most call sites) or a populated User doc
    // (listMembers populates 'name email'). Detect the populated shape and
    // pull name/email; otherwise leave them null and keep userId as the id
    // string so the existing contract is unchanged. Typed structurally (both
    // an ObjectId and a populated User doc expose toString()/_id) so this
    // file needs no mongoose Types import.
    const rawUserId = m.userId as unknown as
      | { _id: { toString(): string }; name?: string; email?: string }
      | { toString(): string }
      | null;
    let userId: string | null = null;
    let userName: string | null = null;
    let userEmail: string | null = null;
    if (rawUserId) {
      if (
        typeof rawUserId === 'object' &&
        '_id' in rawUserId &&
        (rawUserId as { name?: string }).name !== undefined
      ) {
        const populated = rawUserId as {
          _id: { toString(): string };
          name?: string;
          email?: string;
        };
        userId = populated._id.toString();
        userName = populated.name ?? null;
        userEmail = populated.email ?? null;
      } else {
        userId = (rawUserId as { toString(): string }).toString();
      }
    }

    return {
      id: m._id.toString(),
      organizationId: m.organizationId.toString(),
      userId,
      userName,
      userEmail,
      invitedEmail: m.invitedEmail,
      role: m.role,
      capabilities: m.capabilities,
      status: m.status,
      invitedBy: m.invitedBy?.toString() ?? null,
      invitedAt: m.invitedAt,
      acceptedAt: m.acceptedAt,
      revokedAt: m.revokedAt,
      createdAt: (m as unknown as { createdAt: Date }).createdAt,
      updatedAt: (m as unknown as { updatedAt: Date }).updatedAt,
    };
  }
}
