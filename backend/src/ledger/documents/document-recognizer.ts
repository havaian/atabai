/**
 * Document-reference recognizer (methodology §7.2).
 *
 * Extracts candidate document number(s) and date(s) from a payment-purpose
 * string so the bank preview can suggest a matching contract/invoice. Filipp
 * left the mechanism open ("через код или это уже будет делать ИИ"); this is
 * the CODE implementation, deliberately isolated behind one entry point
 * (`recognizeDocumentReferences`) so an AI recognizer can replace it later
 * without touching callers.
 *
 * Pure module: regex/string only, no I/O, no DB. It does NOT decide which
 * document a payment settles - it only surfaces candidates from the text. The
 * actual match against a counterparty's stored documents (and the final pick)
 * happens at the call site / on the preview screen, where Filipp's rule holds:
 * if nothing matches, the accountant creates or picks one; a payment is never
 * posted without a document.
 */

export interface RecognizedDocumentReference {
  /** Raw number token as found in the text (e.g. "123", "АА-0042"). */
  number: string;
  /** Parsed date if one sits near the number, else null. */
  date: Date | null;
  /** The surrounding phrase the match came from - for UI highlighting/debug. */
  context: string;
}

export interface RecognizeOptions {
  /**
   * Hint at what to look for. Both are scanned regardless; the hint only
   * orders/labels results. Defaults to scanning for both contract and invoice
   * cues.
   */
  prefer?: 'contract' | 'invoice' | 'both';
}

// Keywords that precede a document number in Uzbek/Russian payment purposes.
// Contract cues: договор, контракт, дог., shartnoma. Invoice cues: счёт,
// счет-фактура, инвойс, фактура, схвф (счёт-фактура virtual), hisob-faktura.
// Matching is case-insensitive; the number follows within a few chars,
// optionally after №/N/#/no.
const DOC_NUMBER_PATTERNS: ReadonlyArray<{ kind: 'contract' | 'invoice'; re: RegExp }> = [
  {
    kind: 'contract',
    re: /(?:^|[^a-zа-я])(?:догов\p{L}*|контракт\p{L}*|дог\.|shartnoma\p{L}*)\s*(?:№|n|#|no\.?|nomer)?\s*([a-zа-я0-9][a-zа-я0-9._/\-]{0,40})/giu,
  },
  {
    kind: 'invoice',
    re: /(?:^|[^a-zа-я])(?:сч[её]т\p{L}*[-\s]*фактур\p{L}*|сч[её]т\p{L}*|инвойс\p{L}*|фактур\p{L}*|invoice|hisob[-\s]*faktura|schyot\p{L}*)\s*(?:№|n|#|no\.?|nomer)?\s*([a-zа-я0-9][a-zа-я0-9._/\-]{0,40})/giu,
  },
];

// Dates like 01.02.2026, 1/2/26, 2026-02-01, 01.02.26. Day-first and
// ISO forms both appear in local statements.
const DATE_PATTERNS: ReadonlyArray<RegExp> = [
  /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g, // ISO  2026-02-01
  /\b(\d{1,2})[.\/](\d{1,2})[.\/](\d{2,4})\b/g, // d.m.y / d/m/y
];

/** Parse a date match into a Date, or null if the parts aren't a valid date. */
function buildDate(parts: { y: number; m: number; d: number }): Date | null {
  let { y, m, d } = parts;
  if (y < 100) y += 2000; // 26 -> 2026
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  // Construct as UTC midnight to avoid timezone drift; verify the components
  // round-trip (rejects 31.02 etc).
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
    return null;
  }
  return dt;
}

/** Find the date nearest (by string distance) to a number match index. */
function findNearestDate(text: string, anchorIndex: number): Date | null {
  let best: { date: Date; dist: number } | null = null;
  for (const re of DATE_PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      let parsed: Date | null;
      if (m[1].length === 4) {
        parsed = buildDate({ y: +m[1], m: +m[2], d: +m[3] });
      } else {
        parsed = buildDate({ d: +m[1], m: +m[2], y: +m[3] });
      }
      if (!parsed) continue;
      const dist = Math.abs(m.index - anchorIndex);
      if (!best || dist < best.dist) best = { date: parsed, dist };
    }
  }
  // Only treat a date as "belonging" to the number if it's reasonably close
  // (within ~40 chars) - otherwise it's probably an unrelated date in the text.
  return best && best.dist <= 40 ? best.date : null;
}

/**
 * Recognize document references in a payment-purpose string.
 *
 * Returns one entry per number token found, with a nearby date if present,
 * grouped by kind. Empty array when nothing recognizable is in the text - the
 * caller then falls back to manual create/pick (Filipp's §7.2 rule).
 */
export function recognizeDocumentReferences(
  purpose: string | null | undefined,
  options: RecognizeOptions = {},
): { contract: RecognizedDocumentReference[]; invoice: RecognizedDocumentReference[] } {
  const result = { contract: [] as RecognizedDocumentReference[], invoice: [] as RecognizedDocumentReference[] };
  if (!purpose) return result;
  const text = purpose;

  for (const { kind, re } of DOC_NUMBER_PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const number = (m[1] ?? '').trim().replace(/[.\-/]+$/, ''); // strip trailing separators
      // A real document number contains at least one digit. This rejects a
      // keyword's own trailing letters and stray words (e.g. "date") that the
      // pattern might otherwise pick up.
      if (!number || !/\d/.test(number)) continue;
      const ctxStart = Math.max(0, m.index - 5);
      const ctxEnd = Math.min(text.length, m.index + m[0].length + 5);
      result[kind].push({
        number,
        date: findNearestDate(text, m.index),
        context: text.slice(ctxStart, ctxEnd).trim(),
      });
    }
  }

  // De-duplicate by number within each kind (same number cited twice).
  const dedupe = (arr: RecognizedDocumentReference[]) => {
    const seen = new Set<string>();
    return arr.filter((r) => {
      const key = r.number.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };
  result.contract = dedupe(result.contract);
  result.invoice = dedupe(result.invoice);

  return result;
}

/** Normalize a document number for equality matching (case/separator-insensitive). */
export function normalizeDocumentNumber(raw: string): string {
  return raw.toLowerCase().replace(/[\s.\-/]+/g, '');
}
