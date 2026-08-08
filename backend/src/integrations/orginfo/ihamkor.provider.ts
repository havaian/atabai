/**
 * src/integrations/orginfo/ihamkor.provider.ts
 *
 * OrgInfoProvider backed by the iHamkor gateway. The exact request/response
 * contract isn't pinned, so URL construction and auth are config-driven and the
 * response mapping is best-effort (tries common field-name variants, keeps the
 * raw payload). When the real contract is known, adjust `map()` and the URL
 * shape - no call sites change.
 */
import { Injectable } from '@nestjs/common';
import axios from 'axios';

import { AppLoggerService } from '../../common/logger/app-logger.service';
import { loadOrginfoConfig, type OrginfoConfig } from './orginfo.config';
import type { OrgInfo, OrgInfoProvider } from './orginfo.types';

@Injectable()
export class IhamkorProvider implements OrgInfoProvider {
  readonly id = 'ihamkor';
  private readonly config: OrginfoConfig = loadOrginfoConfig();

  constructor(private readonly logger: AppLoggerService) {}

  isConfigured(): boolean {
    return (
      this.config.provider === 'ihamkor' &&
      !!this.config.ihamkor.baseUrl &&
      !!this.config.ihamkor.apiKey
    );
  }

  async lookup(inn: string): Promise<OrgInfo | null> {
    if (!this.isConfigured()) return null;
    const { baseUrl, apiKey, authHeader, authScheme, timeoutMs } =
      this.config.ihamkor;

    // baseUrl may carry a {inn} placeholder; otherwise append the INN as a path.
    const url = baseUrl!.includes('{inn}')
      ? baseUrl!.replace('{inn}', encodeURIComponent(inn))
      : `${baseUrl!.replace(/\/+$/, '')}/${encodeURIComponent(inn)}`;

    const headerValue = authScheme ? `${authScheme} ${apiKey!}` : apiKey!;

    try {
      const resp = await axios.get<Record<string, unknown>>(url, {
        timeout: timeoutMs,
        headers: { [authHeader]: headerValue, Accept: 'application/json' },
      });
      const body = resp.data;
      if (!body || typeof body !== 'object') return null;
      return this.map(inn, body);
    } catch (err) {
      // 404 = not found → null. Other errors are logged but still return null so
      // a lookup never breaks the caller.
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status !== 404) {
        this.logger.error(err, { url, inn }, 'IhamkorProvider');
      }
      return null;
    }
  }

  /**
   * Best-effort mapping to OrgInfo across common field-name variants
   * (ru/uz/en, snake/camel). Keeps the raw payload for anything unmapped.
   */
  private map(inn: string, body: Record<string, unknown>): OrgInfo {
    const rec = this.unwrap(body);
    const s = (...keys: string[]) => this.firstString(rec, keys);
    return {
      inn,
      name: s('name', 'fullName', 'full_name', 'companyName', 'legalName', 'nameRu', 'name_ru', 'nomi'),
      shortName: s('shortName', 'short_name', 'brandName', 'shortNameRu'),
      address: s('address', 'legalAddress', 'legal_address', 'manzil'),
      phone: s('phone', 'phoneNumber', 'phone_number', 'tel', 'telefon'),
      email: s('email', 'mail', 'eMail', 'e_mail'),
      director: s('director', 'ceo', 'head', 'rahbar', 'directorName'),
      status: s('status', 'state', 'holati'),
      vatRegistered: this.firstBoolean(rec, ['vat', 'isVat', 'vatPayer', 'is_vat_payer', 'ndsActive']),
      activityCode: s('oked', 'okad', 'activityCode', 'activity_code'),
      activityName: s('activityName', 'activity', 'faoliyat'),
      source: this.id,
      fetchedAt: new Date().toISOString(),
      raw: body,
    };
  }

  private unwrap(body: Record<string, unknown>): Record<string, unknown> {
    for (const key of ['data', 'result', 'company', 'organization', 'org']) {
      const inner = body[key];
      if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
        return inner as Record<string, unknown>;
      }
    }
    return body;
  }

  private firstString(rec: Record<string, unknown>, keys: string[]): string | null {
    for (const k of keys) {
      const v = rec[k];
      if (typeof v === 'string' && v.trim()) return v.trim();
      if (typeof v === 'number') return String(v);
    }
    return null;
  }

  private firstBoolean(rec: Record<string, unknown>, keys: string[]): boolean | null {
    for (const k of keys) {
      const v = rec[k];
      if (typeof v === 'boolean') return v;
      if (typeof v === 'string') {
        const t = v.toLowerCase();
        if (['true', 'yes', '1', 'active'].includes(t)) return true;
        if (['false', 'no', '0', 'inactive'].includes(t)) return false;
      }
      if (typeof v === 'number') return v !== 0;
    }
    return null;
  }
}
