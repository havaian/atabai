import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { MEMBERSHIP_CAPABILITIES } from '../../organizations/constants/membership-capabilities';
import { RequireCapability } from '../../organizations/decorators/require-capability.decorator';
import { OrgMembershipGuard } from '../../organizations/guards/org-membership.guard';
import type { UserDocument } from '../../users/schemas/user.schema';
import type { JournalEntryDocument, JournalEntryStatus } from '../schemas/journal-entry.schema';
import { CreateReclassificationDto } from './dto/create-reclassification.dto';
import { ReverseReclassificationDto } from './dto/reverse-reclassification.dto';
import { ReclassificationService } from './reclassifications.service';

/**
 * Reclassification HTTP surface — methodology step 3 (second half) /
 * architecture doc §7.2.
 *
 * Gated on `ifrs.overlay.read` / `ifrs.overlay.write`. Reclassification is
 * IFRS-presentation work performed by the IFRS specialist (the methodology
 * steps the specialist owns), distinct from in-house NSBU bookkeeping — so it
 * shares the overlay capability axis with adjustments rather than the
 * nsbu.base axis. Org admin role implies all capabilities.
 *
 * Two scopes, mirroring AdjustmentsController:
 *   /organizations/:orgId/ledger/reclassifications
 *     Org-wide list (filter by period / status via query).
 *
 *   /organizations/:orgId/ledger/periods/:periodId/reclassifications
 *     Create lives here because every reclassification is period-keyed and
 *     PeriodsService asserts the period is writable.
 */
@Controller('organizations/:orgId/ledger')
@UseGuards(JwtAuthGuard, OrgMembershipGuard)
export class ReclassificationsController {
  constructor(private readonly reclassifications: ReclassificationService) {}

  @Post('periods/:periodId/reclassifications')
  @RequireCapability(MEMBERSHIP_CAPABILITIES.IFRS_OVERLAY_WRITE)
  async createDraft(
    @CurrentUser() user: UserDocument,
    @Param('orgId') orgId: string,
    @Param('periodId') periodId: string,
    @Body() body: CreateReclassificationDto,
  ) {
    const entry = await this.reclassifications.createDraft({
      organizationId: orgId,
      periodId,
      date: body.date,
      reason: body.reason,
      lines: body.lines,
      sourceRef: body.sourceRef,
      actor: user,
    });
    return { success: true, reclassification: this.serialize(entry) };
  }

  @Get('reclassifications')
  @RequireCapability(MEMBERSHIP_CAPABILITIES.IFRS_OVERLAY_READ)
  async list(
    @Param('orgId') orgId: string,
    @Query('periodId') periodId?: string,
    @Query('status') status?: JournalEntryStatus,
  ) {
    const entries = await this.reclassifications.listReclassifications({
      organizationId: orgId,
      periodId,
      status,
    });
    return {
      success: true,
      reclassifications: entries.map((e) => this.serialize(e)),
    };
  }

  @Get('reclassifications/:entryId')
  @RequireCapability(MEMBERSHIP_CAPABILITIES.IFRS_OVERLAY_READ)
  async getOne(@Param('orgId') orgId: string, @Param('entryId') entryId: string) {
    const { entry, lines } = await this.reclassifications.getReclassification(orgId, entryId);
    return {
      success: true,
      reclassification: this.serialize(entry),
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

  @Post('reclassifications/:entryId/commit')
  @HttpCode(200)
  @RequireCapability(MEMBERSHIP_CAPABILITIES.IFRS_OVERLAY_WRITE)
  async commit(
    @CurrentUser() user: UserDocument,
    @Param('orgId') orgId: string,
    @Param('entryId') entryId: string,
  ) {
    const entry = await this.reclassifications.commitDraft({
      organizationId: orgId,
      entryId,
      actor: user,
    });
    return { success: true, reclassification: this.serialize(entry) };
  }

  @Post('reclassifications/:entryId/reverse')
  @HttpCode(200)
  @RequireCapability(MEMBERSHIP_CAPABILITIES.IFRS_OVERLAY_WRITE)
  async reverse(
    @CurrentUser() user: UserDocument,
    @Param('orgId') orgId: string,
    @Param('entryId') entryId: string,
    @Body() body: ReverseReclassificationDto,
  ) {
    const reversal = await this.reclassifications.reverseEntry({
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
