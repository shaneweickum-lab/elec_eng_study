import type { Circuit, Component } from "../schema";
import { terminalsOf } from "../schema";
import { solveDC, type DCResult } from "../dc";
import { buildSupernodes, DisjointSet, isLinkKind, type CoilStates } from "../topology";
import { engineeringPrefix, type Unit } from "../units";

/**
 * Virtual digital multimeter.
 *
 * The meter is modelled as a circuit element inserted between its probes,
 * so every reading comes from the same solver as the rest of the circuit:
 *   • DC voltage — 10 MΩ input impedance across the probes.
 *   • DC current — 0.1 Ω shunt (burden) between the probes; it must be placed
 *     in series with the circuit (across a break) to read branch current.
 *   • Resistance — a small test current is injected into a de-energized
 *     network; on an energized network the reading is invalid.
 */

export type MultimeterMode = "off" | "dc-voltage" | "dc-current" | "resistance" | "continuity";

export interface MultimeterSpec {
  readonly voltageInputResistance: number;
  readonly currentShuntResistance: number;
  readonly currentFuseRating: number;
  readonly voltageMaxReading: number;
  readonly currentMaxReading: number;
  readonly resistanceMaxReading: number;
  readonly ohmmeterTestCurrent: number;
  readonly continuityThreshold: number;
  /** Display counts (6000-count display shows up to 5999). */
  readonly displayCounts: number;
}

export const DEFAULT_MULTIMETER_SPEC: MultimeterSpec = {
  voltageInputResistance: 10e6,
  currentShuntResistance: 0.1,
  currentFuseRating: 10,
  voltageMaxReading: 600,
  currentMaxReading: 10,
  resistanceMaxReading: 40e6,
  ohmmeterTestCurrent: 1e-3,
  continuityThreshold: 50,
  displayCounts: 6000,
};

export interface MultimeterConfig {
  readonly mode: MultimeterMode;
  /** Node touched by the red (V/Ω/A) probe. */
  readonly red: string | null;
  /** Node touched by the black (COM) probe. */
  readonly black: string | null;
  /** False once the current-input fuse has blown. */
  readonly fuseIntact?: boolean;
}

export type MeterHazardCode =
  | "ohmmeter-on-energized-circuit"
  | "ammeter-across-source"
  | "ammeter-in-parallel-with-load"
  | "ammeter-overcurrent";

export interface MeterHazard {
  readonly code: MeterHazardCode;
  /** "violation" breaks a safety rule; "technique" is a measurement-technique error. */
  readonly severity: "violation" | "technique";
  readonly message: string;
  readonly componentIds: readonly string[];
}

export type MeterStatus =
  | "off"
  | "ok"
  | "overload"
  | "incomplete"
  | "fuse-blown"
  | "invalid-energized"
  | "circuit-error";

export interface MultimeterReading {
  readonly mode: MultimeterMode;
  readonly status: MeterStatus;
  /** SI value (V, A or Ω) when a numeric reading exists. */
  readonly value: number | null;
  readonly unit: Unit | null;
  /** Text as shown on the meter display, e.g. "12.00", "OL". */
  readonly display: string;
  /** Unit text with prefix as shown on the display, e.g. "mA". */
  readonly displayUnit: string;
  readonly annunciators: readonly string[];
  readonly hazards: readonly MeterHazard[];
  readonly notes: readonly string[];
  /** True if this measurement would blow the current-input fuse. */
  readonly blowsFuse: boolean;
}

const METER_ID = "__meter__";

/** Format a value for an N-count auto-ranging display. */
export function formatMeterDisplay(value: number, unit: Unit, counts = 6000): { text: string; unitText: string } {
  const prefix = engineeringPrefix(value);
  let mantissa = value / 10 ** prefix.exponent;
  let symbol = prefix.symbol;
  const maxMantissa = counts / 10; // e.g. 600 for a 6000-count display
  if (Math.abs(mantissa) >= maxMantissa) {
    // e.g. 750 mV on a 6000-count meter is shown as 0.750 V
    mantissa /= 1000;
    symbol = { "p": "n", "n": "µ", "µ": "m", "m": "", "": "k", "k": "M", "M": "G" }[symbol] ?? symbol;
  }
  const magnitude = Math.abs(mantissa);
  const decimals = magnitude < maxMantissa / 100 ? 3 : magnitude < maxMantissa / 10 ? 2 : 1;
  return { text: mantissa.toFixed(decimals), unitText: `${symbol}${unit}` };
}

