import { generateScenario } from "@/domain/bench/scenarios";
import { createSession, dispatch, logReading, type BenchSession } from "@/domain/bench/session";
import type { BenchAction } from "@/domain/bench/types";
import type { AttemptRecord } from "@/domain/progress/schema";
import { parseEngineering } from "@/lib/units";
import { evaluateChallenge, type ChallengeResult } from "./evaluate";
import type { ChallengeDefinition } from "./schema";

/**
 * Deterministically rebuild an attempt from its seed, definition and action
 * log. Because the simulator and evaluator are pure, the replayed result must
 * equal the recorded one — which lets a server verify submitted attempts
 * instead of trusting client-reported scores.
 */
export function replaySession(definition: ChallengeDefinition, attempt: Pick<AttemptRecord, "seed" | "actions">): BenchSession {
  const scenario = generateScenario(definition.scenario.generator, attempt.seed);
  let session = createSession(scenario.state);
  for (const action of attempt.actions) {
    session = action.type === "log-reading" ? logReading(session, action.t) : dispatch(session, action as unknown as BenchAction, action.t);
  }
  return session;
}

export function replayAttempt(definition: ChallengeDefinition, attempt: AttemptRecord): ChallengeResult {
  if (attempt.challengeId !== definition.id || attempt.definitionVersion !== definition.version) {
    throw new Error(`Attempt was made against ${attempt.challengeId}@v${attempt.definitionVersion}, not ${definition.id}@v${definition.version}`);
  }
  const session = replaySession(definition, attempt);
  const scenario = generateScenario(definition.scenario.generator, attempt.seed);
  const answers: Record<string, number | undefined> = {};
  for (const [id, text] of Object.entries(attempt.answers)) answers[id] = parseEngineering(text) ?? undefined;
  return evaluateChallenge(definition, {
    state: session.state,
    facts: scenario.facts,
    readings: session.readings,
    safetyEvents: session.safetyEvents,
    answers,
    diagnosis: attempt.diagnosis,
    wrongDiagnoses: attempt.wrongDiagnoses,
    hintsUsed: attempt.mode === "guided" ? 0 : attempt.hintsUsed,
    mode: attempt.mode,
    elapsedSeconds: attempt.durationSeconds,
  });
}
