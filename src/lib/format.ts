import type { BenchPart } from "@/domain/bench/types";

export function formatOhms(value: number): string {
  if (value >= 1e6) return `${Number((value / 1e6).toPrecision(3))} MΩ`;
  if (value >= 1e3) return `${Number((value / 1e3).toPrecision(3))} kΩ`;
  return `${Number(value.toPrecision(3))} Ω`;
}

export function partLabel(part: BenchPart): string {
  switch (part.kind) {
    case "resistor":
      return `${part.label} · ${formatOhms(part.resistance)}`;
    case "switch":
      return `${part.label} · ${part.closed ? "closed" : "open"}`;
    case "jumper":
      return part.installed ? part.label : `${part.label} · removed`;
  }
}

export const METER_MODE_LABELS = {
  off: "OFF",
  "dc-voltage": "V⎓",
  "dc-current": "A⎓",
  resistance: "Ω",
  continuity: "•))) Continuity",
} as const;

export const METER_MODE_NAMES = {
  off: "Off",
  "dc-voltage": "DC voltage",
  "dc-current": "DC current",
  resistance: "Resistance",
  continuity: "Continuity",
} as const;