function reading(partial: Partial<MultimeterReading> & Pick<MultimeterReading, "mode" | "status" | "display">): MultimeterReading {
  return {
    value: null,
    unit: null,
    displayUnit: "",
    annunciators: [],
    hazards: [],
    notes: [],
    blowsFuse: false,
    ...partial,
  };
}

function withComponent(circuit: Circuit, component: Component): Circuit {
  return { ...circuit, components: [...circuit.components, component] };
}

/** Is any energy source present in the network(s) touched by the probes? */
function energizedSources(circuit: Circuit, nodes: readonly string[], coilStates: CoilStates): string[] {
  const supernodes = buildSupernodes(circuit, coilStates);
  const groups = new DisjointSet();
  for (const component of circuit.components) {
    if (isLinkKind(component)) continue;
    const [a, b] = terminalsOf(component);
    groups.union(supernodes.of(a), supernodes.of(b));
  }
  const touched = new Set(nodes.map((n) => groups.find(supernodes.of(n))));
  return circuit.components
    .filter((c) => {
      if (c.kind === "voltage-source" && c.voltage !== 0) return touched.has(groups.find(supernodes.of(c.positive)));
      if (c.kind === "current-source" && c.current !== 0) return touched.has(groups.find(supernodes.of(c.from)));
      return false;
    })
    .map((c) => c.id);
}

/** Parts whose two terminals sit exactly on the probe nodes (they would be bypassed by a shunt). */
function bypassedComponents(circuit: Circuit, red: string, black: string, coilStates: CoilStates): Component[] {
  const supernodes = buildSupernodes(circuit, coilStates);
  const r = supernodes.of(red);
  const b = supernodes.of(black);
  return circuit.components.filter((c) => {
    if (isLinkKind(c)) return false;
    const [x, y] = terminalsOf(c);
    const sx = supernodes.of(x);
    const sy = supernodes.of(y);
    return (sx === r && sy === b) || (sx === b && sy === r);
  });
}

function circuitError(mode: MultimeterMode, result: Exclude<DCResult, { status: "ok" }>): MultimeterReading {
  return reading({
    mode,
    status: "circuit-error",
    display: "Err",
    notes: result.issues.map((issue) => issue.message),
  });
}

