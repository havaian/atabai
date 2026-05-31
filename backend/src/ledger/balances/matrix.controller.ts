import { Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Types } from 'mongoose';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { MEMBERSHIP_CAPABILITIES } from '../../organizations/constants/membership-capabilities';
import { RequireCapability } from '../../organizations/decorators/require-capability.decorator';
import { OrgMembershipGuard } from '../../organizations/guards/org-membership.guard';
import { ALL_BALANCE_LAYERS } from '../constants/balance-layers';
import { AccountBalance, type AccountBalanceModel } from '../schemas/account-balance.schema';
import { IfrsDerivationService } from '../services/ifrs-derivation.service';
import { PeriodsService } from '../services/periods.service';

/** One pivoted matrix row, shared by the JSON and XLSX export paths. */
interface MatrixRow {
  accountCode: string;
  subconto1Value: string | null;
  subconto2Value: string | null;
  subconto3Value: string | null;
  counterpartyId: string | null;
  layers: Record<
    string,
    {
      openingDebit: string;
      openingCredit: string;
      periodDebit: string;
      periodCredit: string;
      closingDebit: string;
      closingCredit: string;
    }
  >;
}

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
    private readonly ifrsDerivation: IfrsDerivationService,
    private readonly periods: PeriodsService,
  ) {}

  @Get('matrix')
  @RequireCapability(MEMBERSHIP_CAPABILITIES.NSBU_BASE_READ)
  async getMatrix(@Param('orgId') orgId: string, @Param('periodId') periodId: string) {
    const matrix = await this.buildMatrix(orgId, periodId);
    return { success: true, matrix };
  }

  /**
   * Re-derive the IFRS layer for the whole period and return the refreshed
   * matrix. The commit paths (adjustment / reclassification) already derive
   * IFRS incrementally for the keys they touch, so this is the safety-net:
   *   - backfill periods whose committed data predates IfrsDerivationService;
   *   - refresh after a derivation-logic change.
   *
   * Gated on IFRS_OVERLAY_WRITE — it materializes the IFRS result, which is
   * the overlay specialist's domain (org admin implies the capability). It
   * does NOT require the period to be writable: the IFRS layer is derived
   * output, so recomputing it is non-destructive even on a locked period.
   * `getPeriod` still validates the period exists in this org (404 otherwise).
   */
  @Post('ifrs/rederive')
  @HttpCode(200)
  @RequireCapability(MEMBERSHIP_CAPABILITIES.IFRS_OVERLAY_WRITE)
  async rederiveIfrs(@Param('orgId') orgId: string, @Param('periodId') periodId: string) {
    await this.periods.getPeriod(orgId, periodId);
    const result = await this.ifrsDerivation.deriveForPeriod(
      new Types.ObjectId(orgId),
      new Types.ObjectId(periodId),
    );
    const matrix = await this.buildMatrix(orgId, periodId);
    return {
      success: true,
      derived: {
        recomputed: result.recomputed,
        created: result.created,
        keys: result.derivedKeys.length,
      },
      matrix,
    };
  }

  /**
   * Shared aggregation — collapses the four balance layers into one row per
   * (account, subconto-combo) for the JSON matrix endpoint.
   */
  private async buildMatrix(orgId: string, periodId: string): Promise<MatrixRow[]> {
    type Aggregated = {
      _id: {
        accountCode: string;
        s1: string | null;
        s2: string | null;
        s3: string | null;
      };
      byLayer: Array<{
        layer: string;
        level: number;
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
              level: '$level',
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

    return rows.map((row) => {
      // nsbu_base may appear at multiple ОСВ levels for one code (a rollup line
      // plus a deeper detail line under the same code). The transformation
      // matrix shows the account-grain value — the shallowest (min-level) row;
      // deeper detail rows live in the balances endpoint, not here. Every other
      // layer sits at level 0, one entry each.
      const nsbuLevels = row.byLayer
        .filter((l) => l.layer === 'nsbu_base')
        .map((l) => l.level ?? 0);
      const minNsbuLevel = nsbuLevels.length ? Math.min(...nsbuLevels) : null;
      const layers: MatrixRow['layers'] = {};
      for (const layerRow of row.byLayer) {
        if (layerRow.layer === 'nsbu_base' && (layerRow.level ?? 0) !== minNsbuLevel) {
          continue;
        }
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
  }
}
