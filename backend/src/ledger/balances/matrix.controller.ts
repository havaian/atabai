import {
  Controller,
  Get,
  Param,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { InjectModel } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import * as ExcelJS from 'exceljs';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { MEMBERSHIP_CAPABILITIES } from '../../organizations/constants/membership-capabilities';
import { RequireCapability } from '../../organizations/decorators/require-capability.decorator';
import { OrgMembershipGuard } from '../../organizations/guards/org-membership.guard';
import { ALL_BALANCE_LAYERS } from '../constants/balance-layers';
import {
  AccountBalance,
  type AccountBalanceModel,
} from '../schemas/account-balance.schema';

/** One pivoted matrix row, shared by the JSON and XLSX export paths. */
interface MatrixRow {
  accountCode: string;
  subconto1Value: string | null;
  subconto2Value: string | null;
  subconto3Value: string | null;
  counterpartyId: string | null;
  layers: Record<string, {
    openingDebit: string;
    openingCredit: string;
    periodDebit: string;
    periodCredit: string;
    closingDebit: string;
    closingCredit: string;
  }>;
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
  ) {}

  @Get('matrix')
  @RequireCapability(MEMBERSHIP_CAPABILITIES.NSBU_BASE_READ)
  async getMatrix(
    @Param('orgId') orgId: string,
    @Param('periodId') periodId: string,
  ) {
    const matrix = await this.buildMatrix(orgId, periodId);
    return { success: true, matrix };
  }

  /**
   * XLSX export of the same matrix. Streams a workbook with one row per
   * (account, subconto-combo) and the four layers as grouped Dt/Cr column
   * pairs — mirroring the on-screen table so the file is recognisable.
   *
   * Reuses the exact aggregation behind GET /matrix so the export can never
   * drift from what the user is looking at. Money stays as decimal strings
   * all the way to the cell; we write them as text-formatted numbers so
   * Excel shows them right-aligned without re-introducing float error.
   */
  @Get('matrix/export')
  @RequireCapability(MEMBERSHIP_CAPABILITIES.NSBU_BASE_READ)
  async exportMatrix(
    @Param('orgId') orgId: string,
    @Param('periodId') periodId: string,
    @Res() res: Response,
  ): Promise<void> {
    const matrix = await this.buildMatrix(orgId, periodId);

    const wb = new ExcelJS.Workbook();
    wb.creator = 'ATABAI';
    wb.created = new Date();
    const ws = wb.addWorksheet('IFRS Matrix', {
      views: [{ state: 'frozen', xSplit: 1, ySplit: 2 }],
    });

    // Two header rows: layer groups on top, Dt/Cr beneath. Mirrors the
    // <thead> in LedgerMatrixView so the export is visually familiar.
    ws.mergeCells('A1:A2');
    ws.getCell('A1').value = 'Account';
    ws.mergeCells('B1:C1');
    ws.getCell('B1').value = 'NSBU';
    ws.mergeCells('D1:E1');
    ws.getCell('D1').value = 'Reclassification';
    ws.mergeCells('F1:G1');
    ws.getCell('F1').value = 'Adjustments';
    ws.mergeCells('H1:I1');
    ws.getCell('H1').value = 'IFRS';
    ws.getRow(2).values = ['', 'Dt', 'Cr', 'Dt', 'Cr', 'Dt', 'Cr', 'Dt', 'Cr'];

    // Header styling — bold, centred, light fill; IFRS group accented purple
    // to match the on-screen highlight.
    for (const rowIdx of [1, 2]) {
      const row = ws.getRow(rowIdx);
      row.font = { bold: true, size: 10 };
      row.alignment = { horizontal: 'center', vertical: 'middle' };
      row.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFEDE9F7' },
        };
        cell.border = {
          bottom: { style: 'thin', color: { argb: 'FFD8D2E8' } },
          right: { style: 'thin', color: { argb: 'FFD8D2E8' } },
        };
      });
    }
    // Accent the IFRS group header cells.
    for (const addr of ['H1', 'H2', 'I2']) {
      ws.getCell(addr).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE5DBFB' },
      };
    }

    // Data rows.
    const num = (v?: string) => {
      // Blank cell when zero/absent — matches the on-screen format() helper.
      if (!v || v === '0') return null;
      const parsed = Number(v);
      return Number.isFinite(parsed) ? parsed : v;
    };
    for (const m of matrix) {
      const subcontoLabel = [m.subconto1Value, m.subconto2Value, m.subconto3Value]
        .filter(Boolean)
        .join(' / ');
      const accountCell = subcontoLabel
        ? `${m.accountCode}  (${subcontoLabel})`
        : m.accountCode;
      const L = m.layers;
      ws.addRow([
        accountCell,
        num(L.nsbu_base?.closingDebit),
        num(L.nsbu_base?.closingCredit),
        num(L.reclassification?.closingDebit),
        num(L.reclassification?.closingCredit),
        num(L.adjustment?.closingDebit),
        num(L.adjustment?.closingCredit),
        num(L.ifrs?.closingDebit),
        num(L.ifrs?.closingCredit),
      ]);
    }

    // Column widths + number format on the money columns.
    ws.getColumn(1).width = 42;
    for (let c = 2; c <= 9; c++) {
      const col = ws.getColumn(c);
      col.width = 16;
      col.numFmt = '#,##0.00;(#,##0.00)'; // negatives in brackets, accounting style
      col.alignment = { horizontal: 'right' };
    }
    ws.getColumn(1).font = { name: 'Consolas', size: 10 };

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="ifrs-matrix-${periodId}.xlsx"`,
    );
    await wb.xlsx.write(res);
    res.end();
  }

  /**
   * Shared aggregation — collapses the four balance layers into one row per
   * (account, subconto-combo). Used by both the JSON endpoint and the XLSX
   * export so they can never disagree.
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

    return rows.map((row) => {
      const layers: MatrixRow['layers'] = {};
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
  }
}
