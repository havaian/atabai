import { Types } from 'mongoose';

/**
 * Self-contained decimal arithmetic over Mongoose's `Types.Decimal128`.
 *
 * Why not a library: the operations we actually need on the ledger spine
 * today are sum, subtract, compare, and `toString` — all expressible by
 * parsing into (BigInt mantissa, integer scale) and re-formatting. Pulling
 * in `decimal.js` (~100KB) would be premature.
 *
 * If/when adjustments + deferred-tax derivation arrive and we need
 * multiplication / division, swap to a real library — the surface here is
 * narrow enough that the rename is the only call-site change.
 *
 * Precision discipline: every input passes through `parseDec` which is
 * exact. No `Number` coercion anywhere in this file. JS double is fine for
 * counting transactions; never fine for representing them.
 */

export type Decimalish = Types.Decimal128 | string | null | undefined;

interface ParsedDec {
  mantissa: bigint;
  scale: number;
}

export function toDecimalString(value: Decimalish): string {
  if (value === null || value === undefined) return '0';
  if (typeof value === 'string') return value.trim() || '0';
  return value.toString();
}

export function toDecimal128(value: Decimalish): Types.Decimal128 {
  return Types.Decimal128.fromString(toDecimalString(value));
}

export function addDecimals(...values: Decimalish[]): string {
  if (values.length === 0) return '0';
  const parsed = values.map((v) => parseDec(toDecimalString(v)));
  const scale = Math.max(0, ...parsed.map((p) => p.scale));
  let acc = 0n;
  for (const p of parsed) {
    acc += p.mantissa * 10n ** BigInt(scale - p.scale);
  }
  return formatDec(acc, scale);
}

export function subtractDecimals(a: Decimalish, b: Decimalish): string {
  const pa = parseDec(toDecimalString(a));
  const pb = parseDec(toDecimalString(b));
  const scale = Math.max(pa.scale, pb.scale);
  const ma = pa.mantissa * 10n ** BigInt(scale - pa.scale);
  const mb = pb.mantissa * 10n ** BigInt(scale - pb.scale);
  return formatDec(ma - mb, scale);
}

export function negateDecimal(value: Decimalish): string {
  const p = parseDec(toDecimalString(value));
  return formatDec(-p.mantissa, p.scale);
}

/** -1 if a < b, 0 if equal, +1 if a > b. */
export function compareDecimals(a: Decimalish, b: Decimalish): -1 | 0 | 1 {
  const pa = parseDec(toDecimalString(a));
  const pb = parseDec(toDecimalString(b));
  const scale = Math.max(pa.scale, pb.scale);
  const ma = pa.mantissa * 10n ** BigInt(scale - pa.scale);
  const mb = pb.mantissa * 10n ** BigInt(scale - pb.scale);
  if (ma > mb) return 1;
  if (ma < mb) return -1;
  return 0;
}

export function isZero(value: Decimalish): boolean {
  return compareDecimals(value, '0') === 0;
}

export function isPositive(value: Decimalish): boolean {
  return compareDecimals(value, '0') > 0;
}

export function isNegative(value: Decimalish): boolean {
  return compareDecimals(value, '0') < 0;
}

/**
 * Net a paired-side total into a single-side representation per 1C
 * convention: at most one of (debit, credit) carries the closing balance.
 *
 * Given gross sums `grossDebit` and `grossCredit` (e.g. opening + period
 * on each side), returns `(closingDebit, closingCredit)` where one side
 * is the absolute net difference and the other is zero. Caller decides
 * which side is "natural" for the account by interpreting the result —
 * the function itself is vid-agnostic.
 *
 * Result invariant: `closingDebit > 0` XOR `closingCredit > 0` (or both 0).
 */
export function netSides(
  grossDebit: Decimalish,
  grossCredit: Decimalish,
): { closingDebit: string; closingCredit: string } {
  const cmp = compareDecimals(grossDebit, grossCredit);
  if (cmp > 0) {
    return {
      closingDebit: subtractDecimals(grossDebit, grossCredit),
      closingCredit: '0',
    };
  }
  if (cmp < 0) {
    return {
      closingDebit: '0',
      closingCredit: subtractDecimals(grossCredit, grossDebit),
    };
  }
  return { closingDebit: '0', closingCredit: '0' };
}

// ─── Internal ────────────────────────────────────────────────────────────────

function parseDec(s: string): ParsedDec {
  if (!s || s === 'NaN') return { mantissa: 0n, scale: 0 };
  let str = s.trim();
  if (str === '') return { mantissa: 0n, scale: 0 };
  let sign = 1n;
  if (str.startsWith('-')) {
    sign = -1n;
    str = str.slice(1);
  } else if (str.startsWith('+')) {
    str = str.slice(1);
  }
  const dot = str.indexOf('.');
  if (dot === -1) {
    return { mantissa: sign * BigInt(str || '0'), scale: 0 };
  }
  const intPart = str.slice(0, dot) || '0';
  const fracPart = str.slice(dot + 1);
  return {
    mantissa: sign * BigInt(intPart + fracPart),
    scale: fracPart.length,
  };
}

function formatDec(mantissa: bigint, scale: number): string {
  const negative = mantissa < 0n;
  let s = (negative ? -mantissa : mantissa).toString();
  if (scale === 0) return negative ? `-${s}` : s;
  if (s.length <= scale) s = s.padStart(scale + 1, '0');
  const intPart = s.slice(0, s.length - scale);
  const fracPart = s.slice(s.length - scale).replace(/0+$/, '');
  const out = fracPart ? `${intPart}.${fracPart}` : intPart;
  return negative ? `-${out}` : out;
}
