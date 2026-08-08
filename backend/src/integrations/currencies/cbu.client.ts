/**
 * src/integrations/currencies/cbu.client.ts
 *
 * Thin client over the Central Bank of Uzbekistan public JSON API. It only
 * fetches and normalizes - no persistence, no caching (that's the service).
 *
 * Endpoints (base = CBU_API_BASE_URL):
 *   GET {base}/                     all currencies, latest
 *   GET {base}/{CCY}/               one currency, latest
 *   GET {base}/all/{YYYY-MM-DD}/    all currencies on a date
 *   GET {base}/{CCY}/{YYYY-MM-DD}/  one currency on a date
 *
 * Raw item shape (fields we use):
 *   { Ccy: "USD", Nominal: "1", Rate: "12550.00", Diff: "-5.2",
 *     Date: "05.07.2026", CcyNm_EN: "US Dollar", CcyNm_RU: "Доллар США" }
 * Date arrives as DD.MM.YYYY and is normalized to YYYY-MM-DD here.
 */
import { Injectable } from '@nestjs/common';
import axios from 'axios';

import { AppLoggerService } from '../../common/logger/app-logger.service';
import { loadCurrenciesConfig, type CurrenciesConfig } from './currencies.config';

/** A CBU rate after normalization. `rate`/`diff` stay strings to preserve precision. */
export interface CbuRate {
  ccy: string;
  date: string; // YYYY-MM-DD
  rate: string;
  nominal: number;
  diff: string | null;
  nameEn: string | null;
  nameRu: string | null;
}

interface CbuRawRate {
  Ccy?: string;
  Nominal?: string | number;
  Rate?: string | number;
  Diff?: string | number;
  Date?: string;
  CcyNm_EN?: string;
  CcyNm_RU?: string;
}

@Injectable()
export class CbuClient {
  private readonly config: CurrenciesConfig = loadCurrenciesConfig();

  constructor(private readonly logger: AppLoggerService) {}

  /** All currencies for the latest published day. */
  async fetchLatest(): Promise<CbuRate[]> {
    return this.get(`${this.config.baseUrl}/`);
  }

  /** All currencies for a specific 'YYYY-MM-DD'. */
  async fetchForDate(date: string): Promise<CbuRate[]> {
    return this.get(`${this.config.baseUrl}/all/${date}/`);
  }

  /**
   * One currency, latest or on a date. Returns null when the CBU has no row for
   * that currency/date.
   */
  async fetchOne(ccy: string, date?: string): Promise<CbuRate | null> {
    const suffix = date ? `${date}/` : '';
    const rows = await this.get(
      `${this.config.baseUrl}/${ccy.toUpperCase()}/${suffix}`,
    );
    return rows[0] ?? null;
  }

  private async get(url: string): Promise<CbuRate[]> {
    try {
      const resp = await axios.get<CbuRawRate[]>(url, {
        timeout: this.config.timeoutMs,
        // CBU returns an array; guard against HTML error pages.
        headers: { Accept: 'application/json' },
      });
      const data = Array.isArray(resp.data) ? resp.data : [];
      return data
        .map((r) => this.normalize(r))
        .filter((r): r is CbuRate => r !== null);
    } catch (err) {
      this.logger.error(err, { url }, 'CbuClient');
      throw err;
    }
  }

  private normalize(raw: CbuRawRate): CbuRate | null {
    if (!raw || !raw.Ccy || raw.Rate === undefined || raw.Rate === null) {
      return null;
    }
    const date = this.normalizeDate(raw.Date);
    if (!date) return null;
    const nominal = Number(raw.Nominal);
    return {
      ccy: String(raw.Ccy).toUpperCase().trim(),
      date,
      rate: String(raw.Rate).trim(),
      nominal: Number.isFinite(nominal) && nominal > 0 ? nominal : 1,
      diff:
        raw.Diff === undefined || raw.Diff === null ? null : String(raw.Diff).trim(),
      nameEn: raw.CcyNm_EN ?? null,
      nameRu: raw.CcyNm_RU ?? null,
    };
  }

  /** 'DD.MM.YYYY' → 'YYYY-MM-DD'. Passes through anything already ISO-shaped. */
  private normalizeDate(input: string | undefined): string | null {
    if (!input) return null;
    const s = input.trim();
    const dmy = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(s);
    if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    return null;
  }
}
