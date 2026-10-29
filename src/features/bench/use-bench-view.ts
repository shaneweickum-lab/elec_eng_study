"use client";

import { useMemo } from "react";
import { solvePhysical } from "@/domain/bench/simulate";
import type { BenchSession } from "@/domain/bench/session";

/** Derived, physically-present operating point (includes the meter when connected). */
export function usePhysicalSolution(session: BenchSession | null) {
  return useMemo(() => (session ? solvePhysical(session.state) : null), [session]);
}
