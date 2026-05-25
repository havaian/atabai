/**
 * Allowed IFRS report template types — kept in lockstep with the frontend
 * `useTemplatesStore.availableTemplates` keys so the file pipeline stays in sync.
 */
export const TEMPLATE_TYPES = [
  'balanceSheet',
  'cashFlow',
  'profitLoss',
  'profitLossForm2',
  'equity',
] as const;

export type TemplateType = (typeof TEMPLATE_TYPES)[number];

export function isTemplateType(value: unknown): value is TemplateType {
  return typeof value === 'string' && (TEMPLATE_TYPES as readonly string[]).includes(value);
}
