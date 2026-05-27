import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Types } from 'mongoose';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { MEMBERSHIP_CAPABILITIES } from '../../organizations/constants/membership-capabilities';
import { RequireCapability } from '../../organizations/decorators/require-capability.decorator';
import { OrgMembershipGuard } from '../../organizations/guards/org-membership.guard';
import {
  ALL_ACCOUNT_VIDS,
  type AccountVid,
} from '../constants/account-vid';
import {
  ChartOfAccount,
  type ChartOfAccountDocument,
  type ChartOfAccountModel,
} from '../schemas/chart-of-account.schema';

/**
 * Read-only chart-of-accounts surface. 507 NSBU rows is small enough that
 * the whole filtered set returns in one response — no pagination here.
 *
 * Query params:
 *   ?vid=А|П|КА|КП|Т (optional, exact)
 *   ?search=...      (optional, case-insensitive substring on code / name / quickPick)
 *   ?includeInactive=true|false (defaults to false — only active rows)
 */
@Controller('organizations/:orgId/ledger')
@UseGuards(JwtAuthGuard, OrgMembershipGuard)
export class ChartController {
  constructor(
    @InjectModel(ChartOfAccount.name)
    private readonly chartModel: ChartOfAccountModel,
  ) {}

  @Get('chart-of-accounts')
  @RequireCapability(MEMBERSHIP_CAPABILITIES.NSBU_BASE_READ)
  async list(
    @Param('orgId') orgId: string,
    @Query('vid') vid?: string,
    @Query('search') search?: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    const query: Record<string, unknown> = {
      organizationId: new Types.ObjectId(orgId),
    };
    if (vid && (ALL_ACCOUNT_VIDS as readonly string[]).includes(vid)) {
      query.vid = vid as AccountVid;
    }
    if (includeInactive !== 'true') {
      query.isActive = true;
    }

    // Case-insensitive substring match across code / name / quickPick. The
    // chart is small (507 rows) so a regex scan is fine; an index on
    // (org, code) + (org, quickPick) already covers the prefix cases.
    if (search && search.trim().length > 0) {
      const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(escaped, 'i');
      query.$or = [{ code: re }, { name: re }, { quickPick: re }];
    }

    const docs = await this.chartModel
      .find(query)
      .sort({ code: 1 })
      .limit(1000);

    return {
      success: true,
      accounts: docs.map((a) => this.serialize(a)),
    };
  }

  private serialize(a: ChartOfAccountDocument) {
    return {
      id: a._id.toString(),
      code: a.code,
      name: a.name,
      subconto1Name: a.subconto1Name,
      subconto2Name: a.subconto2Name,
      subconto3Name: a.subconto3Name,
      vid: a.vid,
      isCurrencyTracked: a.isCurrencyTracked,
      isQuantityTracked: a.isQuantityTracked,
      isDepartmentTracked: a.isDepartmentTracked,
      isTaxAccount: a.isTaxAccount,
      isOffBalance: a.isOffBalance,
      quickPick: a.quickPick,
      isActive: a.isActive,
    };
  }
}
