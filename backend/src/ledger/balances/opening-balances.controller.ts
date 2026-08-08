import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { Types } from 'mongoose';

import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { MEMBERSHIP_CAPABILITIES } from '../../organizations/constants/membership-capabilities';
import { RequireCapability } from '../../organizations/decorators/require-capability.decorator';
import { OrgMembershipGuard } from '../../organizations/guards/org-membership.guard';
import type { UserDocument } from '../../users/schemas/user.schema';
import { CreateOpeningBalancesDto } from './dto/create-opening-balances.dto';
import { OpeningBalancesService } from './opening-balances.service';

/**
 * Opening-balance entry surface (methodology §6.2 - «ввод начальных остатков»).
 *
 *   POST .../opening-balances - post a batch of per-document opening balances
 *                               against the period in the path (one balanced
 *                               `opening_balance` entry, rolled up immediately).
 *   GET  .../opening-balances - list the opening-balance entries already posted
 *                               in the period, with their counterparty legs.
 *
 * Capability gate: `nsbu.base.write` to post, `nsbu.base.read` to list -
 * identical to the bank and invoice engines. Admin implies all. Shares the
 * period-scoped prefix with the read-only balances surface; the sub-paths
 * ('balances' vs 'opening-balances') keep the two controllers distinct.
 */
@Controller('organizations/:orgId/ledger/periods/:periodId')
@UseGuards(JwtAuthGuard, OrgMembershipGuard)
export class OpeningBalancesController {
  constructor(private readonly openingBalances: OpeningBalancesService) {}

  @Post('opening-balances')
  @HttpCode(200)
  @RequireCapability(MEMBERSHIP_CAPABILITIES.NSBU_BASE_WRITE)
  async create(
    @Param('orgId') orgId: string,
    @Param('periodId') periodId: string,
    @CurrentUser() actor: UserDocument,
    @Body() dto: CreateOpeningBalancesDto,
  ) {
    const result = await this.openingBalances.createOpeningBalances({
      organizationId: new Types.ObjectId(orgId),
      periodId: new Types.ObjectId(periodId),
      dto,
      actor,
    });
    return { success: true, ...result };
  }

  @Get('opening-balances')
  @RequireCapability(MEMBERSHIP_CAPABILITIES.NSBU_BASE_READ)
  async list(@Param('orgId') orgId: string, @Param('periodId') periodId: string) {
    const result = await this.openingBalances.listOpeningBalances(
      new Types.ObjectId(orgId),
      new Types.ObjectId(periodId),
    );
    return { success: true, ...result };
  }
}
