/**
 * Uzbek bank account-number mask parser (methodology §3.4).
 *
 * The 20-digit settlement-account number is structured, e.g.:
 *
 *   20208 000 9 07133438 001
 *   └───┘ └─┘ │ └──────┘ └─┘
 *     │     │  │     │     └─ sequence    (last 3 - порядковый номер счёта клиента)
 *     │     │  │     └─────── client code (8 - уникальный код клиента в банке)
 *     │     │  └───────────── control key (1 - контрольный ключ банка)
 *     │     └──────────────── currency    (3 - код валюты, 000 = сумы)
 *     └────────────────────── account type(5 - тип счёта, e.g. 20208 = депозиты
 *                                            до востребования юрлиц)
 *
 * What the methodology actually concludes about this mask:
 *   - Currency CAN be derived from the number (the 3-digit currency position).
 *   - "Primary vs secondary" CANNOT be derived reliably in the general case -
 *     it only means anything within accounts of the SAME type for the SAME
 *     client, comparing currency (000) + the last three digits. So this parser
 *     deliberately exposes the raw segments and a currency derivation, and does
 *     NOT attempt a primary/secondary verdict.
 *
 * Pure module: no I/O, no DB, no logging. Returns structured segments or null
 * when the input isn't a recognisable 20-digit number, so callers can fall
 * back to manual entry instead of guessing.
 */

/** ISO 4217 numeric currency codes seen in the currency position of the mask.
 *
 * Only the codes confirmed against real data / the common set are mapped:
 *   000 → UZS (сумы - the methodology's worked example)
 *   840 → USD, 978 → EUR, 643 → RUB (standard ISO 4217 numeric)
 *
 * Any other code is parsed (the digits are still returned) but left UNMAPPED
 * (currency: null) rather than guessed - the UI then leaves currency for the
 * bookkeeper to set. Extend this map as more codes are confirmed.
 */
const CURRENCY_BY_MASK_CODE: Readonly<Record<string, string>> = {
  '000': 'UZS',
  '840': 'USD',
  '978': 'EUR',
  '643': 'RUB',
};

export interface ParsedAccountMask {
  /** First 5 digits - account type (тип счёта). */
  accountType: string;
  /** 3-digit currency code position (код валюты). */
  currencyCode: string;
  /** 1 control-key digit (контрольный ключ банка). */
  controlKey: string;
  /** 8-digit client code (уникальный код клиента в банке). */
  clientCode: string;
  /** Last 3 digits - sequence number of this account for the client. */
  sequence: string;
  /**
   * ISO currency derived from `currencyCode`, or null when the code isn't in
   * the confirmed map (see CURRENCY_BY_MASK_CODE). Null means "couldn't
   * derive - leave it to manual entry", never a default guess.
   */
  currency: string | null;
}

/** Strip spaces so a number entered "20208 000 9 …" parses the same as packed. */
const normalize = (raw: string): string => raw.replace(/\s+/g, '');

/**
 * Parse a 20-digit account number into its mask segments. Returns null when
 * the input (after stripping spaces) is not exactly 20 digits - the caller
 * treats that as "unparseable, fall back to manual entry".
 */
export function parseAccountMask(raw: string | null | undefined): ParsedAccountMask | null {
  if (!raw) return null;
  const n = normalize(raw);
  if (!/^\d{20}$/.test(n)) return null;

  const currencyCode = n.slice(5, 8);
  return {
    accountType: n.slice(0, 5),
    currencyCode,
    controlKey: n.slice(8, 9),
    clientCode: n.slice(9, 17),
    sequence: n.slice(17, 20),
    currency: CURRENCY_BY_MASK_CODE[currencyCode] ?? null,
  };
}

/**
 * Convenience for the common need: "what currency is this account in?".
 * Returns the ISO code or null when it can't be derived. Pure wrapper over
 * parseAccountMask so callers that only want the currency don't repeat the
 * slice logic.
 */
export function deriveCurrencyFromAccountNumber(
  raw: string | null | undefined,
): string | null {
  return parseAccountMask(raw)?.currency ?? null;
}
