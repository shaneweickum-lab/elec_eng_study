import { describe, expect, it } from "vitest";
import { generateScenario, workshopScenario } from "@/domain/bench/scenarios";
import { createSession, dispatch, logReading } from "@/domain/bench/session";
import { solveBench, toCircuit } from "@/domain/bench/simulate";
import { validateLayout } from "@/domain/bench/board";
import type { BenchAction } from "@/domain/bench/types";

const run = (state: ReturnType<typeof generateScenario>["state"], actions: BenchAction[]) =>
  actions.reduce((s, a, i) => dispatch(s, a, i * 1000), createSession(state));

describe("bench model", () => {
  it("translates posts and parts into a circuit", () => {
    const { state } = generateScenario("single-resistor", 42);
    const circuit = toCircuit({ ...state, supply: { ...state.supply, outputOn: true } });
    expect(circuit.components.map((c) => c.kind).sort()).toEqual(["resistor", "voltage-source", "wire", "wire"]);
    expect(circuit.ground).toBe(state.supply.negativePost);
  });

  it("de-energized bench has no source", () => {
    const { state } = generateScenario("single-resistor", 42);
    expect(toCircuit(state).components.some((c) => c.kind === "voltage-source")).toBe(false);
  });

  it("generates reproducible scenarios from a seed", () => {
    for (const g of ["single-resistor", "target-current", "series-three", "parallel-branches", "series-open-fault"] as const) {
      expect(generateScenario(g, 1234)).toEqual(generateScenario(g, 1234));
      expect(validateLayout(generateScenario(g, 99).state.parts)).toEqual([]);
    }
    const seeds = new Set(Array.from({ length: 20 }, (_, i) => JSON.stringify(generateScenario("series-three", i).state.parts)));
    expect(seeds.size).toBeGreaterThan(5);
  });

  it("injects a hidden open fault that stops current", () => {
    const { state } = generateScenario("series-open-fault", 7);
    const live = { ...state, supply: { ...state.supply, outputOn: true } };
    const s = solveBench(live);
    expect(s.status).toBe("ok");
    if (s.status === "ok") expect(s.componentCurrents.PS1).toBeCloseTo(0, 12);
    expect(state.fault).not.toBeNull();
  });

  it("workshop presets are editable", () => {
    const { state } = workshopScenario("workshop-series");
    expect(state.parts.filter((p) => p.kind === "resistor").every((p) => p.kind === "resistor" && p.editable)).toBe(true);
  });
});

describe("bench session — instruments and safety", () => {
  it("reads supply voltage across the resistor", () => {
    const { state } = generateScenario("single-resistor", 3);
    const s = run(state, [
      { type: "set-output", on: true },
      { type: "set-meter-mode", mode: "dc-voltage" },
      { type: "place-probe", probe: "red", postId: "T2" },
      { type: "place-probe", probe: "black", postId: "T8" },
    ]);
    expect(s.reading.value).toBeCloseTo(state.supply.voltage, 2);
    expect(s.safetyEvents).toHaveLength(0);
  });

  it("records a violation when wiring is changed while energized", () => {
    const { state } = generateScenario("single-resistor", 3);
    const s = run(state, [
      { type: "set-output", on: true },
      { type: "set-jumper", partId: "J1", installed: false },
    ]);
    expect(s.safetyEvents.map((e) => e.code)).toEqual(["component-change-energized"]);
  });

  it("records ohmmeter-on-live and ammeter-across-source hazards once each", () => {
    const { state } = generateScenario("single-resistor", 3);
    const s = run(state, [
      { type: "set-output", on: true },
      { type: "set-meter-mode", mode: "resistance" },
      { type: "place-probe", probe: "red", postId: "T2" },
      { type: "place-probe", probe: "black", postId: "T8" },
      { type: "set-meter-mode", mode: "dc-current" },
      { type: "place-probe", probe: "red", postId: "T1" },
      { type: "place-probe", probe: "black", postId: "T7" },
      { type: "place-probe", probe: "black", postId: "T7" },
    ]);
    const codes = s.safetyEvents.map((e) => e.code);
    expect(codes).toContain("ohmmeter-on-energized-circuit");
    expect(codes.filter((c) => c === "ammeter-across-source")).toHaveLength(1);
  });

  it("rejects editing fixed parts", () => {
    const { state } = generateScenario("single-resistor", 3);
    const s = run(state, [{ type: "set-resistance", partId: "R1", value: 100 }]);
    expect(s.notice).toMatch(/fixed/);
  });

  it("increments the circuit revision on circuit changes only", () => {
    const { state } = generateScenario("single-resistor", 3);
    const s = run(state, [{ type: "set-output", on: true }, { type: "set-meter-mode", mode: "dc-voltage" }]);
    expect(s.state.revision).toBe(1);
  });

  it("logs readings with the parts they correspond to", () => {
    const { state } = generateScenario("single-resistor", 3);
    let s = run(state, [
      { type: "set-jumper", partId: "J1", installed: false },
      { type: "set-meter-mode", mode: "dc-current" },
      { type: "place-probe", probe: "red", postId: "T1" },
      { type: "place-probe", probe: "black", postId: "T2" },
      { type: "set-output", on: true },
    ]);
    s = logReading(s, 9000);
    expect(s.safetyEvents).toHaveLength(0);
    expect(s.readings[0]!.seriesParts).toEqual(expect.arrayContaining(["R1", "PS1"]));
    const r1 = state.parts.find((p) => p.id === "R1");
    if (r1?.kind !== "resistor") throw new Error();
    expect(s.readings[0]!.value).toBeCloseTo(state.supply.voltage / (r1.resistance + 0.1), 9);
  });
});
