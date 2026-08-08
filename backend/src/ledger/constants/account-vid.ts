/**
 * Account type (Вид) from the 1C "УЗ" chart of accounts export.
 *
 * Reference distribution (507-account NSBU chart): A=242, П=154, КА=32, КП=4, T=75.
 *
 * Sign handling is intrinsic to the account via this field - per architecture
 * doc §4.3, the legacy `isNegative` flag hand-set on form rows is retired and
 * replaced by Вид-derived sign. КА/КП are contra accounts that flip the natural
 * sign of their base type (an active contra reduces an active balance - e.g.
 * 0200 Амортизация ОС contra-reduces 0100 Основные средства).
 */
export const ACCOUNT_VID = {
  ACTIVE: 'А',          // Asset-side; debit-natured, positive presentation.
  PASSIVE: 'П',         // Liability/equity-side; credit-natured, positive presentation.
  CONTRA_ACTIVE: 'КА',  // Reduces an active balance (e.g. accumulated depreciation).
  CONTRA_PASSIVE: 'КП', // Reduces a passive balance (rare).
  TECHNICAL: 'Т',       // Technical / off-balance / clearing accounts.
} as const;

export type AccountVid = (typeof ACCOUNT_VID)[keyof typeof ACCOUNT_VID];

export const ALL_ACCOUNT_VIDS: readonly AccountVid[] = Object.values(ACCOUNT_VID);

export const isAccountVid = (value: unknown): value is AccountVid =>
  typeof value === 'string' && (ALL_ACCOUNT_VIDS as readonly string[]).includes(value);

/**
 * "Natural" side of an account - which column its closing balance lives on
 * in the trial balance.
 *
 * For an Active account, a positive balance sits in the Debit column.
 * For a Passive account, a positive balance sits in the Credit column.
 * Contras have the *opposite* natural side from their base type: КА is
 * credit-natural (reduces an active base), КП is debit-natural.
 * Technical accounts are sign-neutral by convention here - the styler must
 * still respect what the source data carries.
 */
export type AccountSide = 'debit' | 'credit' | 'neutral';

export const naturalSide = (vid: AccountVid): AccountSide => {
  switch (vid) {
    case 'А':
      return 'debit';
    case 'П':
      return 'credit';
    case 'КА':
      return 'credit';
    case 'КП':
      return 'debit';
    case 'Т':
      return 'neutral';
  }
};

/**
 * Whether this Вид reduces (rather than adds to) a parent presentation grouping.
 * Contra accounts always do; everything else does not. Replaces the per-row
 * `isNegative` flag the legacy form-row mappings carry.
 */
export const reducesParent = (vid: AccountVid): boolean =>
  vid === 'КА' || vid === 'КП';
