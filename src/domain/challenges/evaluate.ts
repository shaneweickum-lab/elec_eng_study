import { withinTolerance, type DCSolution } from "@iea/circuit-sim";
import { solveBench } from "@/domain/bench/simulate";
import type { BenchState, LoggedReading, SafetyEvent } from "@/domain/bench/types";
import type { ChallengeDefinition, ChallengeMode, ChallengeTask, QuantityRef, SafetyRule } from "./schema";

/**
 * Challenge evaluation. Correctness is judged against the simulator's own
 * solution of the bench as it stands and the learner's logged instrument
 * readings — never against a stored answer string. Safety is scored
 * separately and gates competency evidence.
 */

export interface Submission {
  readonly state: BenchState;
  readonly facts: Readonly<Record<string, number>>;
  readonly readings: readonly LoggedReading[];
  readonly safetyEvents: readonly SafetyEvent[];
  /** Numeric answers in SI units, keyed by task id. */
  readonly answers: Readonly<Record<string, number | undefined>>;
  /** Part chosen for identify-fault tasks. */
  readonly diagnosis?: string;
  /** Number of wrong diagnoses submitted before this one. */
  readonly wrongDiagnoses: number;
  readonly hintsUsed: number;
  readonly mode: ChallengeMode;
  readonly elapsedSeconds: number;
}

export interface TaskResult {
  readonly taskId: string;
  readonly passed: boolean;
  readonly feedback: string;
}

export interface SafetyFinding {
  readonly code: string;
  readonly severity: "violation" | "technique";
  readonly message: string;
  readonly count: number;
}

export interface ChallengeResult {
  readonly passed: boolean;
  /** Correctness score, 0–100. */
  readonly score: number;
  /** Safety score, 0–100 (100 = no violations). */
  readonly safetyScore: number;
  readonly safetyPassed: boolean;
  readonly timeExpired: boolean;
  readonly tasks: readonly TaskResult[];
  readonly safety: readonly SafetyFinding[];
  readonly summary: string;
}

const RULE_CODES: Record<SafetyRule, string> = {
  "de-energize-before-changes": "component-change-energized",
  "no-ohmmeter-on-energized-circuit": "ohmmeter-on-energized-circuit",
  "no-ammeter-across-source": "ammeter-across-source",
  "no-meter-overcurrent": "ammeter-overcurrent",
};

export function resolveQuantity(solution: DCSolution, state: BenchState, quantity: QuantityRef): number | null {
  switch (quantity.kind) {
    case "current": {
      const i = solution.componentCurrents[quantity.partId];
      return i == null ? null : Math.abs(i);
    }
    case "voltage": {
      const v = solution.componentVoltages[quantity.partId];
      return v == null ? null : Math.abs(v);
    }
    case "supply-current": {
      const i = solution.componentCurrents[state.supply.id];
      return i == null ? null : Math.abs(i);
    }
    case "equivalent-resistance": {
      const i = solution.componentCurrents[state.supply.id];
      const v = solution.componentVoltages[state.supply.id];
      if (i == null || v == null || Math.abs(i) < 1e-12) return null;
      return Math.abs(v / i);
    }
  }
}

const UNIT_NAMES = { A: "current", V: "voltage", "Ω": "resistance" } as const;

function validReading(r: LoggedReading): boolean {
  return r.status === "ok" && r.hazardCodes.length === 0;
}

