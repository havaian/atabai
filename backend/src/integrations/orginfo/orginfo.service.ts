/**
 * src/integrations/orginfo/orginfo.service.ts
 *
 * Public API of the Orginfo integration: look up an organization by INN,
 * cache-first. Serves from the org_info_cache collection and only calls the
 * provider on a miss or when the cached row is older than the configured TTL.
 * Provider-agnostic - depends on the ORG_INFO_PROVIDER token, not iHamkor
 * directly.
 */
import { Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';

import { AppLoggerService } from '../../common/logger/app-logger.service';
import { loadOrginfoConfig, type OrginfoConfig } from './orginfo.config';
import {
  OrgInfoCache,
  type OrgInfoCacheModel,
} from './schemas/org-info-cache.schema';
import {
  ORG_INFO_PROVIDER,
  type OrgInfo,
  type OrgInfoProvider,
} from './orginfo.types';

export interface GetOrgInfoOptions {
  /** Bypass the cache and force a fresh provider fetch. */
  forceRefresh?: boolean;
}

@Injectable()
export class OrginfoService {
  private readonly config: OrginfoConfig = loadOrginfoConfig();

  constructor(
    @InjectModel(OrgInfoCache.name)
    private readonly cacheModel: OrgInfoCacheModel,
    @Inject(ORG_INFO_PROVIDER)
    private readonly provider: OrgInfoProvider,
    private readonly logger: AppLoggerService,
  ) {}

  /** True when the active provider has the config it needs to make calls. */
  isConfigured(): boolean {
    return this.provider.isConfigured();
  }

  /**
   * Look up an organization by INN. Returns null for a malformed INN, an
   * unconfigured provider with nothing cached, or a not-found result.
   */
  async getByInn(inn: string, opts: GetOrgInfoOptions = {}): Promise<OrgInfo | null> {
    const normalized = this.normalizeInn(inn);
    if (!normalized) return null;

    if (!opts.forceRefresh) {
      const cached = await this.cacheModel.findOne({ inn: normalized });
      if (cached && this.isFresh(cached.fetchedAt)) {
        return cached.data;
      }
    }

    let info: OrgInfo | null = null;
    try {
      info = await this.provider.lookup(normalized);
    } catch (err) {
      this.logger.error(err, { inn: normalized }, 'OrginfoService');
      info = null;
    }

    if (!info) {
      // Provider had nothing (or is unconfigured) - fall back to any cached row.
      const cached = await this.cacheModel.findOne({ inn: normalized });
      return cached?.data ?? null;
    }

    await this.cacheModel.findOneAndUpdate(
      { inn: normalized },
      { $set: { data: info, fetchedAt: new Date() } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    return info;
  }

  // ─── Internal ─────────────────────────────────────────────────────────────

  private isFresh(fetchedAt: Date): boolean {
    const ageMs = Date.now() - fetchedAt.getTime();
    return ageMs < this.config.cacheTtlHours * 60 * 60 * 1000;
  }

  /**
   * Uzbek INN (СТИР) is 9 digits. Strip spaces; accept only all-digit values of
   * a plausible length so a stray label never hits the provider.
   */
  private normalizeInn(inn: string): string | null {
    const s = (inn ?? '').replace(/\s+/g, '');
    if (!/^\d{8,14}$/.test(s)) return null;
    return s;
  }
}
