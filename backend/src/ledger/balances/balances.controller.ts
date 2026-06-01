import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Types } from 'mongoose';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { MEMBERSHIP_CAPABILITIES } from '../../organizations/constants/membership-capabilities';
import { RequireCapability } from '../../organizations/decorators/require-capability.decorator';
import { OrgMembershipGuard } from '../../organizations/guards/org-membership.guard';
import {
  AccountBalance,
  type AccountBalanceDocument,
  type AccountBalanceModel,
} from '../schemas/account-balance.schema';

/**
 * Read-only AccountBalance surface. Per period (required path param) +
 * optional accountCode / counterparty filters.
 *
 * Single-layer (architecture doc §3.2): balances carry one posted figure
 * per key; the old four-layer matrix view and its per-layer filter were
 * removed with the transformation pipeline.
 */
@Controller('organizations/:orgId/ledger/periods/:periodId')
@UseGuards(JwtAuthGuard, OrgMembershipGuard)
export class BalancesController {
  constructor(
    @InjectModel(AccountBalance.name)
    private readonly balanceModel: AccountBalanceModel,
  ) {}

  @Get('balances')
  @RequireCapability(MEMBERSHIP_CAPABILITIES.NSBU_BASE_READ)
  async list(
    @Param('orgId') orgId: string,
    @Param('periodId') periodId: string,
    @Query('accountCode') accountCode?: string,
    @Query('counterpartyId') counterpartyId?: string,
  ) {
    const query: Record<string, unknown> = {
      organizationId: new Types.ObjectId(orgId),
      periodId: new Types.ObjectId(periodId),
    };
    if (accountCode) {
      query.accountCode = accountCode;
    }
    if (counterpartyId) {
      query.counterpartyId = new Types.ObjectId(counterpartyId);
    }

    const docs = await this.balanceModel
      .find(query)
      .sort({ accountCode: 1, subconto1Value: 1 })
      .limit(5000);

    return {
      success: true,
      balances: docs.map((b) => this.serialize(b)),
    };
  }

  private serialize(b: AccountBalanceDocument) {
    return {
      id: b._id.toString(),
      accountCode: b.accountCode,
      level: b.level,
      subconto1Value: b.subconto1Value,
      subconto2Value: b.subconto2Value,
      subconto3Value: b.subconto3Value,
      counterpartyId: b.counterpartyId?.toString() ?? null,
      openingDebit: b.openingDebit.toString(),
      openingCredit: b.openingCredit.toString(),
      periodDebit: b.periodDebit.toString(),
      periodCredit: b.periodCredit.toString(),
      closingDebit: b.closingDebit.toString(),
      closingCredit: b.closingCredit.toString(),
      currency: b.currency,
      quantity: b.quantity ? b.quantity.toString() : null,
      source: b.source,
      recomputedAt: b.recomputedAt,
    };
  }
}
