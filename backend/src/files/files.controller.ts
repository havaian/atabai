import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { FileProcessingLimitGuard } from '../auth/guards/file-processing-limit.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { UserDocument } from '../users/schemas/user.schema';
import { ActiveOrgId } from '../common/decorators/active-org-id.decorator';
import { UploadFileDto } from './dto/upload-file.dto';
import { FilesService } from './files.service';

/**
 * /api/files/* — file upload, processing status, download, transformation,
 * source-workbook, and delete. Every legacy route from
 * backend/src/files/routes.js is preserved with the same path + verb.
 *
 * Multer storage + filter + size cap is registered globally via MulterModule
 * in FilesModule (which reads them from ConfigService at boot), so the
 * interceptor here only needs to name the field.
 *
 * Task 6 — Migration to ledger-spine architecture:
 *   Every user-side endpoint is now org-scoped via the X-Active-Org-Id
 *   header. Files belong to the active org at upload time; user-side
 *   listings and detail/download endpoints only return files matching
 *   the caller's current org. Pre-migration files (organizationId = null)
 *   are not visible to users at all — they remain accessible exclusively
 *   via /admin/files for retroactive admin work.
 */
@Controller('files')
@UseGuards(JwtAuthGuard)
export class FilesController {
  constructor(private readonly files: FilesService) {}

  @Post('upload')
  @UseGuards(FileProcessingLimitGuard)
  @UseInterceptors(FileInterceptor('file'))
  uploadAndProcess(
    @CurrentUser() user: UserDocument,
    @ActiveOrgId() activeOrgId: string | null,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: UploadFileDto,
  ) {
    return this.files.uploadAndProcess({ file, template: body.template, user, activeOrgId });
  }

  @Get('history')
  getHistory(
    @CurrentUser() user: UserDocument,
    @ActiveOrgId() activeOrgId: string | null,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('status') status?: string,
  ) {
    return this.files.getHistory(user, {
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
      status,
      activeOrgId,
    });
  }

  @Get('template/:templateType')
  getTemplateFiles(
    @CurrentUser() user: UserDocument,
    @ActiveOrgId() activeOrgId: string | null,
    @Param('templateType') templateType: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('status') status?: string,
  ) {
    return this.files.getTemplateFiles(user, {
      templateType: templateType as never,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
      status,
      activeOrgId,
    });
  }

  @Get('status/:jobId')
  getProcessingStatus(
    @CurrentUser() user: UserDocument,
    @ActiveOrgId() activeOrgId: string | null,
    @Param('jobId') jobId: string,
  ) {
    return this.files.getProcessingStatus(user, jobId, activeOrgId);
  }

  @Post('retry/:jobId')
  @HttpCode(200)
  retryProcessing(
    @CurrentUser() user: UserDocument,
    @ActiveOrgId() activeOrgId: string | null,
    @Param('jobId') jobId: string,
  ) {
    return this.files.retryProcessing(user, jobId, activeOrgId);
  }

  @Get(':fileId/download')
  async downloadFile(
    @CurrentUser() user: UserDocument,
    @ActiveOrgId() activeOrgId: string | null,
    @Param('fileId') fileId: string,
    @Query('type') type: 'original' | 'processed' = 'processed',
    @Res() res: Response,
  ): Promise<void> {
    await this.files.streamDownload(user, fileId, type, res, activeOrgId);
  }

  @Get(':fileId/transformation')
  getTransformation(
    @CurrentUser() user: UserDocument,
    @ActiveOrgId() activeOrgId: string | null,
    @Param('fileId') fileId: string,
  ) {
    return this.files.getTransformation(user, fileId, activeOrgId);
  }

  @Get(':fileId/source-workbook')
  getSourceWorkbook(
    @CurrentUser() user: UserDocument,
    @ActiveOrgId() activeOrgId: string | null,
    @Param('fileId') fileId: string,
  ) {
    return this.files.getSourceWorkbook(user, fileId, activeOrgId);
  }

  @Post(':fileId/transformation/regenerate')
  @HttpCode(200)
  regenerateTransformation(
    @CurrentUser() user: UserDocument,
    @ActiveOrgId() activeOrgId: string | null,
    @Param('fileId') fileId: string,
  ) {
    return this.files.regenerateTransformation(user, fileId, activeOrgId);
  }

  @Get(':fileId')
  getFileDetails(
    @CurrentUser() user: UserDocument,
    @ActiveOrgId() activeOrgId: string | null,
    @Param('fileId') fileId: string,
  ) {
    return this.files.getFileDetails(user, fileId, activeOrgId);
  }

  @Delete(':fileId')
  deleteFile(
    @CurrentUser() user: UserDocument,
    @ActiveOrgId() activeOrgId: string | null,
    @Param('fileId') fileId: string,
  ) {
    return this.files.deleteFile(user, fileId, activeOrgId);
  }
}
