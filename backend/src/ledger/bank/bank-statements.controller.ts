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
import { BankIngestionService } from './bank-ingestion.service';
import { LearnTreasuryRuleDto } from './dto/learn-treasury-rule.dto';
import { CommitBankDraftsDto, UpdateBankDraftDto } from './dto/update-draft.dto';
import { TreasuryResolverService } from './treasury-resolver.service';

/**
 * Bank engine HTTP surface - bank ТЗ §3–§7.
 *
 * Three routes for the upload→preview→commit cycle:
 *
 *   POST .../bank-statements                - upload a statement file,
 *                                              parse it, create drafts.
 *                                              Returns the uploadId + preview
 *                                              color counts.
 *
 *   GET  .../bank-statements/:uploadId/drafts - list the draft entries from
 *                                                one upload batch (the
 *                                                preview-screen feed).
 *
 *   POST .../bank-statements/:uploadId/commit - flip all non-RED drafts in
 *                                                the batch to 'committed'.
 *                                                RED drafts (account = '000')
 *                                                are skipped and reported back.
 *
 * Per-row edit (operator manually fixes a RED row) and "add to rules"
 * (learning-loop button) are deliberate follow-ups - out of scope for the
 * first usable slice.
 *
 * Capability gate: `nsbu.base.write`. Admin role implies all.
 */
@Controller('organizations/:orgId/ledger/periods/:periodId')
@UseGuards(JwtAuthGuard, OrgMembershipGuard)
export class BankStatementsController {
  constructor(
    private readonly bank: BankIngestionService,
    private readonly treasury: TreasuryResolverService,
  ) {}

