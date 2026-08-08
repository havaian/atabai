/**
 * src/integrations/currencies/currencies.config.ts
 *
 * Self-contained configuration for the Currencies (CBU exchange-rate)
 * integration, read from process.env with safe defaults so the module drops
 * into any app without touching the global typed env schema. Move these keys
 * into AppConfig (src/config/configuration.ts) later if you want them validated
 * at boot alongside the rest.
 *
 * Env vars (all optional):
 *   CBU_API_BASE_URL          default https://cbu.uz/ru/arkhiv-kursov-valyut/json
 *   CBU_API_TIMEOUT_MS        default 10000
 *   CURRENCIES_CRON           default '0 6 * * *'  (06:00 daily)
 *   CURRENCIES_CRON_TZ        default 'Asia/Tashkent'
 *   CURRENCIES_CRON_ENABLED   default 'false'      (nothing scheduled until you flip this)
 *   CURRENCIES_CACHE_TTL_HRS  default 12           (how long "today"'s rate is reused before a refetch)
 */
export interface CurrenciesConfig {
  /** CBU JSON API base, no trailing slash. */
  baseUrl: string;
  /** HTTP timeout (ms) for CBU calls. */
  timeoutMs: number;
  /** Cron expression for the daily refresh job. */
  cron: string;
  /** Timezone the cron expression is evaluated in. */
  cronTimezone: string;
  /**
   * Master switch for the scheduled refresh. Off by default so importing this
   * module never starts fetching on its own - turn it on once the pipeline
   * placement is decided.
   */
  cronEnabled: boolean;
  /**
   * How long a cached rate for the CURRENT day is reused before getRate()
   * attempts a refetch. Past-day rates are immutable and always served from
   * cache regardless of this value.
   */
  cacheTtlHours: number;
}

function toInt(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function loadCurrenciesConfig(): CurrenciesConfig {
  const env = process.env;
  return {
    baseUrl: (
      env.CBU_API_BASE_URL || 'https://cbu.uz/ru/arkhiv-kursov-valyut/json'
    ).replace(/\/+$/, ''),
    timeoutMs: toInt(env.CBU_API_TIMEOUT_MS, 10000),
    cron: env.CURRENCIES_CRON || '0 6 * * *',
    cronTimezone: env.CURRENCIES_CRON_TZ || 'Asia/Tashkent',
    cronEnabled: (env.CURRENCIES_CRON_ENABLED || 'false').toLowerCase() === 'true',
    cacheTtlHours: toInt(env.CURRENCIES_CACHE_TTL_HRS, 12),
  };
}
