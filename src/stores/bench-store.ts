"use client";

import { create } from "zustand";
import type { Scenario } from "@/domain/bench/scenarios";
import { createSession, dispatch, logReading, type BenchSession } from "@/domain/bench/session";
import type { BenchAction, PostId } from "@/domain/bench/types";

export type Selection =
  | { kind: "post"; id: PostId }
  | { kind: "part"; id: string }
  | { kind: "supply" }
  | { kind: "meter" }
  | null;

interface BenchStore {
  scenario: Scenario | null;
  session: BenchSession | null;
  selection: Selection;
  startedAt: number;
  load(scenario: Scenario): void;
  restore(scenario: Scenario, session: BenchSession): void;
  act(action: BenchAction): void;
  log(): void;
  select(selection: Selection): void;
  clearNotice(): void;
}

const elapsed = (startedAt: number) => Date.now() - startedAt;

/** Live bench state for the active simulator view. */
export const useBenchStore = create<BenchStore>((set, get) => ({
  scenario: null,
  session: null,
  selection: null,
  startedAt: 0,
  load(scenario) {
    set({ scenario, session: createSession(scenario.state), selection: null, startedAt: Date.now() });
  },
  restore(scenario, session) {
    set({ scenario, session, selection: null, startedAt: Date.now() });
  },
  act(action) {
    const { session, startedAt } = get();
    if (!session) return;
    set({ session: dispatch(session, action, elapsed(startedAt)) });
  },
  log() {
    const { session, startedAt } = get();
    if (!session) return;
    set({ session: logReading(session, elapsed(startedAt)) });
  },
  select(selection) {
    set({ selection });
  },
  clearNotice() {
    const { session } = get();
    if (session?.notice) set({ session: { ...session, notice: null } });
  },
}));
