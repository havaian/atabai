/**
 * src/integrations/orginfo/orginfo.types.ts
 *
 * Normalized organization-info shape returned by any Orginfo provider, plus the
 * provider interface and its DI token. Consumers depend only on OrgInfo and
 * OrginfoService — never on a specific provider — so the gateway can be swapped
 * (iHamkor today, something else later) without touching call sites.
 */

/** Normalized company details for a single INN (СТИР). Nulls where unknown. */
export interface OrgInfo {
  /** The INN this record is for. */
  inn: string;
  /** Full legal name. */
  name: string | null;
  /** Short/trade name if provided. */
  shortName: string | null;
  address: string | null;
  /** Contact phone, if provided. */
  phone: string | null;
  /** Contact email, if provided. */
  email: string | null;
  /** Director / CEO full name if provided. */
  director: string | null;
  /** Registration/activity status text (e.g. active/liquidated) if provided. */
  status: string | null;
  /** Whether registered as a VAT payer, if the provider reports it. */
  vatRegistered: boolean | null;
  /** Primary activity classifier code (ОКЭД) if provided. */
  activityCode: string | null;
  activityName: string | null;
  /** Provider id the record came from (e.g. 'ihamkor'). */
  source: string;
  /** ISO timestamp of when it was fetched. */
  fetchedAt: string;
  /** The provider's raw payload, kept verbatim for fields not mapped above. */
  raw: unknown;
}

export interface OrgInfoProvider {
  /** Stable provider id, stored on OrgInfo.source. */
  readonly id: string;
  /** True when the provider has the config (base URL + key) it needs to make calls. */
  isConfigured(): boolean;
  /** Look up one INN. Returns null when unconfigured or not found. */
  lookup(inn: string): Promise<OrgInfo | null>;
}

/** DI token for the active OrgInfoProvider implementation. */
export const ORG_INFO_PROVIDER = Symbol('ORG_INFO_PROVIDER');
