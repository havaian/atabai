/**
 * src/integrations/orginfo/orginfo.module.ts
 *
 * Drop-in Orginfo (organization-by-INN lookup) module. Import it wherever the
 * app needs to enrich a counterparty from its INN and inject OrginfoService.
 * The active provider is bound to the ORG_INFO_PROVIDER token here (iHamkor
 * today); swap it in one place to change gateways.
 *
 * Safe by default: with no IHAMKOR_API_BASE_URL / IHAMKOR_API_KEY set, the
 * provider reports unconfigured and lookups return cached data or null without
 * making any network calls.
 */
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { IhamkorProvider } from './ihamkor.provider';
import { OrginfoService } from './orginfo.service';
import { ORG_INFO_PROVIDER } from './orginfo.types';
import {
  OrgInfoCache,
  OrgInfoCacheSchema,
} from './schemas/org-info-cache.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: OrgInfoCache.name, schema: OrgInfoCacheSchema },
    ]),
  ],
  providers: [
    IhamkorProvider,
    { provide: ORG_INFO_PROVIDER, useExisting: IhamkorProvider },
    OrginfoService,
  ],
  exports: [OrginfoService],
})
export class OrginfoModule {}
