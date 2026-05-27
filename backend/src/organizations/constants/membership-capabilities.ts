/**
 * Capability seam for org membership. Grows over time as the bank engine and
 * IFRS overlay land — see architecture doc §7.6 / §8 for the planned axes.
 *
 * The membership schema stores capabilities as a plain string[] (no enum) so a
 * new capability can ship without a migration. Service-layer code that gates
 * on a capability MUST reference one of the constants in this file, never a
 * literal — that keeps grep-discoverability and lets the type system flag
 * typos at the call site.
 */
export const MEMBERSHIP_CAPABILITIES = {
  // In-house bookkeeper domain — operating on the immutable NSBU base.
  NSBU_BASE_READ: 'nsbu.base.read',
  NSBU_BASE_WRITE: 'nsbu.base.write',

  // External IFRS specialist domain — the adjustments / deferred-tax / notes overlay.
  IFRS_OVERLAY_READ: 'ifrs.overlay.read',
  IFRS_OVERLAY_WRITE: 'ifrs.overlay.write',
} as const;

export type MembershipCapability =
  (typeof MEMBERSHIP_CAPABILITIES)[keyof typeof MEMBERSHIP_CAPABILITIES];

export const ALL_MEMBERSHIP_CAPABILITIES: readonly MembershipCapability[] =
  Object.values(MEMBERSHIP_CAPABILITIES);

export const isMembershipCapability = (value: unknown): value is MembershipCapability =>
  typeof value === 'string' && (ALL_MEMBERSHIP_CAPABILITIES as readonly string[]).includes(value);
