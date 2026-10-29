import { createRng, e12Value } from "@/lib/random";
import { validateLayout } from "./board";
import type { BenchFault, BenchPart, BenchState, BenchSupply } from "./types";

/**
 * Seeded scenario generators. The same (generator, seed) always yields the
 * same bench, so any attempt can be reproduced from its stored seed.
 */

export type ScenarioGeneratorId = "single-resistor" | "target-current" | "series-three" | "parallel-branches" | "series-open-fault";

export interface Scenario {
  readonly generator: ScenarioGeneratorId | WorkshopPresetId;
  readonly seed: number;
  readonly state: BenchState;
  /** Scenario facts referenced by challenge tasks (e.g. a target current). */
  readonly facts: Readonly<Record<string, number>>;
}

const R = (id: string, a: string, b: string, resistance: number, editable = false): BenchPart => ({ kind: "resistor", id, label: id, a, b, resistance, editable });
const J = (id: string, a: string, b: string): BenchPart => ({ kind: "jumper", id, label: id, a, b, installed: true });
const SW = (id: string, a: string, b: string, closed = true): BenchPart => ({ kind: "switch", id, label: id, a, b, closed });

function supply(partial: Partial<BenchSupply> & Pick<BenchSupply, "positivePost" | "negativePost" | "voltage">): BenchSupply {
  return {
    id: "PS1",
    currentLimit: 1,
    outputOn: false,
    voltageEditable: true,
    maxVoltage: 30,
    showCurrent: true,
    ...partial,
  };
}

function bench(parts: BenchPart[], s: BenchSupply, fault: BenchFault | null = null): BenchState {
  const errors = validateLayout(parts);
  if (errors.length > 0) throw new Error(`Invalid bench layout: ${errors.join("; ")}`);
  return { parts, supply: s, meter: { mode: "off", red: null, black: null, fuseIntact: true }, fault, revision: 0 };
}

/* Board posts (6 × 3):
 *   T1  T2  T3  T4  T5  T6      row 0 (back)
 *   T7  T8  T9  T10 T11 T12     row 1
 *   T13 T14 T15 T16 T17 T18     row 2 (front)
 */

function singleResistor(seed: number, options: { editable: boolean; voltage?: number; resistance?: number; showCurrent: boolean }): BenchState {
  const rng = createRng(seed);
  const voltage = options.voltage ?? rng.pick([6, 9, 12, 15, 24]);
  const resistance = options.resistance ?? e12Value(rng, 220, 4700);
  return bench(
    [J("J1", "T1", "T2"), R("R1", "T2", "T8", resistance, options.editable), J("J2", "T8", "T7")],
    supply({ positivePost: "T1", negativePost: "T7", voltage, voltageEditable: !options.editable, showCurrent: options.showCurrent }),
  );
}

function seriesThree(seed: number, showCurrent: boolean, editable = false): BenchState {
  const rng = createRng(seed);
  const voltage = rng.pick([9, 12, 15, 18, 24]);
  const values = [e12Value(rng, 100, 2200), e12Value(rng, 100, 2200), e12Value(rng, 100, 2200)];
  return bench(
    [
      J("J1", "T1", "T2"),
      R("R1", "T2", "T3", values[0]!, editable),
      R("R2", "T3", "T4", values[1]!, editable),
      R("R3", "T4", "T10", values[2]!, editable),
      J("J2", "T10", "T9"),
      J("J3", "T9", "T8"),
      J("J4", "T8", "T7"),
    ],
    supply({ positivePost: "T1", negativePost: "T7", voltage, showCurrent }),
  );
}

