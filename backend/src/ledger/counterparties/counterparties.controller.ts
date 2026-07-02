import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Types } from 'mongoose';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { MEMBERSHIP_CAPABILITIES } from '../../organizations/constants/membership-capabilities';
import { RequireCapability } from '../../organizations/decorators/require-capability.decorator';
import { OrgMembershipGuard } from '../../organizations/guards/org-membership.guard';
import {
  Counterparty,
  type CounterpartyDocument,
  type CounterpartyModel,
} from '../schemas/counterparty.schema';

/**
 * Read-only counterparty list for pickers (opening-balance entry, and any
 * future screen that needs to choose a counterparty). Counterparties are
 * created by the bank/invoice ingestion paths; this surface only lists them.
 *
 *   GET .../counterparties            — active counterparties (name-sorted).
 *   GET .../counterparties?activeOnly=false — include archived ones too.
 *
 * `settlementDepth` is returned as a soft hint so a picker can default the
 * document-type toggle; posting logic still resolves the effective depth via
 * its own helper rather than trusting this field.
 */
@Controller('organizations/:orgId/ledger/counterparties')
@UseGuards(JwtAuthGuard, OrgMembershipGuard)
export class CounterpartiesController {
  constructor(
    @InjectModel(Counterparty.name)
    private readonly counterpartyModel: CounterpartyModel,
  ) {}

  @Get()
  @RequireCapability(MEMBERSHIP_CAPABILITIES.NSBU_BASE_READ)
  async list(@Param('orgId') orgId: string, @Query('activeOnly') activeOnly?: string) {
    const query: Record<string, unknown> = {
      organizationId: new Types.ObjectId(orgId),
    };
    // Default to active-only; opt into archived with ?activeOnly=false.
    if (activeOnly !== 'false') {
      query.isActive = true;
    }

    const docs = await this.counterpartyModel
      .find(query)
      .sort({ name: 1 })
      .limit(5000);

    return {
      success: true,
      counterparties: docs.map((c) => this.serialize(c)),
    };
  }

  private serialize(c: CounterpartyDocument) {
    return {
      id: c._id.toString(),
      name: c.name,
      inn: c.inn ?? null,
      settlementDepth: c.settlementDepth ?? null,
      isActive: c.isActive,
    };
  }
}
