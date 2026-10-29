import type { Circuit } from "./schema";
import { solveDC, type DCFailure, type DCSolution } from "./dc";
import type { CoilStates } from "./topology";

/**
 * Discrete control-state settling for relay logic.
 *
 * Coils are resistive loads with pickup/dropout thresholds. After each DC
 * solve, every coil's state is updated from the voltage across it:
 *   |V| ≥ pickup  → energized
 *   |V| < dropout → de-energized
 *   otherwise     → unchanged (hysteresis band)
 * Contacts follow their coil, which changes the topology, so the process
 * repeats until the state is stable. A revisited state means the circuit
 * oscillates (e.g. a coil fed through its own NC contact — a "buzzer").
 *
 * Simplifications (documented in SIMULATION_ENGINE.md): coil inductance,
 * contact bounce and operate/release times are not modelled.
 */

export type ControlSettleResult =
  | {
      readonly status: "stable";
      readonly coilStates: CoilStates;
      readonly solution: DCSolution;
      readonly iterations: number;
    }
  | { readonly status: "oscillating"; readonly states: readonly CoilStates[] }
  | { readonly status: "error"; readonly failure: DCFailure; readonly coilStates: CoilStates };

const keyOf = (states: CoilStates, ids: readonly string[]) => ids.map((id) => (states[id] ? "1" : "0")).join("");

export function settleControlCircuit(
  circuit: Circuit,
  initialCoilStates: CoilStates = {},
  maxIterations = 32,
): ControlSettleResult {
  const coils = circuit.components.filter((c) => c.kind === "relay-coil");
  const coilIds = coils.map((c) => c.id).sort();
  let states: Record<string, boolean> = {};
  for (const id of coilIds) states[id] = initialCoilStates[id] === true;
  const visited = new Map<string, number>([[keyOf(states, coilIds), 0]]);
  const history: CoilStates[] = [{ ...states }];

  for (let iteration = 1; iteration <= maxIterations; iteration++) {
    const result = solveDC(circuit, { coilStates: states });
    if (result.status !== "ok") return { status: "error", failure: result, coilStates: states };

    const next: Record<string, boolean> = {};
    for (const coil of coils) {
      const magnitude = Math.abs(result.componentVoltages[coil.id] ?? 0);
      if (magnitude >= coil.pickupVoltage) next[coil.id] = true;
      else if (magnitude < coil.dropoutVoltage) next[coil.id] = false;
      else next[coil.id] = states[coil.id] === true;
    }
    const key = keyOf(next, coilIds);
    if (key === keyOf(states, coilIds)) {
      return { status: "stable", coilStates: states, solution: result, iterations: iteration };
    }
    if (visited.has(key)) {
      history.push({ ...next });
      return { status: "oscillating", states: history };
    }
    visited.set(key, iteration);
    history.push({ ...next });
    states = next;
  }
  return { status: "oscillating", states: history };
}
