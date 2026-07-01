/**
 * Invoice-registry constants (methodology §7, build phases 1–4) — the enums and
 * the fixed NSBU accounts the Didox registry ingestion posts against. Kept
 * beside the accounting-policy constants: structure/enums only, no posting
 * logic. The posting itself lives in InvoiceIngestionService.
 */

// ─── Direction — which registry file ─────────────────────────────────────────

/**
 * Registry direction. Входящие (incoming) = supplier invoices we receive (we
 * buy → payable 6010); Исходящие (outgoing) = customer invoices we issue (we
 * sell → receivable 4010). The direction is NOT in the file, so the operator
 * picks it at upload — the same shape as the bank module picking the statement
 * account.
 */
export const INVOICE_DIRECTION = {
  INCOMING: 'incoming',
  OUTGOING: 'outgoing',
} as const;
export type InvoiceDirection =
  (typeof INVOICE_DIRECTION)[keyof typeof INVOICE_DIRECTION];
export const ALL_INVOICE_DIRECTIONS: readonly InvoiceDirection[] =
  Object.values(INVOICE_DIRECTION);

/** Narrow an arbitrary (already-trimmed) string to a valid InvoiceDirection. */
export function isInvoiceDirection(value: string): value is InvoiceDirection {
  return (ALL_INVOICE_DIRECTIONS as readonly string[]).includes(value);
}

// ─── Subtype (methodology §7.5) ──────────────────────────────────────────────

/**
 * Invoice subtype as reported by the Didox registry:
 *   - STANDARD   (Обычная)        — a normal invoice, posted as-is.
 *   - ADDITIONAL (Дополнительная) — a delta against an earlier invoice, posted
 *     to the current (ingestion) period as a NEW open position; the additional
 *     СФ carries the delta itself, so it posts exactly like a standard invoice.
 *   - CORRECTED  (Исправленная)   — a full replacement of an earlier invoice;
 *     on commit the original is reversed and the corrected version reposted,
 *     BOTH in the original's period, so that period nets to the corrected
 *     figures (§7.5, Filipp variant a).
 */
export const INVOICE_SUBTYPE = {
  STANDARD: 'standard',
  ADDITIONAL: 'additional',
  CORRECTED: 'corrected',
} as const;
export type InvoiceSubtype =
  (typeof INVOICE_SUBTYPE)[keyof typeof INVOICE_SUBTYPE];
export const ALL_INVOICE_SUBTYPES: readonly InvoiceSubtype[] =
  Object.values(INVOICE_SUBTYPE);

/** Narrow an arbitrary (already-trimmed) string to a valid InvoiceSubtype. */
export function isInvoiceSubtype(value: string): value is InvoiceSubtype {
  return (ALL_INVOICE_SUBTYPES as readonly string[]).includes(value);
}

// ─── VAT accounts (methodology §7.3) ─────────────────────────────────────────

/**
 * The two NSBU VAT accounts the invoice posting uses. On an incoming (buy)
 * invoice the VAT is recoverable input VAT → Дт 4410; on an outgoing (sell)
 * invoice it is output VAT owed → Кт 6410. The VAT leg is omitted entirely when
 * the invoice is 0 % / exempt. Both codes are present in the seeded 1С «УЗ»
 * chart (4410 «НДС по приобретенным ценностям», 6410 «Налог на добавленную
 * стоимость»).
 */
export const INVOICE_VAT_ACCOUNTS = {
  INPUT: '4410', // Дт — input (recoverable) VAT on purchases.
  OUTPUT: '6410', // Кт — output VAT on sales.
} as const;
export type InvoiceVatAccount =
  (typeof INVOICE_VAT_ACCOUNTS)[keyof typeof INVOICE_VAT_ACCOUNTS];
