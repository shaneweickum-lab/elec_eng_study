const PREFIX: Record<string, number> = { p: 1e-12, n: 1e-9, u: 1e-6, "µ": 1e-6, m: 1e-3, k: 1e3, K: 1e3, M: 1e6, G: 1e9 };

/**
 * Parse a number with an optional engineering prefix and unit, e.g.
 * "4.7k", "4.7 kΩ", "50mA", "0.05", "2,200". Returns SI value or null.
 */
export function parseEngineering(input: string): number | null {
  const text = input.trim().replace(/,/g, "").replace(/\s+/g, "");
  const match = /^([-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?)([pnuµmkKMG]?)(?:Ω|ohms?|V|A|a|v)?$/i.exec(text);
  if (!match) return null;
  const value = Number(match[1]);
  const prefix = match[2] ?? "";
  // "m" vs "M" is case-sensitive; the /i flag only applies to the unit part, so re-read the raw prefix.
  const raw = text.slice(match[1]!.length, match[1]!.length + prefix.length);
  const factor = raw ? PREFIX[raw] : 1;
  if (factor === undefined || !Number.isFinite(value)) return null;
  return value * factor;
}
