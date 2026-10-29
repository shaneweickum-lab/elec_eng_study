import type { MultimeterReading } from "@iea/circuit-sim";
import { applyBenchAction, makeLoggedReading, meterHazardEvents, readMeter } from "./simulate";
import type { BenchAction, BenchState, LoggedReading, RecordedAction, SafetyEvent } from "./types";

/**
 * A bench session: authoritative state plus everything the learner did.
 * Pure and framework-free; the UI store and the tests drive the same code.
 */
export interface BenchSession {
  readonly state: BenchState;
  readonly reading: MultimeterReading;
  readonly actions: readonly RecordedAction[];
  readonly readings: readonly LoggedReading[];
  readonly safetyEvents: readonly SafetyEvent[];
  readonly activeHazards: readonly string[];
  /** Last rejection message, for UI feedback. */
  readonly notice: string | null;
}

export function createSession(state: BenchState): BenchSession {
  return { state, reading: readMeter(state), actions: [], readings: [], safetyEvents: [], activeHazards: [], notice: null };
}

export function dispatch(session: BenchSession, action: BenchAction, t: number): BenchSession {
  const outcome = applyBenchAction(session.state, action, t);
  if (outcome.rejected) return { ...session, notice: outcome.rejected };
  let state = outcome.state;
  let reading = readMeter(state);
  const hazards = meterHazardEvents(reading, new Set(session.activeHazards), t);
  if (reading.blowsFuse) {
    // The fuse is now physically open until it is replaced.
    state = { ...state, meter: { ...state.meter, fuseIntact: false } };
    reading = { ...readMeter(state), hazards: reading.hazards };
  }
  const events = [...outcome.events, ...hazards.events];
  return {
    state,
    reading,
    actions: [...session.actions, { ...action, t }],
    readings: session.readings,
    safetyEvents: events.length > 0 ? [...session.safetyEvents, ...events] : session.safetyEvents,
    activeHazards: [...hazards.active],
    notice: events.find((e) => e.severity === "violation")?.message ?? null,
  };
}

export function logReading(session: BenchSession, t: number): BenchSession {
  if (session.state.meter.mode === "off") return { ...session, notice: "Turn the meter on and connect the probes before logging a reading." };
  const id = `M${session.readings.length + 1}`;
  return {
    ...session,
    readings: [...session.readings, makeLoggedReading(session.state, session.reading, id, t)],
    actions: [...session.actions, { type: "log-reading", t }],
    notice: null,
  };
}
