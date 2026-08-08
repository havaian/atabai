import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MEMBERSHIP_CAPABILITIES } from '../organizations/constants/membership-capabilities';
import { CurrentMembership } from '../organizations/decorators/current-membership.decorator';
import { RequireCapability } from '../organizations/decorators/require-capability.decorator';
import { RequireOrgAdmin } from '../organizations/decorators/require-org-admin.decorator';
import { OrgMembershipGuard } from '../organizations/guards/org-membership.guard';
import type { MembershipDocument } from '../organizations/schemas/membership.schema';
import { OrginfoService } from '../integrations/orginfo/orginfo.service';
import { UpdateOrganizationProfileDto } from './dto/update-organization-profile.dto';
import type { OrganizationProfileDocument } from './schemas/organization-profile.schema';
import { OrganizationProfilesService } from './services/organization-profiles.service';

/**
 * Organization requisites (ledger-side profile) — view + admin edit.
 *
 * The requisites are created once during onboarding (bootstrap) and were
 * previously unreachable afterward: no read, no edit, and `bankAccounts` had
 * no writer at all. This controller closes both gaps.
 *
 *   GET   .../ledger/profile   — any active member with nsbu.base.read.
 *                                Returns the profile, lazily creating an
 *                                empty one if the org never had it touched.
 *   PATCH .../ledger/profile   — admins only (@RequireOrgAdmin). Updates the
 *                                editable requisites + bankAccounts.
 *
 * `transitionDate` is intentionally read-only here — it anchors every
 * downstream balance, so it is set during first-time-adoption setup only and
 * is surfaced for display, never accepted on the PATCH body.
 */
@Controller('organizations/:orgId/ledger/profile')
@UseGuards(JwtAuthGuard, OrgMembershipGuard)
export class OrganizationProfileController {
  constructor(
    private readonly profiles: OrganizationProfilesService,
    private readonly orginfo: OrginfoService,
  ) {}

  @Get()
  @RequireCapability(MEMBERSHIP_CAPABILITIES.NSBU_BASE_READ)
  async get(
    @Param('orgId') orgId: string,
    @CurrentMembership() membership: MembershipDocument,
  ) {
    const profile = await this.profiles.ensureForOrg(orgId);
    return {
      success: true,
      // The frontend hides/disables the edit form for non-admins; this is the
      // server's matching verdict so the two never disagree.
      canEdit: membership.role === 'admin',
      profile: this.serialize(profile),
    };
  }

  @Patch()
  @RequireOrgAdmin()
  async update(
    @Param('orgId') orgId: string,
    @Body() body: UpdateOrganizationProfileDto,
  ) {
    const profile = await this.profiles.upsert({
      organizationId: orgId,
      legalName: body.legalName,
      inn: body.inn,
      baseCurrency: body.baseCurrency,
      address: body.address,
      phone: body.phone,
      email: body.email,
      accountingPolicy: body.accountingPolicy,
      // Normalize optional sub-fields so the stored shape is consistent.
      bankAccounts: body.bankAccounts?.map((a) => ({
        accountNumber: a.accountNumber,
        bankCode: a.bankCode ?? null,
        label: a.label ?? null,
        currency: (a.currency ?? 'UZS').toUpperCase(),
        ledgerAccount: a.ledgerAccount ? a.ledgerAccount.trim() : null,
        subAccount: a.subAccount ? a.subAccount.trim() : null,
        // Absent → active (a fresh row from the form is active by default).
        isActive: a.isActive ?? true,
      })),
    });

    return {
      success: true,
      canEdit: true,
      profile: this.serialize(profile),
    };
  }

  /**
   * Look up org requisites by ИНН (methodology дополнение §2). Feeds the
   * "заполнить по ИНН" button on the profile edit screen: the admin enters an
   * ИНН, this returns the enrichable fields as `suggestion`, the form is
   * populated, and the admin saves via PATCH. The р/с is deliberately NOT
   * returned — it is sourced from the bank statement, not orginfo.
   *
   * Response shape matches the frontend: `{ configured, suggestion }`.
   * `configured` tells the UI whether the provider has credentials at all
   * (без ключей — не ходит в сеть), so it can show "lookup unavailable"
   * instead of "not found". `suggestion` is null on a miss so the UI falls
   * back to manual entry.
   */
  @Get('lookup/:inn')
  @RequireOrgAdmin()
  async lookup(@Param('inn') inn: string) {
    const info = await this.orginfo.getByInn(inn);
    if (!info) {
      return {
        success: true,
        configured: this.orginfo.isConfigured(),
        suggestion: null,
      };
    }
    return {
      success: true,
      configured: this.orginfo.isConfigured(),
      suggestion: {
        legalName: info.name,
        address: info.address,
        phone: info.phone,
        email: info.email,
      },
    };
  }

  private serialize(profile: OrganizationProfileDocument) {
    return {
      id: profile._id.toString(),
      legalName: profile.legalName,
      inn: profile.inn,
      transitionDate: profile.transitionDate,
      baseCurrency: profile.baseCurrency,
      address: profile.address ?? null,
      phone: profile.phone ?? null,
      email: profile.email ?? null,
      accountingPolicy: profile.accountingPolicy,
      bankAccounts: (profile.bankAccounts ?? []).map((a) => ({
        accountNumber: a.accountNumber,
        bankCode: a.bankCode ?? null,
        label: a.label ?? null,
        currency: a.currency,
        ledgerAccount: a.ledgerAccount ?? null,
        subAccount: a.subAccount ?? null,
        isActive: a.isActive ?? true,
      })),
    };
  }
}