  @Post('bank-statements')
  @RequireCapability(MEMBERSHIP_CAPABILITIES.NSBU_BASE_WRITE)
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @CurrentUser() user: UserDocument,
    @Param('orgId') orgId: string,
    @Param('periodId') periodId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('statementAccountNumber') statementAccountNumber?: string,
  ) {
    if (!file) {
      throw new BadRequestException({
        error: 'NO_FILE',
        message: 'No file uploaded',
      });
    }

    // Which of the org's own accounts this statement belongs to. Required so
    // the engine knows the org-side leg of every posting (bank ТЗ §1/§2). The
    // service validates it against the org's registered accounts.
    const accountNumber = (statementAccountNumber ?? '').trim();
    if (!accountNumber) {
      throw new BadRequestException({
        error: 'NO_STATEMENT_ACCOUNT',
        message:
          'statementAccountNumber is required - pick which of the organization’s accounts this statement belongs to',
      });
    }

    const result = await this.bank.startIngestion({
      organizationId: orgId,
      periodId,
      filePath: file.path,
      fileName: Buffer.from(file.originalname, 'latin1').toString('utf8'),
      statementAccountNumber: accountNumber,
      actor: user,
    });

    return {
      success: true,
      file: {
        originalName: Buffer.from(file.originalname, 'latin1').toString('utf8'),
        storedName: file.filename,
        size: file.size,
      },
      // Processing runs in the background; poll the job endpoint for the
      // outcome (the green/yellow/red summary) once status leaves 'processing'.
      job: result,
    };
  }

  @Get('bank-statements/jobs/:jobId')
  @RequireCapability(MEMBERSHIP_CAPABILITIES.NSBU_BASE_READ)
  async jobStatus(
    @Param('orgId') orgId: string,
    @Param('jobId') jobId: string,
  ) {
    const job = await this.bank.getJob(orgId, jobId);
    return {
      success: true,
      job: {
        id: job._id.toString(),
        uploadId: job.uploadId,
        status: job.status,
        fileName: job.fileName,
        summary: job.summary,
        error: job.error,
        createdAt: (job as unknown as { createdAt: Date }).createdAt,
      },
    };
  }

  @Get('bank-statements')
  @RequireCapability(MEMBERSHIP_CAPABILITIES.NSBU_BASE_READ)
  async listBatches(
    @Param('orgId') orgId: string,
    @Param('periodId') periodId: string,
  ) {
    const batches = await this.bank.listBatchesForPeriod({
      organizationId: orgId,
      periodId,
    });
    // Derive a single human-facing status per batch so the UI doesn't have
    // to: any still-draft rows → 'draft' (needs attention); otherwise the
    // whole batch is 'committed'.
    const items = batches.map((b) => ({
      ...b,
      status: b.statusCounts.draft > 0 ? 'draft' : 'committed',
      pendingRed: b.draftColorCounts.red,
    }));
    return { success: true, batches: items };
  }

  @Get('bank-statements/:uploadId/drafts')
  @RequireCapability(MEMBERSHIP_CAPABILITIES.NSBU_BASE_READ)
  async listDrafts(
    @Param('orgId') orgId: string,
    @Param('uploadId') uploadId: string,
    @Query('status') status?: 'draft' | 'committed',
  ) {
    const enriched = await this.bank.listDraftsForUpload({
      organizationId: orgId,
      uploadId,
      // Default (no status) keeps the live preview behaviour: draft rows only.
      // A committed batch passes ?status=committed to load it read-only.
      statuses: status ? [status] : undefined,
    });

    const items = enriched.map(
      ({
        entry,
        commitReady,
        needsAccount,
        needsDocument,
        autoCreatedCounterparty,
        reason,
        recordAccount,
        direction,
        isInternalTransfer,
        counterpartyId,
        counterpartyName,
        documentKind,
        documents,
      }) => ({
        id: entry._id.toString(),
        sourceRef: entry.sourceRef,
        date: entry.date,
        description: entry.description,
        totalAmount: entry.totalAmount.toString(),
        status: entry.status,
        commitReady,
        needsAccount,
        needsDocument,
        autoCreatedCounterparty,
        previewReason: reason,
        recordAccount,
        direction,
        isInternalTransfer,
        counterpartyId,
        counterpartyName,
        documentKind,
        documents,
        createdAt: (entry as unknown as { createdAt: Date }).createdAt,
      }),
    );

    return { success: true, uploadId, drafts: items };
  }

  @Post('bank-statements/:uploadId/commit')
  @HttpCode(200)
  @RequireCapability(MEMBERSHIP_CAPABILITIES.NSBU_BASE_WRITE)
  async commit(
    @CurrentUser() user: UserDocument,
    @Param('orgId') orgId: string,
    @Param('periodId') periodId: string,
    @Param('uploadId') uploadId: string,
    @Body() body: CommitBankDraftsDto,
  ) {
    const result = await this.bank.commitDrafts({
      organizationId: orgId,
      periodId,
      uploadId,
      entryIds: body.entryIds,
      actor: user,
    });
    return { success: true, uploadId, ...result };
  }

  /**
   * Fix a draft (bank ТЗ §7 preview screen). The operator picks the real
   * accountCode for a RED row, optionally re-attributes to a different
   * counterparty, optionally rewrites the description.
   */
  @Patch('bank-statements/:uploadId/drafts/:entryId')
  @RequireCapability(MEMBERSHIP_CAPABILITIES.NSBU_BASE_WRITE)
  async updateDraft(
    @CurrentUser() user: UserDocument,
    @Param('orgId') orgId: string,
    @Param('periodId') periodId: string,
    @Param('uploadId') uploadId: string,
    @Param('entryId') entryId: string,
    @Body() body: UpdateBankDraftDto,
  ) {
    const entry = await this.bank.updateDraft({
      organizationId: orgId,
      periodId,
      uploadId,
      entryId,
      patch: {
        accountCode: body.accountCode,
        counterpartyId: body.counterpartyId,
        description: body.description,
        documents: body.documents,
      },
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

  /**
   * Bank ТЗ §7 learning loop - "Добавить в правила" button after fixing a
   * RED treasury row. Persists a TreasuryRule so the same pattern resolves
   * automatically on the next statement.
   *
   * The :entryId path parameter is informational only - we don't reach back
   * into the draft from here. It's in the URL so the audit log links the
   * rule back to the row that prompted its creation.
   */
  @Post('bank-statements/:uploadId/drafts/:entryId/learn-rule')
  @HttpCode(201)
  @RequireCapability(MEMBERSHIP_CAPABILITIES.NSBU_BASE_WRITE)
  async learnRule(
    @CurrentUser() user: UserDocument,
    @Param('orgId') orgId: string,
    @Body() body: LearnTreasuryRuleDto,
  ) {
    const rule = await this.treasury.createRule({
      organizationId: orgId,
      pattern: body.pattern,
      recordAccountCode: body.recordAccountCode,
      kind: body.kind,
      description: body.description,
      priority: body.priority,
      actor: user,
      learnedFromBankReview: true,
    });

    return {
      success: true,
      rule: {
        id: rule._id.toString(),
        kind: rule.kind,
        pattern: rule.pattern,
        recordAccountCode: rule.recordAccountCode,
        description: rule.description,
        priority: rule.priority,
        learnedFromBankReview: rule.learnedFromBankReview,
        createdAt: (rule as unknown as { createdAt: Date }).createdAt,
      },
    };
  }
}
