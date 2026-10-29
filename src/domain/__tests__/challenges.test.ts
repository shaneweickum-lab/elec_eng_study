import { describe, expect, it } from "vitest";
import { CHALLENGES, getChallenge } from "@/domain/challenges/definitions";
import { evaluateChallenge, type Submission } from "@/domain/challenges/evaluate";
import { generateScenario } from "@/domain/bench/scenarios";
import { createSession, dispatch, logReading, type BenchSession } from "@/domain/bench/session";
import type { BenchAction, BenchState } from "@/domain/bench/types";

function play(state: BenchState, steps: (BenchAction | "log")[]): BenchSession {
  return steps.reduce((s, step, i) => (step === "log" ? logReading(s, i * 1000) : dispatch(s, step, i * 1000)), createSession(state));
}

const submit = (session: BenchSession, extra: Partial<Submission> & Pick<Submission, "facts">): Submission => ({
  state: session.state,
  readings: session.readings,
  safetyEvents: session.safetyEvents,
  answers: {},
  wrongDiagnoses: 0,
  hintsUsed: 0,
  mode: "independent",
  elapsedSeconds: 60,
  ...extra,
});

const resistance = (state: BenchState, id: string) => {
  const p = state.parts.find((x) => x.id === id);
  if (p?.kind !== "resistor") throw new Error(id);
  return p.resistance;
};

const SAFE_SERIES_CURRENT: (BenchAction | "log")[] = [
  { type: "set-jumper", partId: "J1", installed: false },
  { type: "set-meter-mode", mode: "dc-current" },
  { type: "place-probe", probe: "red", postId: "T1" },
  { type: "place-probe", probe: "black", postId: "T2" },
  { type: "set-output", on: true },
  "log",
];

describe("challenge definitions", () => {
  it("defines five progressive challenges sharing one environment", () => {
    expect(CHALLENGES).toHaveLength(5);
    expect(new Set(CHALLENGES.map((c) => c.environment))).toEqual(new Set(["training-bench"]));
    expect(CHALLENGES.map((c) => c.difficulty)).toEqual([...CHALLENGES.map((c) => c.difficulty)].sort());
  });
});

describe("challenge 1 — basic current", () => {
  const def = getChallenge("dc-current-basic")!;
  const scenario = generateScenario("single-resistor", 1001);
  const expected = scenario.state.supply.voltage / resistance(scenario.state, "R1");

  it("passes with a correct answer and a safe series measurement", () => {
    const session = play(scenario.state, SAFE_SERIES_CURRENT);
    const result = evaluateChallenge(def, submit(session, { facts: scenario.facts, answers: { predict: expected } }));
    expect(result.tasks.every((t) => t.passed)).toBe(true);
    expect(result.passed).toBe(true);
    expect(result.safetyPassed).toBe(true);
    expect(result.score).toBe(100);
  });

  it("fails the calculation with a prefix error and says so", () => {
    const session = play(scenario.state, SAFE_SERIES_CURRENT);
    const result = evaluateChallenge(def, submit(session, { facts: scenario.facts, answers: { predict: expected * 1000 } }));
    expect(result.passed).toBe(false);
    expect(result.tasks[0]!.feedback).toMatch(/prefix/);
  });

  it("does not accept a voltage reading as a current measurement", () => {
    const session = play(scenario.state, [
      { type: "set-output", on: true },
      { type: "set-meter-mode", mode: "dc-voltage" },
      { type: "place-probe", probe: "red", postId: "T2" },
      { type: "place-probe", probe: "black", postId: "T8" },
      "log",
    ]);
    const result = evaluateChallenge(def, submit(session, { facts: scenario.facts, answers: { predict: expected } }));
    expect(result.tasks[1]!.passed).toBe(false);
  });

  it("scores safety separately: correct but unsafe is passed technically, not competent", () => {
    const session = play(scenario.state, [
      { type: "set-output", on: true },
      { type: "set-jumper", partId: "J1", installed: false }, // live wiring change
      { type: "set-meter-mode", mode: "dc-current" },
      { type: "place-probe", probe: "red", postId: "T1" },
      { type: "place-probe", probe: "black", postId: "T2" },
      "log",
    ]);
    const result = evaluateChallenge(def, submit(session, { facts: scenario.facts, answers: { predict: expected } }));
    expect(result.passed).toBe(true);
    expect(result.safetyPassed).toBe(false);
    expect(result.safetyScore).toBeLessThan(100);
  });

  it("applies hint penalties outside guided mode only", () => {
    const session = play(scenario.state, SAFE_SERIES_CURRENT);
    const base = { facts: scenario.facts, answers: { predict: expected }, hintsUsed: 2 };
    expect(evaluateChallenge(def, submit(session, { ...base, mode: "independent" })).score).toBe(90);
    expect(evaluateChallenge(def, submit(session, { ...base, mode: "guided" })).score).toBe(100);
  });

  it("fails timed attempts submitted after the limit", () => {
    const session = play(scenario.state, SAFE_SERIES_CURRENT);
    const result = evaluateChallenge(def, submit(session, { facts: scenario.facts, answers: { predict: expected }, mode: "timed", elapsedSeconds: 999 }));
    expect(result.timeExpired).toBe(true);
    expect(result.passed).toBe(false);
  });
});

