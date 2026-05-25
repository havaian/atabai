import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';

import { LocaleKey, type LocaleApp, type LocaleKeyModel } from './schemas/locale-key.schema';

export const ALLOWED_LANGS = ['ru', 'en', 'uz'] as const;
export type AllowedLang = (typeof ALLOWED_LANGS)[number];
export const ALLOWED_APPS = ['user', 'admin'] as const;

/**
 * Bundle versioning + in-memory cache for the public locale endpoints.
 *
 * The frontend polls `GET /api/locales/version` every 30s; if the version
 * has changed for an app, it re-fetches the full bundle via
 * `GET /api/locales/bundle/:app/:lang`. Any mutation to a locale key bumps
 * the version for the affected app, which busts the cache automatically.
 *
 * Cache key: `${app}:${lang}:${version}` — only one version is kept per
 * (app, lang) tuple at a time.
 */
@Injectable()
export class LocaleBundleService {
  private readonly bundleVersions: Record<LocaleApp, number> = { user: 1, admin: 1 };
  private readonly bundleCache = new Map<string, Record<string, unknown>>();

  constructor(@InjectModel(LocaleKey.name) private readonly localeModel: LocaleKeyModel) {}

  bumpVersion(app: LocaleApp): void {
    this.bundleVersions[app] += 1;
  }

  getVersions(): Record<LocaleApp, number> {
    return { ...this.bundleVersions };
  }

  async getBundle(app: LocaleApp, lang: AllowedLang): Promise<Record<string, unknown>> {
    const version = this.bundleVersions[app];
    const cacheKey = `${app}:${lang}:${version}`;
    const cached = this.bundleCache.get(cacheKey);
    if (cached) return cached;

    const docs = await this.localeModel.find({ app }).select(`key values.${lang}`).lean();
    const nested: Record<string, unknown> = {};
    for (const doc of docs) {
      const value = doc.values?.[lang];
      if (value === null || value === undefined || value === '') continue;
      this.setNested(nested, doc.key, value);
    }

    // Drop stale entries for this (app, lang) tuple
    for (const k of this.bundleCache.keys()) {
      if (k.startsWith(`${app}:${lang}:`) && k !== cacheKey) {
        this.bundleCache.delete(k);
      }
    }
    this.bundleCache.set(cacheKey, nested);

    return nested;
  }

  /** "admin.users.title" + value → { admin: { users: { title: value } } } */
  private setNested(target: Record<string, unknown>, dottedKey: string, value: unknown): void {
    const parts = dottedKey.split('.');
    let cur: Record<string, unknown> = target;
    for (let i = 0; i < parts.length - 1; i++) {
      const p = parts[i];
      if (typeof cur[p] !== 'object' || cur[p] === null) cur[p] = {};
      cur = cur[p] as Record<string, unknown>;
    }
    cur[parts[parts.length - 1]] = value;
  }
}
