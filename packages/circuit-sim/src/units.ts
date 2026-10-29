/**
 * Units and display formatting.
 *
 * All numeric quantities inside the engine are stored in coherent SI base
 * units (volts, amperes, ohms, watts). Formatting is a presentation concern
 * and never feeds back into calculations.
 */

export type Unit = "V" | "A" | "Ω" | "W" | "S";

export interface Quantity {
  readonly value: number;
  readonly unit: Unit;
}

const PREFIXES: ReadonlyArray<{ exponent: number; symbol: string }> = [
  { exponent: 9, symbol: "G" },
  { exponent: 6, symbol: "M" },
  { exponent: 3, symbol: "k" },
  { exponent: 0, symbol: "" },
  { exponent: -3, symbol: "m" },
  { exponent: -6, symbol: "µ" },
  { exponent: -9, symbol: "n" },
  { exponent: -12, symbol: "p" },
];

/** Choose an engineering prefix so the mantissa lies in [1, 1000). */
export function engineeringPrefix(value: number): { exponent: number; symbol: string } {
  const magnitude = Math.abs(value);
  if (magnitude === 0 || !Number.isFinite(magnitude)) return { exponent: 0, symbol: "" };
  for (const prefix of PREFIXES) {
    if (magnitude >= 10 ** prefix.exponent * (1 - 1e-12)) return prefix;
  }
  return PREFIXES[PREFIXES.length - 1]!;
}

export interface FormatOptions {
  /** Significant digits to display (default 4). */
  readonly significantDigits?: number;
  /** Insert a space between number and unit (default true). */
  readonly space?: boolean;
}

/** Format a value with an engineering prefix, e.g. 0.0472 A → "47.20 mA". */
export function formatQuantity(value: number, unit: Unit, options: FormatOptions = {}): string {
  const { significantDigits = 4, space = true } = options;
  if (Number.isNaN(value)) return `— ${unit}`;
  if (!Number.isFinite(value)) return `${value > 0 ? "+" : "−"}∞ ${unit}`;
  const prefix = engineeringPrefix(value);
  let mantissa = value / 10 ** prefix.exponent;
  // Rounding can push the mantissa to 1000 (e.g. 999.96 → 1000); promote the prefix.
  const integerDigits = Math.max(1, Math.floor(Math.log10(Math.abs(mantissa) || 1)) + 1);
  let decimals = Math.max(0, significantDigits - integerDigits);
  let text = mantissa.toFixed(decimals);
  if (Math.abs(Number(text)) >= 1000 && prefix.exponent < 9) {
    const bigger = PREFIXES[PREFIXES.indexOf(prefix) - 1]!;
    mantissa = value / 10 ** bigger.exponent;
    decimals = Math.max(0, significantDigits - 1);
    text = mantissa.toFixed(decimals);
    return `${text}${space ? " " : ""}${bigger.symbol}${unit}`;
  }
  return `${text}${space ? " " : ""}${prefix.symbol}${unit}`;
}

/** Relative comparison helper used by tests and challenge evaluation. */
export function withinTolerance(actual: number, expected: number, relativeTolerance: number, absoluteFloor = 1e-12): boolean {
  if (!Number.isFinite(actual) || !Number.isFinite(expected)) return false;
  return Math.abs(actual - expected) <= Math.max(Math.abs(expected) * relativeTolerance, absoluteFloor);
}
