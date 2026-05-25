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
    @UploadedFile() file: Express.Multer.File,
    @Body() body: UploadFileDto,
  ) {
    return this.files.uploadAndProcess({ file, template: body.template, user });
  }

  @Get('history')
  getHistory(
    @CurrentUser() user: UserDocument,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('status') status?: string,
  ) {
    return this.files.getHistory(user, {
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
      status,
    });
  }

  @Get('template/:templateType')
  getTemplateFiles(
    @CurrentUser() user: UserDocument,
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
    });
  }

  @Get('status/:jobId')
  getProcessingStatus(@CurrentUser() user: UserDocument, @Param('jobId') jobId: string) {
    return this.files.getProcessingStatus(user, jobId);
  }

  @Post('retry/:jobId')
  @HttpCode(200)
  retryProcessing(@CurrentUser() user: UserDocument, @Param('jobId') jobId: string) {
    return this.files.retryProcessing(user, jobId);
  }

  @Get(':fileId/download')
  async downloadFile(
    @CurrentUser() user: UserDocument,
    @Param('fileId') fileId: string,
    @Query('type') type: 'original' | 'processed' = 'processed',
    @Res() res: Response,
  ): Promise<void> {
    await this.files.streamDownload(user, fileId, type, res);
  }

  @Get(':fileId/transformation')
  getTransformation(@CurrentUser() user: UserDocument, @Param('fileId') fileId: string) {
    return this.files.getTransformation(user, fileId);
  }

  @Get(':fileId/source-workbook')
  getSourceWorkbook(@CurrentUser() user: UserDocument, @Param('fileId') fileId: string) {
    return this.files.getSourceWorkbook(user, fileId);
  }

  @Post(':fileId/transformation/regenerate')
  @HttpCode(200)
  regenerateTransformation(
    @CurrentUser() user: UserDocument,
    @Param('fileId') fileId: string,
  ) {
    return this.files.regenerateTransformation(user, fileId);
  }

  @Get(':fileId')
  getFileDetails(@CurrentUser() user: UserDocument, @Param('fileId') fileId: string) {
    return this.files.getFileDetails(user, fileId);
  }

  @Delete(':fileId')
  deleteFile(@CurrentUser() user: UserDocument, @Param('fileId') fileId: string) {
    return this.files.deleteFile(user, fileId);
  }
}
