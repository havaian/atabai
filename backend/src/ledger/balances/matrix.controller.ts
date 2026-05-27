import {
  Controller,
  Get,
  Param,
  UseGuards,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Types } from 'mongoose';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { MEMBERSHIP_CAPABILITIES } from '../../organizations/constants/membership-capabilities';
import { RequireCapability } from '../../organizations/decorators/require-capability.decorator';
import { OrgMembershipGuard } from '../../organizations/guards/org-membership.guard';
import { ALL_BALANCE_LAYERS } from '../constants/balance-layers';
import {
  AccountBalance,
  type AccountBalanceModel,
} from '../schemas/account-balance.schema';

/**
 * Server-side transformation matrix — architecture doc §7.2.
 *
 * Pivots AccountBalance rows for one (org, period) into one row per
 * (accountCode, subconto1, subconto2, subconto3) with the four layers
 * (nsbu_base / reclassification / adjustment / ifrs) projected as columns.
 *
 * The frontend previously fired 4 separate fetches and pivoted client-side
 * — see [[project-architecture-shift]] frontend gaps. That worked for
 * small periods but didn't scale and added latency. This endpoint does
 * the join in a single aggregation against the `balance_matrix_scan`
 * index on AccountBalance.
 */
@Controller('organizations/:orgId/ledger/periods/:periodId')
@UseGuards(JwtAuthGuard, OrgMembershipGuard)
export class MatrixController {
  constructor(
    @InjectModel(AccountBalance.name)
    private readonly balanceModel: AccountBalanceModel,
  ) {}

  @Get('matrix')
  @RequireCapability(MEMBERSHIP_CAPABILITIES.NSBU_BASE_READ)
  async getMatrix(
    @Param('orgId') orgId: string,
    @Param('periodId') periodId: string,
  ) {
    type Aggregated = {
      _id: {
        accountCode: string;
        s1: string | null;
        s2: string | null;
        s3: string | null;
      };
      byLayer: Array<{
        layer: string;
        openingDebit: Types.Decimal128;
        openingCredit: Types.Decimal128;
        periodDebit: Types.Decimal128;
        periodCredit: Types.Decimal128;
        closingDebit: Types.Decimal128;
        closingCredit: Types.Decimal128;
      }>;
      counterpartyId: Types.ObjectId | null;
    };

    const rows = await this.balanceModel.aggregate<Aggregated>([
      {
        $match: {
          organizationId: new Types.ObjectId(orgId),
          periodId: new Types.ObjectId(periodId),
          layer: { $in: ALL_BALANCE_LAYERS as unknown as string[] },
        },
      },
      {
        // Group by the balance key WITHOUT layer — collapse the four layers
        // into one row per (account, subconto-combo).
        $group: {
          _id: {
            accountCode: '$accountCode',
            s1: '$subconto1Value',
            s2: '$subconto2Value',
            s3: '$subconto3Value',
          },
          byLayer: {
            $push: {
              layer: '$layer',
              openingDebit: '$openingDebit',
              openingCredit: '$openingCredit',
              periodDebit: '$periodDebit',
              periodCredit: '$periodCredit',
              closingDebit: '$closingDebit',
              closingCredit: '$closingCredit',
            },
          },
          // Surface the counterpartyId from any layer that carries it —
          // they should all agree since it's part of the balance key.
          counterpartyId: { $first: '$counterpartyId' },
        },
      },
      { $sort: { '_id.accountCode': 1, '_id.s1': 1, '_id.s2': 1, '_id.s3': 1 } },
      { $limit: 5000 },
    ]);

    const matrix = rows.map((row) => {
      const layers: Record<string, unknown> = {};
      for (const layerRow of row.byLayer) {
        layers[layerRow.layer] = {
          openingDebit: layerRow.openingDebit.toString(),
          openingCredit: layerRow.openingCredit.toString(),
          periodDebit: layerRow.periodDebit.toString(),
          periodCredit: layerRow.periodCredit.toString(),
          closingDebit: layerRow.closingDebit.toString(),
          closingCredit: layerRow.closingCredit.toString(),
        };
      }
      return {
        accountCode: row._id.accountCode,
        subconto1Value: row._id.s1,
        subconto2Value: row._id.s2,
        subconto3Value: row._id.s3,
        counterpartyId: row.counterpartyId?.toString() ?? null,
        layers,
      };
    });

    return { success: true, matrix };
  }
}