describe("challenge 2 — target current", () => {
  const def = getChallenge("target-current")!;
  const scenario = generateScenario("target-current", 77);
  const target = scenario.facts.targetCurrent!;
  const needed = scenario.state.supply.voltage / target;

  it("passes when R1 is set correctly and verified after the change", () => {
    const session = play(scenario.state, [{ type: "set-resistance", partId: "R1", value: needed }, ...SAFE_SERIES_CURRENT]);
    const result = evaluateChallenge(def, submit(session, { facts: scenario.facts }));
    expect(result.passed).toBe(true);
  });

  it("rejects a verification reading taken before the final change", () => {
    const session = play(scenario.state, [
      ...SAFE_SERIES_CURRENT,
      { type: "set-output", on: false },
      { type: "set-resistance", partId: "R1", value: needed },
    ]);
    const result = evaluateChallenge(def, submit(session, { facts: scenario.facts }));
    expect(result.tasks.find((t) => t.taskId === "verify")!.passed).toBe(false);
    expect(result.tasks.find((t) => t.taskId === "target")!.passed).toBe(true);
  });

  it("fails when the current misses the target", () => {
    const session = play(scenario.state, [{ type: "set-resistance", partId: "R1", value: needed * 1.2 }, ...SAFE_SERIES_CURRENT]);
    expect(evaluateChallenge(def, submit(session, { facts: scenario.facts })).passed).toBe(false);
  });
});

describe("challenge 3 — series", () => {
  const def = getChallenge("series-analysis")!;
  const scenario = generateScenario("series-three", 5);
  const rt = ["R1", "R2", "R3"].reduce((sum, id) => sum + resistance(scenario.state, id), 0);
  const i = scenario.state.supply.voltage / rt;

  it("passes with correct answers and a voltage reading across R2", () => {
    const session = play(scenario.state, [
      { type: "set-output", on: true },
      { type: "set-meter-mode", mode: "dc-voltage" },
      { type: "place-probe", probe: "red", postId: "T3" },
      { type: "place-probe", probe: "black", postId: "T4" },
      "log",
    ]);
    const result = evaluateChallenge(def, submit(session, { facts: scenario.facts, answers: { req: rt, current: i } }));
    expect(result.tasks.map((t) => t.passed)).toEqual([true, true, true]);
    expect(session.readings[0]!.value).toBeCloseTo(i * resistance(scenario.state, "R2"), 3);
  });
});

describe("challenge 4 — parallel", () => {
  const def = getChallenge("parallel-analysis")!;
  const scenario = generateScenario("parallel-branches", 11);
  const branches = scenario.state.parts.filter((p) => p.kind === "resistor").map((p) => (p.kind === "resistor" ? p.resistance : 0));
  const v = scenario.state.supply.voltage;
  const total = branches.reduce((s, r) => s + v / r, 0);

  it("passes with a branch current measured through R1's link", () => {
    const session = play(scenario.state, [
      { type: "set-jumper", partId: "J7", installed: false },
      { type: "set-meter-mode", mode: "dc-current" },
      { type: "place-probe", probe: "red", postId: "T8" },
      { type: "place-probe", probe: "black", postId: "T14" },
      { type: "set-output", on: true },
      "log",
    ]);
    const result = evaluateChallenge(def, submit(session, { facts: scenario.facts, answers: { total, req: v / total } }));
    expect(result.tasks.map((t) => t.passed)).toEqual([true, true, true]);
    expect(session.readings[0]!.seriesParts).toContain("R1");
    expect(session.readings[0]!.seriesParts).not.toContain("R2");
  });
});

describe("challenge 5 — open circuit diagnosis", () => {
  const def = getChallenge("open-circuit-diagnosis")!;
  const scenario = generateScenario("series-open-fault", 2024);
  const faulty = scenario.state.fault!.partId;

  const survey: (BenchAction | "log")[] = [
    { type: "set-output", on: true },
    { type: "set-meter-mode", mode: "dc-voltage" },
    { type: "place-probe", probe: "black", postId: "T13" },
    { type: "place-probe", probe: "red", postId: "T2" },
    "log",
    { type: "place-probe", probe: "red", postId: "T3" },
    "log",
    { type: "place-probe", probe: "red", postId: "T4" },
    "log",
  ];

  it("passes with evidence and the correct diagnosis", () => {
    const session = play(scenario.state, survey);
    const result = evaluateChallenge(def, submit(session, { facts: scenario.facts, diagnosis: faulty }));
    expect(result.passed).toBe(true);
  });

  it("fails a wrong diagnosis and penalises earlier wrong guesses", () => {
    const session = play(scenario.state, survey);
    const wrong = scenario.state.parts.find((p) => p.id !== faulty)!.id;
    expect(evaluateChallenge(def, submit(session, { facts: scenario.facts, diagnosis: wrong })).passed).toBe(false);
    expect(evaluateChallenge(def, submit(session, { facts: scenario.facts, diagnosis: faulty, wrongDiagnoses: 1 })).score).toBe(80);
  });

  it("does not accept a guess without measurements", () => {
    const session = play(scenario.state, []);
    expect(evaluateChallenge(def, submit(session, { facts: scenario.facts, diagnosis: faulty })).passed).toBe(false);
  });

  it("an energized ohmmeter reading is not valid evidence and is a violation", () => {
    const session = play(scenario.state, [
      { type: "set-output", on: true },
      { type: "set-meter-mode", mode: "resistance" },
      { type: "place-probe", probe: "red", postId: "T2" },
      { type: "place-probe", probe: "black", postId: "T3" },
      "log",
      "log",
      "log",
    ]);
    const result = evaluateChallenge(def, submit(session, { facts: scenario.facts, diagnosis: faulty }));
    expect(result.tasks.find((t) => t.taskId === "evidence")!.passed).toBe(false);
    expect(result.safetyPassed).toBe(false);
  });
});