export function measure(
  circuit: Circuit,
  config: MultimeterConfig,
  spec: MultimeterSpec = DEFAULT_MULTIMETER_SPEC,
  coilStates: CoilStates = {},
): MultimeterReading {
  const { mode, red, black } = config;
  if (mode === "off") return reading({ mode, status: "off", display: "" });

  if (mode === "dc-voltage") {
    if (red === null || black === null) {
      return reading({ mode, status: "incomplete", value: 0, unit: "V", display: "0.000", displayUnit: "V", annunciators: ["DC", "AUTO"], notes: ["Connect both probes to take a reading."] });
    }
    const result = solveDC(
      withComponent(circuit, { kind: "resistor", id: METER_ID, a: red, b: black, resistance: spec.voltageInputResistance }),
      { coilStates },
    );
    if (result.status !== "ok") return circuitError(mode, result);
    const value = result.nodeVoltages[red]! - result.nodeVoltages[black]!;
    if (Math.abs(value) > spec.voltageMaxReading) {
      return reading({ mode, status: "overload", unit: "V", display: "OL", displayUnit: "V", annunciators: ["DC"] });
    }
    const shown = formatMeterDisplay(value, "V", spec.displayCounts);
    return reading({ mode, status: "ok", value, unit: "V", display: shown.text, displayUnit: shown.unitText, annunciators: ["DC", "AUTO"] });
  }

  if (mode === "dc-current") {
    if (config.fuseIntact === false) {
      return reading({ mode, status: "fuse-blown", value: 0, unit: "A", display: "0.000", displayUnit: "A", annunciators: ["DC"], notes: ["The current-input fuse is open. The meter cannot measure current until the fuse is replaced."] });
    }
    if (red === null || black === null) {
      return reading({ mode, status: "incomplete", value: 0, unit: "A", display: "0.000", displayUnit: "A", annunciators: ["DC", "AUTO"], notes: ["Break the circuit and connect the meter in series to measure current."] });
    }
    const baseline = solveDC(circuit, { coilStates });
    const hazards: MeterHazard[] = [];
    const bypassed = bypassedComponents(circuit, red, black, coilStates);
    const bypassedSources = bypassed.filter((c) => c.kind === "voltage-source");
    const energized = baseline.status === "ok" && Math.abs(baseline.nodeVoltages[red]! - baseline.nodeVoltages[black]!) > 1e-6;
    if (bypassedSources.length > 0) {
      hazards.push({
        code: "ammeter-across-source",
        severity: "violation",
        message: "The meter is in current mode directly across a voltage source. An ammeter has very low resistance, so this creates a short circuit.",
        componentIds: bypassedSources.map((c) => c.id),
      });
    } else if (bypassed.length > 0 && energized) {
      hazards.push({
        code: "ammeter-in-parallel-with-load",
        severity: "technique",
        message: "The meter is in current mode in parallel with a load, so it bypasses that load instead of measuring its current. Current must be measured in series.",
        componentIds: bypassed.map((c) => c.id),
      });
    }
    const result = solveDC(
      withComponent(circuit, { kind: "resistor", id: METER_ID, a: red, b: black, resistance: spec.currentShuntResistance }),
      { coilStates },
    );
    if (result.status !== "ok") return circuitError(mode, result);
    const value = result.componentCurrents[METER_ID]!;
    if (Math.abs(value) > spec.currentFuseRating) {
      hazards.push({
        code: "ammeter-overcurrent",
        severity: "violation",
        message: `Current through the meter exceeds its ${spec.currentFuseRating} A fuse rating.`,
        componentIds: [],
      });
      return reading({ mode, status: "fuse-blown", value: 0, unit: "A", display: "0.000", displayUnit: "A", annunciators: ["DC"], hazards, blowsFuse: true, notes: ["The current-input fuse has blown."] });
    }
    const supplyLimited = Object.entries(result.sourceModes).filter(([, m]) => m === "constant-current").map(([id]) => id);
    const notes = supplyLimited.length > 0 ? [`Source ${supplyLimited.join(", ")} is in current-limit (CC) mode.`] : [];
    const shown = formatMeterDisplay(value, "A", spec.displayCounts);
    return reading({ mode, status: "ok", value, unit: "A", display: shown.text, displayUnit: shown.unitText, annunciators: ["DC", "AUTO"], hazards, notes });
  }

  // Resistance and continuity share the ohmmeter model.
  const annunciators = mode === "continuity" ? ["Ω", "•))"] : ["Ω", "AUTO"];
  if (red === null || black === null) {
    return reading({ mode, status: "incomplete", unit: "Ω", display: "OL", displayUnit: "Ω", annunciators, notes: ["Connect both probes to take a reading."] });
  }
  const live = energizedSources(circuit, [red, black], coilStates);
  if (live.length > 0) {
    return reading({
      mode,
      status: "invalid-energized",
      unit: "Ω",
      display: "----",
      displayUnit: "Ω",
      annunciators,
      hazards: [
        {
          code: "ohmmeter-on-energized-circuit",
          severity: "violation",
          message: "Resistance was measured on an energized circuit. Ohmmeter readings are only valid on isolated, de-energized circuits, and the meter can be damaged.",
          componentIds: live,
        },
      ],
      notes: ["De-energize the circuit and verify the absence of voltage before measuring resistance."],
    });
  }
  // All sources in the probed network are zero; remove every source so only passive parts remain.
  const passive: Circuit = {
    ...circuit,
    components: circuit.components.filter((c) => c.kind !== "voltage-source" && c.kind !== "current-source"),
  };
  const supernodes = buildSupernodes(passive, coilStates);
  const groups = new DisjointSet();
  for (const component of passive.components) {
    if (isLinkKind(component)) continue;
    const [a, b] = terminalsOf(component);
    groups.union(supernodes.of(a), supernodes.of(b));
  }
  const connected = groups.find(supernodes.of(red)) === groups.find(supernodes.of(black));
  if (!connected) {
    return reading({ mode, status: "overload", unit: "Ω", display: "OL", displayUnit: "MΩ", annunciators, notes: ["No conductive path between the probes (open circuit)."] });
  }
  const result = solveDC(
    withComponent(passive, { kind: "current-source", id: METER_ID, from: black, to: red, current: spec.ohmmeterTestCurrent }),
    { coilStates },
  );
  if (result.status !== "ok") return circuitError(mode, result);
  const value = (result.nodeVoltages[red]! - result.nodeVoltages[black]!) / spec.ohmmeterTestCurrent;
  if (value > spec.resistanceMaxReading) {
    return reading({ mode, status: "overload", unit: "Ω", display: "OL", displayUnit: "MΩ", annunciators });
  }
  const shown = formatMeterDisplay(Math.abs(value) < 1e-9 ? 0 : value, "Ω", spec.displayCounts);
  const beep = mode === "continuity" && value < spec.continuityThreshold;
  return reading({
    mode,
    status: "ok",
    value,
    unit: "Ω",
    display: shown.text,
    displayUnit: shown.unitText,
    annunciators: beep ? [...annunciators, "BEEP"] : annunciators,
  });
}
