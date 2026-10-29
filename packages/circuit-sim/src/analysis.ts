import type { Circuit } from "./schema";
import { solveDC, type DCResult, type DCSolveOptions } from "./dc";

/**
 * Analysis extension point.
 *
 * Only the DC operating point is implemented. AC (phasor) sweeps and
 * transient analysis are declared so callers and UI can be written against a
 * stable contract; until implemented they return `unsupported` rather than
 * an approximation.
 */
export type AnalysisRequest =
  | { readonly kind: "dc-operating-point"; readonly circuit: Circuit; readonly options?: DCSolveOptions }
  | { readonly kind: "ac-sweep"; readonly circuit: Circuit; readonly frequenciesHz: readonly number[] }
  | { readonly kind: "transient"; readonly circuit: Circuit; readonly stopTimeS: number; readonly stepS: number };

export type AnalysisKind = AnalysisRequest["kind"];

export type AnalysisResult =
  | { readonly kind: "dc-operating-point"; readonly result: DCResult }
  | { readonly kind: Exclude<AnalysisKind, "dc-operating-point">; readonly result: { readonly status: "unsupported"; readonly message: string } };

export const SUPPORTED_ANALYSES: readonly AnalysisKind[] = ["dc-operating-point"];

export function runAnalysis(request: AnalysisRequest): AnalysisResult {
  switch (request.kind) {
    case "dc-operating-point":
      return { kind: request.kind, result: solveDC(request.circuit, request.options) };
    case "ac-sweep":
    case "transient":
      return {
        kind: request.kind,
        result: { status: "unsupported", message: `${request.kind} analysis is not implemented yet.` },
      };
  }
}
