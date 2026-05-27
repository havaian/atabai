import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { MEMBERSHIP_CAPABILITIES } from '../../organizations/constants/membership-capabilities';
import { RequireCapability } from '../../organizations/decorators/require-capability.decorator';
import { OrgMembershipGuard } from '../../organizations/guards/org-membership.guard';
import type { UserDocument } from '../../users/schemas/user.schema';
import type {
  JournalEntryDocument,
  JournalEntryStatus,
} from '../schemas/journal-entry.schema';
import { AdjustmentsService } from './adjustments.service';
import { CreateAdjustmentDto } from './dto/create-adjustment.dto';
import { ReverseAdjustmentDto } from './dto/reverse-adjustment.dto';

/**
 * Adjustments HTTP surface — architecture doc §4.1 step 4 and §7.2.
 *
 * All routes are gated on `ifrs.overlay.read` / `ifrs.overlay.write` —
 * adjustments are IFRS specialist work, distinct from NSBU bookkeeping. Org
 * admin role implies all capabilities, so an org admin can still post
 * adjustments without the explicit grant.
 *
 * Two scopes:
 *   /organizations/:orgId/ledger/adjustments
 *     Org-wide list (filter by period / status / standard via query).
 *
 *   /organizations/:orgId/ledger/periods/:periodId/adjustments
 *     Create lives here because every adjustment is period-keyed and
 *     PeriodsService asserts the period is writable.
 */
@Controller('organizations/:orgId/ledger')
@UseGuards(JwtAuthGuard, OrgMembershipGuard)
export class AdjustmentsController {
  constructor(private readonly adjustments: AdjustmentsService) {}

  @Post('periods/:periodId/adjustments')
  @RequireCapability(MEMBERSHIP_CAPABILITIES.IFRS_OVERLAY_WRITE)
  async createDraft(
    @CurrentUser() user: UserDocument,
    @Param('orgId') orgId: string,
    @Param('periodId') periodId: string,
    @Body() body: CreateAdjustmentDto,
  ) {
    const entry = await this.adjustments.createDraft({
      organizationId: orgId,
      periodId,
      date: body.date,
      description: body.description,
      adjustmentMeta: body.adjustmentMeta,
      lines: body.lines,
      sourceRef: body.sourceRef,
      actor: user,
    });
    return { success: true, adjustment: this.serialize(entry) };
  }

  @Get('adjustments')
  @RequireCapability(MEMBERSHIP_CAPABILITIES.IFRS_OVERLAY_READ)
  async list(
    @Param('orgId') orgId: string,
    @Query('periodId') periodId?: string,
    @Query('status') status?: JournalEntryStatus,
    @Query('standard') standard?: string,
  ) {
    const entries = await this.adjustments.listAdjustments({
      organizationId: orgId,
      periodId,
      status,
      standard,
    });
    return {
      success: true,
      adjustments: entries.map((e) => this.serialize(e)),
    };
  }

  @Get('adjustments/:entryId')
  @RequireCapability(MEMBERSHIP_CAPABILITIES.IFRS_OVERLAY_READ)
  async getOne(
    @Param('orgId') orgId: string,
    @Param('entryId') entryId: string,
  ) {
    const { entry, lines } = await this.adjustments.getAdjustment(orgId, entryId);
    return {
      success: true,
      adjustment: this.serialize(entry),
      lines: lines.map((l) => ({
        accountCode: l.accountCode,
        direction: l.direction,
        amount: l.amount.toString(),
        counterpartyId: l.counterpartyId?.toString() ?? null,
        subconto1Value: l.subconto1Value,
        subconto2Value: l.subconto2Value,
        subconto3Value: l.subconto3Value,
        description: l.description,
      })),
    };
  }

  @Post('adjustments/:entryId/commit')
  @HttpCode(200)
  @RequireCapability(MEMBERSHIP_CAPABILITIES.IFRS_OVERLAY_WRITE)
  async commit(
    @CurrentUser() user: UserDocument,
    @Param('orgId') orgId: string,
    @Param('entryId') entryId: string,
  ) {
    const entry = await this.adjustments.commitDraft({
      organizationId: orgId,
      entryId,
      actor: user,
    });
    return { success: true, adjustment: this.serialize(entry) };
  }

  @Post('adjustments/:entryId/reverse')
  @HttpCode(200)
  @RequireCapability(MEMBERSHIP_CAPABILITIES.IFRS_OVERLAY_WRITE)
  async reverse(
    @CurrentUser() user: UserDocument,
    @Param('orgId') orgId: string,
    @Param('entryId') entryId: string,
    @Body() body: ReverseAdjustmentDto,
  ) {
    const reversal = await this.adjustments.reverseEntry({
      organizationId: orgId,
      entryId,
      reason: body.reason,
      actor: user,
    });
    return { success: true, reversal: this.serialize(reversal) };
  }

  private serialize(entry: JournalEntryDocument) {
    return {
      id: entry._id.toString(),
      periodId: entry.periodId.toString(),
      date: entry.date,
      description: entry.description,
      status: entry.status,
      layer: entry.layer,
      totalAmount: entry.totalAmount.toString(),
      adjustmentMeta: entry.adjustmentMeta
        ? {
            standard: entry.adjustmentMeta.standard,
            reason: entry.adjustmentMeta.reason,
            taxEffectAmount: entry.adjustmentMeta.taxEffectAmount.toString(),
            disclosureText: entry.adjustmentMeta.disclosureText,
          }
        : null,
      sourceRef: entry.sourceRef,
      reversesEntryId: entry.reversesEntryId?.toString() ?? null,
      committedAt: entry.committedAt,
      committedBy: entry.committedBy?.toString() ?? null,
      reversedAt: entry.reversedAt,
      reversedBy: entry.reversedBy?.toString() ?? null,
      createdAt: (entry as unknown as { createdAt: Date }).createdAt,
    };
  }
}
