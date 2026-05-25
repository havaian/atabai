/**
 * Safe JSON stringify that handles circular references and non-serializable values.
 *
 * Strips known problematic axios/http internals (agent, socket, _httpMessage,
 * req, res) which contain circular references and bloat logs to many KB.
 * Ported verbatim from the legacy logger so log output stays identical.
 */
export function safeStringify(obj: unknown, indent = 2): string {
  const seen = new WeakSet<object>();
  return JSON.stringify(
    obj,
    (key, value: unknown) => {
      if (
        key === 'agent' ||
        key === 'socket' ||
        key === '_httpMessage' ||
        key === 'req' ||
        key === 'res'
      ) {
        return '[Stripped]';
      }
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value as object)) return '[Circular]';
        seen.add(value as object);
      }
      if (typeof value === 'function') return '[Function]';
      return value;
    },
    indent,
  );
}
