import {
  BadRequestException,
  Controller,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MEMBERSHIP_CAPABILITIES } from '../organizations/constants/membership-capabilities';
import { RequireCapability } from '../organizations/decorators/require-capability.decorator';
import { OrgMembershipGuard } from '../organizations/guards/org-membership.guard';
import type { UserDocument } from '../users/schemas/user.schema';
import { OsvIngestionService } from './ingestion/osv-ingestion.service';

/**
 * Mounted at /api/organizations/:orgId/ledger.
 *
 * One endpoint for this slice: ОСВ upload + ingest. The file lands on disk
 * via the Multer config registered in LedgerModule (same defaults as the
 * legacy FilesModule — .xlsx/.xls only, size-capped). The file is NOT
 * deleted post-ingest: for accounting audit purposes the operator may need
 * to retrieve the original later. A dedicated OsvImport entity to track
 * upload metadata is a follow-up (see [[project-ledger-spine]] open items).
 *
 * Capability gate: `nsbu.base.write` — the bookkeeper domain per the access
 * spine (architecture doc §7.6). Admin role implies all capabilities so org
 * admins can upload too without explicit grant.
 */
@Controller('organizations/:orgId/ledger')
@UseGuards(JwtAuthGuard, OrgMembershipGuard)
export class OsvImportsController {
  constructor(private readonly osv: OsvIngestionService) {}

  @Post('periods/:periodId/osv-imports')
  @RequireCapability(MEMBERSHIP_CAPABILITIES.NSBU_BASE_WRITE)
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @CurrentUser() user: UserDocument,
    @Param('orgId') orgId: string,
    @Param('periodId') periodId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) {
      throw new BadRequestException({
        error: 'NO_FILE',
        message: 'No file uploaded',
      });
    }

    const summary = await this.osv.ingestFromFile({
      organizationId: orgId,
      periodId,
      filePath: file.path,
      jobId: file.filename,
    });

    return {
      success: true,
      file: {
        originalName: Buffer.from(file.originalname, 'latin1').toString('utf8'),
        storedName: file.filename,
        size: file.size,
      },
      summary,
      uploadedBy: user._id.toString(),
    };
  }
}
