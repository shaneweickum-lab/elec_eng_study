import {
  DEFAULT_MULTIMETER_SPEC,
  buildSupernodes,
  measure,
  solveDC,
  type Circuit,
  type Component,
  type DCResult,
  type MultimeterReading,
} from "@iea/circuit-sim";
import type { BenchAction, BenchState, LoggedReading, SafetyEvent } from "./types";

/** Translate the physical bench into a circuit definition. Posts are nodes. */
export function toCircuit(state: BenchState): Circuit {
  const components: Component[] = [];
  const { supply } = state;
  if (supply.outputOn) {
    components.push({
      kind: "voltage-source",
      id: supply.id,
      positive: supply.positivePost,
      negative: supply.negativePost,
      voltage: supply.voltage,
      currentLimit: supply.currentLimit,
    });
  }
  for (const part of state.parts) {
    const faultedOpen = state.fault?.kind === "open" && state.fault.partId === part.id;
    if (faultedOpen) continue; // an open part conducts nothing, however it looks
    switch (part.kind) {
      case "resistor":
        components.push({ kind: "resistor", id: part.id, a: part.a, b: part.b, resistance: part.resistance });
        break;
      case "switch":
        components.push({ kind: "switch", id: part.id, a: part.a, b: part.b, closed: part.closed });
        break;
      case "jumper":
        if (part.installed) components.push({ kind: "wire", id: part.id, a: part.a, b: part.b });
        break;
    }
  }
  return { schemaVersion: 1, id: "training-bench", ground: supply.negativePost, components };
}

/** Ideal operating point (no instrument loading) — the reference for evaluation. */
export function solveBench(state: BenchState): DCResult {
  return solveDC(toCircuit(state));
}

export function readMeter(state: BenchState): MultimeterReading {
  return measure(toCircuit(state), {
    mode: state.meter.mode,
    red: state.meter.red,
    black: state.meter.black,
    fuseIntact: state.meter.fuseIntact,
  });
}

const METER_ELEMENT = "__meter__";

/** The circuit as it physically exists, including the meter when it is connected. */
export function physicalCircuit(state: BenchState): Circuit {
  const base = toCircuit(state);
  const { mode, red, black, fuseIntact } = state.meter;
  if (red === null || black === null) return base;
  if (mode === "dc-voltage") {
    return { ...base, components: [...base.components, { kind: "resistor", id: METER_ELEMENT, a: red, b: black, resistance: DEFAULT_MULTIMETER_SPEC.voltageInputResistance }] };
  }
  if (mode === "dc-current" && fuseIntact) {
    return { ...base, components: [...base.components, { kind: "resistor", id: METER_ELEMENT, a: red, b: black, resistance: DEFAULT_MULTIMETER_SPEC.currentShuntResistance }] };
  }
  return base;
}

export function solvePhysical(state: BenchState): DCResult {
  return solveDC(physicalCircuit(state));
}

/** Which parts does a meter connection correspond to? Used to validate logged measurements. */
export function describeConnection(state: BenchState): { acrossParts: string[]; seriesParts: string[] } {
  const { red, black, mode } = state.meter;
  if (red === null || black === null || mode === "off") return { acrossParts: [], seriesParts: [] };
  const circuit = toCircuit(state);
  const nodes = buildSupernodes(circuit);
  const r = nodes.of(red);
  const b = nodes.of(black);
  const acrossParts = state.parts
    .filter((p) => {
      const pa = nodes.of(p.a);
      const pb = nodes.of(p.b);
      return pa !== pb && ((pa === r && pb === b) || (pa === b && pb === r));
    })
    .map((p) => p.id);

  const seriesParts: string[] = [];
  if (mode === "dc-current" && state.meter.fuseIntact) {
    const withMeter = solveDC(physicalCircuit(state));
    if (withMeter.status === "ok") {
      const meterCurrent = withMeter.componentCurrents[METER_ELEMENT];
      if (meterCurrent != null && Math.abs(meterCurrent) > 1e-9) {
        for (const part of [...state.parts, { id: state.supply.id }]) {
          const current = withMeter.componentCurrents[part.id];
          if (current != null && Math.abs(Math.abs(current) - Math.abs(meterCurrent)) <= 1e-6 * Math.abs(meterCurrent)) {
            seriesParts.push(part.id);
          }
        }
      }
    }
  }
  return { acrossParts, seriesParts };
}

