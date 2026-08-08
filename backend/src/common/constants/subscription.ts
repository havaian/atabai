/**
 * Subscription tiers and per-tier monthly file processing limits.
 * Ported from backend/src/config/subscription.js - values preserved.
 */
export type SubscriptionType = 'basic' | 'premium' | 'enterprise';

export const FILE_PROCESSING_LIMITS: Record<SubscriptionType, number> = {
  basic: 3,
  premium: Number.POSITIVE_INFINITY,
  enterprise: Number.POSITIVE_INFINITY,
};

export function getFileLimit(subscriptionType: string | undefined): number {
  if (subscriptionType && subscriptionType in FILE_PROCESSING_LIMITS) {
    return FILE_PROCESSING_LIMITS[subscriptionType as SubscriptionType];
  }
  return FILE_PROCESSING_LIMITS.basic;
}
