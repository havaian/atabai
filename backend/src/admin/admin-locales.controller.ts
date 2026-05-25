import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AdminVerifiedGuard } from '../auth/guards/admin-verified.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { UserDocument } from '../users/schemas/user.schema';
import { AdminLocalesService } from './admin-locales.service';
import { CreateLocaleKeyDto, UpdateLocaleKeyDto } from './dto';

@Controller('admin/locales')
@UseGuards(JwtAuthGuard, RolesGuard, AdminVerifiedGuard)
@Roles('admin', 'super_admin')
export class AdminLocalesController {
  constructor(private readonly service: AdminLocalesService) {}

  @Get()
  list(
    @Query('app') app?: string,
    @Query('namespace') namespace?: string,
    @Query('q') q?: string,
    @Query('missing') missing?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.listKeys({
      app,
      namespace,
      q,
      missing,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('namespaces')
  listNamespaces() {
    return this.service.listNamespaces();
  }

  @Get('stats')
  getStats() {
    return this.service.getStats();
  }

  @Post('keys')
  @Roles('super_admin')
  @HttpCode(201)
  createKey(@CurrentUser() admin: UserDocument, @Body() body: CreateLocaleKeyDto) {
    return this.service.createKey(admin._id, body);
  }

  @Patch('keys/:keyId')
  @Roles('super_admin')
  updateKey(
    @CurrentUser() admin: UserDocument,
    @Param('keyId') keyId: string,
    @Body() body: UpdateLocaleKeyDto,
  ) {
    return this.service.updateKey(admin._id, keyId, body);
  }

  @Delete('keys/:keyId')
  @Roles('super_admin')
  deleteKey(@CurrentUser() admin: UserDocument, @Param('keyId') keyId: string) {
    return this.service.deleteKey(admin._id, keyId);
  }

  @Post('seed')
  @Roles('super_admin')
  manualSeed(@CurrentUser() admin: UserDocument) {
    return this.service.manualSeed(admin._id);
  }
}
