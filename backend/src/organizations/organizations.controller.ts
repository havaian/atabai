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
  async get(
    @Param('orgId') orgId: string,
    @CurrentMembership() membership: MembershipDocument,
  ) {
    const organization = await this.orgs.getOrganization(orgId);
    return {
      success: true,
      organization: this.serializeOrganization(organization),
      membership: this.serializeMembership(membership),
    };
  }

  @Get(':orgId/members')
  @UseGuards(OrgMembershipGuard)
  async listMembers(@Param('orgId') orgId: string) {
    const members = await this.orgs.listMembers(orgId);
    return {
      success: true,
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
    return {
      id: m._id.toString(),
      organizationId: m.organizationId.toString(),
      userId: m.userId?.toString() ?? null,
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