function parallelBranches(seed: number, showCurrent: boolean, editable = false, forceBranches?: 2 | 3): BenchState {
  const rng = createRng(seed);
  const voltage = rng.pick([6, 9, 12]);
  const branches = forceBranches ?? (rng.next() < 0.5 ? 2 : 3);
  const parts: BenchPart[] = [
    J("J1", "T1", "T2"),
    J("J2", "T2", "T3"),
    J("J4", "T13", "T14"),
    J("J5", "T14", "T15"),
    R("R1", "T2", "T8", e12Value(rng, 220, 3300), editable),
    J("J7", "T8", "T14"),
    R("R2", "T3", "T9", e12Value(rng, 220, 3300), editable),
    J("J8", "T9", "T15"),
  ];
  if (branches === 3) {
    parts.push(J("J3", "T3", "T4"), J("J6", "T15", "T16"), R("R3", "T4", "T10", e12Value(rng, 220, 3300), editable), J("J9", "T10", "T16"));
  }
  return bench(parts, supply({ positivePost: "T1", negativePost: "T13", voltage, showCurrent }));
}

const OPEN_FAULT_CANDIDATES = ["R1", "R2", "R3", "R4", "J3", "J4"] as const;

function seriesOpenFault(seed: number): { state: BenchState; faultIndex: number } {
  const rng = createRng(seed);
  const voltage = rng.pick([12, 15, 24]);
  const values = [0, 1, 2, 3].map(() => e12Value(rng, 330, 2200));
  const faultIndex = Math.floor(rng.next() * OPEN_FAULT_CANDIDATES.length);
  const parts: BenchPart[] = [
    SW("S1", "T1", "T2", true),
    R("R1", "T2", "T3", values[0]!),
    R("R2", "T3", "T4", values[1]!),
    R("R3", "T4", "T5", values[2]!),
    R("R4", "T5", "T11", values[3]!),
    J("J2", "T11", "T17"),
    J("J3", "T17", "T16"),
    J("J4", "T16", "T15"),
    J("J5", "T15", "T14"),
    J("J6", "T14", "T13"),
  ];
  return {
    state: bench(parts, supply({ positivePost: "T1", negativePost: "T13", voltage, voltageEditable: false, showCurrent: false }), {
      kind: "open",
      partId: OPEN_FAULT_CANDIDATES[faultIndex]!,
    }),
    faultIndex,
  };
}

export function generateScenario(generator: ScenarioGeneratorId, seed: number): Scenario {
  switch (generator) {
    case "single-resistor":
      return { generator, seed, state: singleResistor(seed, { editable: false, showCurrent: false }), facts: {} };
    case "target-current": {
      const rng = createRng(seed ^ 0x5bd1e995);
      const voltage = rng.pick([9, 12, 15]);
      // A target that is reachable with a sensible resistance (100 Ω – 2.2 kΩ).
      const targetMilliamps = rng.pick([5, 6, 8, 10, 12, 15, 20, 25, 30, 40]);
      const state = singleResistor(seed, { editable: true, voltage, resistance: 1000, showCurrent: false });
      return { generator, seed, state, facts: { targetCurrent: targetMilliamps / 1000 } };
    }
    case "series-three":
      return { generator, seed, state: seriesThree(seed, false), facts: {} };
    case "parallel-branches":
      return { generator, seed, state: parallelBranches(seed, false), facts: {} };
    case "series-open-fault":
      return { generator, seed, state: seriesOpenFault(seed).state, facts: {} };
  }
}

/* ------------------------------------------------------------ workshop */

export type WorkshopPresetId = "workshop-single" | "workshop-series" | "workshop-parallel";

export const WORKSHOP_PRESETS: ReadonlyArray<{ id: WorkshopPresetId; title: string; description: string }> = [
  { id: "workshop-single", title: "Single resistor", description: "One source, one load, one jumper to break for current measurement." },
  { id: "workshop-series", title: "Series string", description: "Three resistors sharing one current path." },
  { id: "workshop-parallel", title: "Parallel branches", description: "Three branches across one source, each with its own measurement link." },
];

export function workshopScenario(preset: WorkshopPresetId): Scenario {
  const seed = 1;
  const state =
    preset === "workshop-single"
      ? singleResistor(seed, { editable: true, voltage: 12, resistance: 1000, showCurrent: true })
      : preset === "workshop-series"
        ? seriesThree(seed, true, true)
        : parallelBranches(seed, true, true, 3);
  return { generator: preset, seed, state: { ...state, supply: { ...state.supply, voltageEditable: true, showCurrent: true } }, facts: {} };
}
