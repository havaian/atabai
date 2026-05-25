import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { TemplatesController } from './templates.controller';

// UsersModule is required because OptionalJwtAuthGuard (used on GET /api/templates)
// depends on UsersService; AuthModule re-exports the guard but not the service it pulls in.
@Module({
  imports: [AuthModule, UsersModule],
  controllers: [TemplatesController],
})
export class TemplatesModule {}
