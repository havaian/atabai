import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { MEMBERSHIP_CAPABILITIES } from '../../organizations/constants/membership-capabilities';
import { RequireCapability } from '../../organizations/decorators/require-capability.decorator';
import { OrgMembershipGuard } from '../../organizations/guards/org-membership.guard';
import type { UserDocument } from '../../users/schemas/user.schema';
import {
  ALL_INVOICE_DIRECTIONS,
  isInvoiceDirection,
} from '../constants/invoice';
import {
  InvoiceIngestionService,
  type InvoicePreviewColor,
} from './invoice-ingestion.service';
import { UpdateInvoiceDraftDto } from './dto/invoice-registry.dto';

/**
 * Invoice-registry HTTP surface — methodology §7, build phases 1–3.
 *
 * The upload→preview→fix→commit cycle, mirroring the bank engine's shape so the
 * frontend and the mental model carry straight over:
 *
 *   POST  .../invoice-registry                      — upload a Didox registry
 *                                                      export, parse it, create
 *                                                      drafts. `direction` says
 *                                                      which file (incoming /
 *                                                      outgoing). Returns the
 *                                                      uploadId + the summary.
 *   GET   .../invoice-registry                      — list the period's upload
 *                                                      batches (history).
 *   GET   .../invoice-registry/:uploadId/drafts     — the preview feed: per
 *                                                      invoice, color + the
 *                                                      operator lines to assign.
 *   PATCH .../invoice-registry/:uploadId/drafts/:id — set the per-line accounts.
 *   POST  .../invoice-registry/:uploadId/commit     — post all non-RED drafts.
 *
 * Capability gate: `nsbu.base.write` for the mutating routes, `nsbu.base.read`
 * for the reads — identical to the bank engine. Admin role implies all.
 */
@Controller('organizations/:orgId/ledger/periods/:periodId')
@UseGuards(JwtAuthGuard, OrgMembershipGuard)
export class InvoiceRegistryController {
  constructor(private readonly invoices: InvoiceIngestionService) {}

  @Post('invoice-registry')
  @RequireCapability(MEMBERSHIP_CAPABILITIES.NSBU_BASE_WRITE)
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @CurrentUser() user: UserDocument,
    @Param('orgId') orgId: string,
    @Param('periodId') periodId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('direction') direction?: string,
  ) {
    if (!file) {
      throw new BadRequestException({ error: 'NO_FILE', message: 'No file uploaded' });
    }

    // Which registry this is (Входящие = incoming, Исходящие = outgoing). It is
    // not in the file, so the operator picks it at upload — same shape as the
    // bank module picking the statement account.
    const dir = (direction ?? '').trim();
    if (!isInvoiceDirection(dir)) {
      throw new BadRequestException({
        error: 'INVALID_DIRECTION',
        message: `direction is required and must be one of: ${ALL_INVOICE_DIRECTIONS.join(', ')}`,
      });
    }

    const summary = await this.invoices.ingestFromFile({
      organizationId: orgId,
      periodId,
      filePath: file.path,
      direction: dir,
      actor: user,
    });

    return {
      success: true,
      file: {
        originalName: Buffer.from(file.originalname, 'latin1').toString('utf8'),
        storedName: file.filename,
        size: file.size,
      },
      summary,
    };
  }

  @Get('invoice-registry')
  @RequireCapability(MEMBERSHIP_CAPABILITIES.NSBU_BASE_READ)
  async listBatches(
    @Param('orgId') orgId: string,
    @Param('periodId') periodId: string,
  ) {
    const batches = await this.invoices.listBatchesForPeriod({
      organizationId: orgId,
      periodId,
    });
    const items = batches.map((b) => ({
      ...b,
      status: b.statusCounts.draft > 0 ? 'draft' : 'committed',
      pendingRed: b.draftColorCounts.red,
    }));
    return { success: true, batches: items };
  }

  @Get('invoice-registry/:uploadId/drafts')
  @RequireCapability(MEMBERSHIP_CAPABILITIES.NSBU_BASE_READ)
  async listDrafts(
    @Param('orgId') orgId: string,
    @Param('uploadId') uploadId: string,
    @Query('color') color?: InvoicePreviewColor,
    @Query('status') status?: 'draft' | 'committed',
  ) {
    const enriched = await this.invoices.listDraftsForUpload({
      organizationId: orgId,
      uploadId,
      statuses: status ? [status] : undefined,
    });

    const items = enriched
      .filter((d) => !color || d.color === color)
      .map(
        ({
          entry,
          color: c,
          reason,
          direction,
          counterpartyName,
          subtype,
          periodId,
          periodLabel,
          periodLocked,
          operatorLines,
        }) => ({
          id: entry._id.toString(),
          sourceRef: entry.sourceRef,
          date: entry.date,
          description: entry.description,
          totalAmount: entry.totalAmount.toString(),
          status: entry.status,
          color: c,
          previewReason: reason,
          direction,
          counterpartyName,
          subtype,
          periodId,
          periodLabel,
          periodLocked,
          operatorLines,
          createdAt: (entry as unknown as { createdAt: Date }).createdAt,
        }),
      );

    return { success: true, uploadId, drafts: items };
  }

  @Patch('invoice-registry/:uploadId/drafts/:entryId')
  @RequireCapability(MEMBERSHIP_CAPABILITIES.NSBU_BASE_WRITE)
  async updateDraft(
    @CurrentUser() user: UserDocument,
    @Param('orgId') orgId: string,
    @Param('periodId') periodId: string,
    @Param('uploadId') uploadId: string,
    @Param('entryId') entryId: string,
    @Body() body: UpdateInvoiceDraftDto,
  ) {
    const entry = await this.invoices.updateDraft({
      organizationId: orgId,
      periodId,
      uploadId,
      entryId,
      lineAccounts: body.lineAccounts,
      actor: user,
    });

    return {
      success: true,
      draft: {
        id: entry._id.toString(),
        sourceRef: entry.sourceRef,
        date: entry.date,
        description: entry.description,
        totalAmount: entry.totalAmount.toString(),
        status: entry.status,
      },
    };
  }

  @Post('invoice-registry/:uploadId/commit')
  @HttpCode(200)
  @RequireCapability(MEMBERSHIP_CAPABILITIES.NSBU_BASE_WRITE)
  async commit(
    @CurrentUser() user: UserDocument,
    @Param('orgId') orgId: string,
    @Param('periodId') periodId: string,
    @Param('uploadId') uploadId: string,
  ) {
    const result = await this.invoices.commitDrafts({
      organizationId: orgId,
      periodId,
      uploadId,
      actor: user,
    });
    return { success: true, uploadId, ...result };
  }
}
