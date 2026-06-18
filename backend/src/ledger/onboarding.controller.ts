import { Body, Controller, Post, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { UserDocument } from '../users/schemas/user.schema';
import { BootstrapOrganizationDto } from './dto/bootstrap-organization.dto';
import { LedgerBootstrapService } from './services/ledger-bootstrap.service';

/**
 * Mounted at /api/onboarding.
 *
 * Lives in LedgerModule rather than OrganizationsModule because the
 * bootstrap orchestrates a ledger-heavy sequence (chart seed + period
 * creation + profile). Putting the route under OrganizationsModule would
 * have required OrganizationsModule to import LedgerModule, which already
 * imports OrganizationsModule — a circular dep.
 *
 * The path keeps `/organizations` for symmetry with the access-spine API,
 * but lives under `/onboarding` so the consumer reads it as "kick off the
 * full first-time-adoption flow" rather than "create just an Organization".
 */
@Controller('onboarding')
@UseGuards(JwtAuthGuard)
export class OnboardingController {
  constructor(private readonly bootstrap: LedgerBootstrapService) {}

  @Post('organizations')
  async bootstrapOrganization(
    @CurrentUser() user: UserDocument,
    @Body() body: BootstrapOrganizationDto,
  ) {
    const result = await this.bootstrap.bootstrapNewOrganization({
      actor: user,
      name: body.name,
      legalName: body.legalName,
      inn: body.inn,
      baseCurrency: body.baseCurrency,
      transitionDate: body.transitionDate,
      firstReportingYear: body.firstReportingYear,
      accountingPolicy: body.accountingPolicy,
    });

    return {
      success: true,
      organization: {
        id: result.organization._id.toString(),
        name: result.organization.name,
        createdBy: result.organization.createdBy.toString(),
        isActive: result.organization.isActive,
      },
      membership: {
        id: result.membership._id.toString(),
        role: result.membership.role,
        status: result.membership.status,
      },
      profile: {
        id: result.profile._id.toString(),
        legalName: result.profile.legalName,
        inn: result.profile.inn,
        transitionDate: result.profile.transitionDate,
        baseCurrency: result.profile.baseCurrency,
        accountingPolicy: result.profile.accountingPolicy,
      },
      periods: result.periods.map((p) => ({
        id: p._id.toString(),
        kind: p.kind,
        label: p.label,
        startDate: p.startDate,
        endDate: p.endDate,
        status: p.status,
      })),
      chartSeed: result.chartSeed,
    };
  }
}
