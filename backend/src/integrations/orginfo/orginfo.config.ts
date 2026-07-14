/**
 * src/integrations/orginfo/orginfo.config.ts
 *
 * Self-contained configuration for the Orginfo (counterparty-by-INN lookup)
 * integration, read from process.env with safe defaults so the module drops
 * into any app without touching the global env schema.
 *
 * The concrete provider is iHamkor (the recommended gateway), but its exact
 * request/response contract isn't pinned here — the base URL and auth are fully
 * configurable so the real endpoint can be plugged in without code changes.
 *
 * Env vars (all optional):
 *   ORGINFO_PROVIDER          'ihamkor' | 'none'   default 'ihamkor'
 *   IHAMKOR_API_BASE_URL      e.g. https://api.ihamkor.uz/org  or  .../org/{inn}
 *   IHAMKOR_API_KEY           the API key/token
 *   IHAMKOR_AUTH_HEADER       header carrying the key   default 'Authorization'
 *   IHAMKOR_AUTH_SCHEME       prefix before the key     default 'Bearer' ('' = raw key)
 *   ORGINFO_API_TIMEOUT_MS    default 10000
 *   ORGINFO_CACHE_TTL_HRS     default 720 (30 days — org data changes rarely)
 */
export interface OrginfoConfig {
  provider: 'ihamkor' | 'none';
  ihamkor: {
    /** Base URL. May contain a `{inn}` placeholder; otherwise the INN is appended as a path segment. */
    baseUrl: string | null;
    apiKey: string | null;
    /** Header name the key is sent in. */
    authHeader: string;
    /** Scheme prefix (e.g. 'Bearer'); empty string sends the raw key. */
    authScheme: string;
    timeoutMs: number;
  };
  cacheTtlHours: number;
}

function toInt(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function loadOrginfoConfig(): OrginfoConfig {
  const env = process.env;
  const provider = (env.ORGINFO_PROVIDER || 'ihamkor').toLowerCase();
  return {
    provider: provider === 'none' ? 'none' : 'ihamkor',
    ihamkor: {
      baseUrl: env.IHAMKOR_API_BASE_URL ? env.IHAMKOR_API_BASE_URL.trim() : null,
      apiKey: env.IHAMKOR_API_KEY ? env.IHAMKOR_API_KEY.trim() : null,
      authHeader: env.IHAMKOR_AUTH_HEADER || 'Authorization',
      authScheme:
        env.IHAMKOR_AUTH_SCHEME === undefined ? 'Bearer' : env.IHAMKOR_AUTH_SCHEME,
      timeoutMs: toInt(env.ORGINFO_API_TIMEOUT_MS, 10000),
    },
    cacheTtlHours: toInt(env.ORGINFO_CACHE_TTL_HRS, 720),
  };
}
