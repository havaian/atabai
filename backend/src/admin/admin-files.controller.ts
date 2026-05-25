import { Controller, Get, Param, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AdminVerifiedGuard } from '../auth/guards/admin-verified.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { UserDocument } from '../users/schemas/user.schema';
import { AdminFilesService } from './admin-files.service';

@Controller('admin/files')
@UseGuards(JwtAuthGuard, RolesGuard, AdminVerifiedGuard)
@Roles('admin', 'super_admin')
export class AdminFilesController {
  constructor(private readonly files: AdminFilesService) {}

  @Get()
  list(
    @Query('userId') userId?: string,
    @Query('userEmail') userEmail?: string,
    @Query('status') status?: string,
    @Query('templateType') templateType?: string,
    @Query('q') q?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.files.listAll({
      userId,
      userEmail,
      status,
      templateType,
      q,
      from,
      to,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get(':fileId')
  getDetails(@Param('fileId') fileId: string) {
    return this.files.getDetails(fileId);
  }

  @Get(':fileId/transformation')
  getTransformation(@Param('fileId') fileId: string) {
    return this.files.getTransformation(fileId);
  }

  @Get(':fileId/download')
  async download(
    @CurrentUser() admin: UserDocument,
    @Param('fileId') fileId: string,
    @Query('type') type: 'original' | 'processed' = 'processed',
    @Req() _req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.files.downloadFile(fileId, type, admin._id.toString(), admin.email, res);
  }
}