function evaluateTask(task: ChallengeTask, submission: Submission, solution: DCSolution | null): TaskResult {
  const { state } = submission;
  switch (task.kind) {
    case "numeric-answer": {
      const answer = submission.answers[task.id];
      if (answer === undefined || !Number.isFinite(answer)) {
        return { taskId: task.id, passed: false, feedback: "No answer entered." };
      }
      if (!solution) return { taskId: task.id, passed: false, feedback: "The circuit is invalid, so your answer cannot be checked against it." };
      const expected = resolveQuantity(solution, state, task.quantity);
      if (expected === null) return { taskId: task.id, passed: false, feedback: `The ${UNIT_NAMES[task.unit]} is undefined for the circuit as it stands.` };
      const passed = withinTolerance(answer, expected, task.tolerance);
      const ratio = answer / expected;
      let feedback = passed ? "Correct." : "Not within tolerance of the circuit's actual value.";
      if (!passed && expected !== 0 && [1000, 0.001, 1e6, 1e-6].some((k) => withinTolerance(ratio, k, task.tolerance))) {
        feedback += " Check your unit prefix (m, k, µ).";
      }
      return { taskId: task.id, passed, feedback };
    }
    case "measurement": {
      const spec = task.measurement;
      const candidates = submission.readings.filter((r) => {
        if (task.requireCurrentRevision && r.revision !== state.revision) return false;
        if (spec.mode === "dc-voltage") return r.mode === "dc-voltage" && r.acrossParts.includes(spec.across);
        if (spec.mode === "dc-current") return r.mode === "dc-current" && r.seriesParts.includes(spec.through === "supply" ? state.supply.id : spec.through);
        return (r.mode === "resistance" || r.mode === "continuity") && r.acrossParts.includes(spec.of);
      });
      const valid = candidates.filter(validReading);
      if (valid.length > 0) return { taskId: task.id, passed: true, feedback: `Valid reading logged (${valid[0]!.display} ${valid[0]!.displayUnit}).` };
      if (candidates.length > 0) return { taskId: task.id, passed: false, feedback: "A reading was logged at the right place, but it was invalid (error, overload or unsafe connection)." };
      const stale = task.requireCurrentRevision && submission.readings.some((r) => r.revision !== state.revision);
      const how =
        spec.mode === "dc-current"
          ? "Current must be measured in series: open a link and let the meter complete the circuit."
          : spec.mode === "dc-voltage"
            ? "Voltage is measured across the part: one probe on each of its terminals."
            : "Resistance is measured across the part with the circuit de-energized.";
      return { taskId: task.id, passed: false, feedback: stale ? "Your readings were taken before the last change to the circuit. Measure again." : `No matching reading logged. ${how}` };
    }
    case "circuit-target": {
      if (!solution) return { taskId: task.id, passed: false, feedback: "The circuit is invalid." };
      const actual = resolveQuantity(solution, state, task.quantity);
      const target = submission.facts[task.targetFact];
      if (actual === null || target === undefined) return { taskId: task.id, passed: false, feedback: "The target quantity cannot be evaluated." };
      const passed = withinTolerance(actual, target, task.tolerance);
      return { taskId: task.id, passed, feedback: passed ? "The circuit meets the target." : `The circuit is ${actual > target ? "above" : "below"} the target.` };
    }
    case "identify-fault": {
      if (!submission.diagnosis) return { taskId: task.id, passed: false, feedback: "No component identified." };
      const passed = state.fault?.partId === submission.diagnosis;
      return { taskId: task.id, passed, feedback: passed ? "Correct diagnosis." : "That component is not the open one." };
    }
    case "evidence": {
      const valid = submission.readings.filter((r) => (task.modes as readonly string[]).includes(r.mode) && validReading(r));
      const passed = valid.length >= task.minReadings;
      return {
        taskId: task.id,
        passed,
        feedback: passed ? `${valid.length} valid diagnostic readings logged.` : `${valid.length} of ${task.minReadings} valid readings logged.`,
      };
    }
  }
}

export function evaluateSafety(definition: ChallengeDefinition, events: readonly SafetyEvent[]): { score: number; findings: SafetyFinding[] } {
  const ruled = new Set(definition.safetyRules.map((r) => RULE_CODES[r]));
  const grouped = new Map<string, SafetyFinding>();
  for (const e of events) {
    const severity = ruled.has(e.code) ? e.severity : "technique";
    const prev = grouped.get(e.code);
    grouped.set(e.code, { code: e.code, severity: prev?.severity === "violation" ? "violation" : severity, message: e.message, count: (prev?.count ?? 0) + 1 });
  }
  const findings = [...grouped.values()];
  let score = 100;
  for (const f of findings) score -= f.severity === "violation" ? 25 * Math.min(f.count, 2) : 5;
  return { score: Math.max(0, score), findings };
}

/**
 * The circuit as designed: all measurement links installed and the supply on
 * at its present set-point. Calculated answers are checked against this, so a
 * learner who leaves a link open after measuring is not marked wrong for the
 * arithmetic. Hidden faults still apply.
 */
export function referenceState(state: BenchState): BenchState {
  return {
    ...state,
    parts: state.parts.map((p) => (p.kind === "jumper" ? { ...p, installed: true } : p)),
    supply: { ...state.supply, outputOn: true },
  };
}

export function evaluateChallenge(definition: ChallengeDefinition, submission: Submission): ChallengeResult {
  const reference = referenceState(submission.state);
  const solved = solveBench(reference);
  const solution = solved.status === "ok" ? solved : null;
  const tasks = definition.tasks.map((t) => evaluateTask(t, submission, solution));
  const passedCount = tasks.filter((t) => t.passed).length;
  const hintPenalty = submission.mode === "guided" ? 0 : submission.hintsUsed * definition.scoring.hintPenalty;
  const raw = (100 * passedCount) / tasks.length - hintPenalty - submission.wrongDiagnoses * definition.scoring.wrongDiagnosisPenalty;
  const score = Math.max(0, Math.round(raw));
  const timeExpired = (submission.mode === "timed" || submission.mode === "mastery") && submission.elapsedSeconds > definition.scoring.timeLimitSeconds;
  const allTasks = passedCount === tasks.length;
  const passed = allTasks && score >= definition.scoring.passThreshold && !timeExpired;
  const safety = evaluateSafety(definition, submission.safetyEvents);
  const safetyPassed = safety.findings.every((f) => f.severity !== "violation");

  let summary: string;
  if (timeExpired) summary = "Time expired before submission.";
  else if (passed && safetyPassed) summary = "Challenge complete with safe working practice.";
  else if (passed) summary = "Technically correct, but safety rules were broken. This attempt does not count as demonstrated competency.";
  else summary = `${passedCount} of ${tasks.length} tasks complete. Review the feedback and try again.`;

  return { passed, score, safetyScore: safety.score, safetyPassed, timeExpired, tasks, safety: safety.findings, summary };
}
