import { BadRequestException, Controller, Get, Param } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';

import { Public } from '../auth/decorators/public.decorator';
import {
  LocaleBundleService,
  ALLOWED_LANGS,
  type AllowedLang,
} from './locale-bundle.service';
import type { LocaleApp } from './schemas/locale-key.schema';

const ALLOWED_APPS: readonly LocaleApp[] = ['user', 'admin'];

/**
 * Mounted at /api/locales - public (unauthenticated) endpoints used by the
 * frontend i18n loader. Polled every 30s for version changes; cache hit ratio
 * is high so server load is minimal.
 *
 * SkipThrottle on /version matches the legacy backend (`/api/locales/version`
 * was explicitly excluded from the global rate limiter).
 */
@Controller('locales')
export class PublicLocalesController {
  constructor(private readonly bundle: LocaleBundleService) {}

  @Public()
  @SkipThrottle()
  @Get('version')
  getVersions() {
    return { success: true, versions: this.bundle.getVersions() };
  }

  @Public()
  @Get('bundle/:app/:lang')
  async getBundle(@Param('app') app: string, @Param('lang') lang: string) {
    if (!ALLOWED_APPS.includes(app as LocaleApp)) {
      throw new BadRequestException({ error: 'INVALID_APP' });
    }
    if (!(ALLOWED_LANGS as readonly string[]).includes(lang)) {
      throw new BadRequestException({ error: 'INVALID_LANG' });
    }
    const version = this.bundle.getVersions()[app as LocaleApp];
    const bundle = await this.bundle.getBundle(app as LocaleApp, lang as AllowedLang);
    return { success: true, version, bundle };
  }
}
