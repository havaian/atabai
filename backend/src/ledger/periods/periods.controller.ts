import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { MEMBERSHIP_CAPABILITIES } from '../../organizations/constants/membership-capabilities';
import { RequireCapability } from '../../organizations/decorators/require-capability.decorator';
import { RequireOrgAdmin } from '../../organizations/decorators/require-org-admin.decorator';
import { OrgMembershipGuard } from '../../organizations/guards/org-membership.guard';
import type { UserDocument } from '../../users/schemas/user.schema';
import type { ReportingPeriodDocument } from '../schemas/reporting-period.schema';
import { PeriodsService } from '../services/periods.service';
import { CreatePeriodDto } from './dto/create-period.dto';

/**
 * Full lifecycle surface for ReportingPeriod:
 *   GET  /periods                  - list (any active member)
 *   GET  /periods/:periodId        - one
 *   POST /periods                  - create regular period (admin only)
 *   POST /periods/:periodId/lock   - lock (admin only)
 *   POST /periods/:periodId/reopen - reopen (super_admin only - service-enforced)
 *
 * Reopen requires super_admin role at the SERVICE layer (defence-in-depth in
 * PeriodsService.reopenPeriod). The route is open to any active member here
 * so the service's own check is the single source of truth - a regular
 * admin who hits this endpoint gets 403 from the service, not from a
 * controller-side @RequireOrgAdmin that would mask the real requirement.
 */
@Controller('organizations/:orgId/ledger')
@UseGuards(JwtAuthGuard, OrgMembershipGuard)
export class PeriodsReadController {
  constructor(private readonly periods: PeriodsService) {}

  @Get('periods')
  @RequireCapability(MEMBERSHIP_CAPABILITIES.NSBU_BASE_READ)
  async list(@Param('orgId') orgId: string) {
    const docs = await this.periods.listPeriods(orgId);
    return { success: true, periods: docs.map((p) => this.serialize(p)) };
  }

  @Get('periods/:periodId')
  @RequireCapability(MEMBERSHIP_CAPABILITIES.NSBU_BASE_READ)
  async getOne(
    @Param('orgId') orgId: string,
    @Param('periodId') periodId: string,
  ) {
    const period = await this.periods.getPeriod(orgId, periodId);
    return { success: true, period: this.serialize(period) };
  }

  @Post('periods')
  @RequireOrgAdmin()
  async create(
    @CurrentUser() user: UserDocument,
    @Param('orgId') orgId: string,
    @Body() body: CreatePeriodDto,
  ) {
    const created = await this.periods.createRegularPeriod({
      organizationId: orgId,
      label: body.label,
      startDate: body.startDate,
      endDate: body.endDate,
      actor: user,
    });
    return { success: true, period: this.serialize(created) };
  }

  @Post('periods/:periodId/lock')
  @HttpCode(200)
  @RequireOrgAdmin()
  async lock(
    @CurrentUser() user: UserDocument,
    @Param('orgId') orgId: string,
    @Param('periodId') periodId: string,
  ) {
    const locked = await this.periods.lockPeriod(orgId, periodId, user);
    return { success: true, period: this.serialize(locked) };
  }

  @Post('periods/:periodId/reopen')
  @HttpCode(200)
  @RequireCapability(MEMBERSHIP_CAPABILITIES.NSBU_BASE_READ)
  async reopen(
    @CurrentUser() user: UserDocument,
    @Param('orgId') orgId: string,
    @Param('periodId') periodId: string,
  ) {
    const reopened = await this.periods.reopenPeriod(orgId, periodId, user);
    return { success: true, period: this.serialize(reopened) };
  }

  private serialize(p: ReportingPeriodDocument) {
    return {
      id: p._id.toString(),
      kind: p.kind,
      label: p.label,
      startDate: p.startDate,
      endDate: p.endDate,
      status: p.status,
      lockedAt: p.lockedAt,
      lockedBy: p.lockedBy?.toString() ?? null,
    };
  }
}