export function makeLoggedReading(state: BenchState, reading: MultimeterReading, id: string, t: number): LoggedReading {
  const { acrossParts, seriesParts } = describeConnection(state);
  return {
    id,
    t,
    mode: state.meter.mode,
    red: state.meter.red,
    black: state.meter.black,
    status: reading.status,
    value: reading.value,
    unit: reading.unit,
    display: reading.display,
    displayUnit: reading.displayUnit,
    revision: state.revision,
    hazardCodes: reading.hazards.map((h) => h.code),
    acrossParts,
    seriesParts,
  };
}

export interface ActionOutcome {
  readonly state: BenchState;
  readonly events: SafetyEvent[];
  /** Human-readable reason when an action was rejected. */
  readonly rejected?: string;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Apply one learner action. Physical changes to the circuit while the supply
 * output is on are permitted (so they can be assessed) but recorded as
 * safety violations: wiring and component changes require de-energizing first.
 */
export function applyBenchAction(state: BenchState, action: BenchAction, t: number): ActionOutcome {
  const events: SafetyEvent[] = [];
  const energized = state.supply.outputOn;
  const bump = (next: Omit<BenchState, "revision">): BenchState => ({ ...next, revision: state.revision + 1 });
  const flagLiveWork = (what: string) => {
    if (energized) {
      events.push({
        code: "component-change-energized",
        severity: "violation",
        message: `${what} while the supply output was ON. Turn the output off (de-energize) before changing components or wiring.`,
        t,
      });
    }
  };

  switch (action.type) {
    case "set-supply-voltage": {
      if (!state.supply.voltageEditable) return { state, events, rejected: "The supply voltage is fixed for this exercise." };
      const value = clamp(Math.round(action.value * 100) / 100, 0, state.supply.maxVoltage);
      return { state: bump({ ...state, supply: { ...state.supply, voltage: value } }), events };
    }
    case "set-current-limit": {
      const value = clamp(Math.round(action.value * 1000) / 1000, 0.001, 5);
      return { state: bump({ ...state, supply: { ...state.supply, currentLimit: value } }), events };
    }
    case "set-output":
      return { state: bump({ ...state, supply: { ...state.supply, outputOn: action.on } }), events };
    case "set-resistance": {
      const part = state.parts.find((p) => p.id === action.partId);
      if (!part || part.kind !== "resistor") return { state, events, rejected: "No such resistor." };
      if (!part.editable) return { state, events, rejected: `${part.label} is fixed for this exercise.` };
      if (!(action.value >= 1 && action.value <= 10e6)) return { state, events, rejected: "Resistance must be between 1 Ω and 10 MΩ." };
      flagLiveWork(`${part.label} was replaced`);
      const parts = state.parts.map((p) => (p.id === part.id ? { ...part, resistance: Number(action.value.toPrecision(4)) } : p));
      return { state: bump({ ...state, parts }), events };
    }
    case "set-switch": {
      const parts = state.parts.map((p) => (p.id === action.partId && p.kind === "switch" ? { ...p, closed: action.closed } : p));
      return { state: bump({ ...state, parts }), events };
    }
    case "set-jumper": {
      const part = state.parts.find((p) => p.id === action.partId);
      if (!part || part.kind !== "jumper") return { state, events, rejected: "No such jumper." };
      flagLiveWork(`Jumper ${part.label} was ${action.installed ? "installed" : "removed"}`);
      const parts = state.parts.map((p) => (p.id === part.id ? { ...part, installed: action.installed } : p));
      return { state: bump({ ...state, parts }), events };
    }
    case "set-meter-mode":
      return { state: { ...state, meter: { ...state.meter, mode: action.mode } }, events };
    case "place-probe":
      return {
        state: { ...state, meter: { ...state.meter, [action.probe]: action.postId } },
        events,
      };
    case "replace-fuse":
      return { state: { ...state, meter: { ...state.meter, fuseIntact: true } }, events };
  }
}

/**
 * After any change, evaluate the meter connection for hazards. Only hazards
 * that were not already active are reported, so holding a bad connection
 * does not produce repeated events.
 */
export function meterHazardEvents(
  reading: MultimeterReading,
  previouslyActive: ReadonlySet<string>,
  t: number,
): { events: SafetyEvent[]; active: Set<string> } {
  const active = new Set(reading.hazards.map((h) => h.code));
  const events = reading.hazards
    .filter((h) => !previouslyActive.has(h.code))
    .map((h) => ({ code: h.code, severity: h.severity, message: h.message, t }));
  return { events, active };
}
