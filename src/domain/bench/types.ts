import type { MeterHazardCode, MultimeterMode } from "@iea/circuit-sim";

/**
 * Training-bench model (Environment A).
 *
 * The bench is a terminal board of binding posts. Every part spans two
 * adjacent posts. Posts are electrical nodes; jumper links and closed
 * switches merge them. This physical model is translated into a
 * @iea/circuit-sim circuit for every calculation.
 */

export const BOARD_COLS = 6;
export const BOARD_ROWS = 3;

export type PostId = string;

export interface BenchPost {
  readonly id: PostId;
  readonly label: string;
  readonly col: number;
  readonly row: number;
}

interface PartBase {
  readonly id: string;
  readonly label: string;
  readonly a: PostId;
  readonly b: PostId;
}

export interface ResistorPart extends PartBase {
  readonly kind: "resistor";
  /** Nominal resistance, Ω. */
  readonly resistance: number;
  readonly editable: boolean;
}

export interface SwitchPart extends PartBase {
  readonly kind: "switch";
  readonly closed: boolean;
}

export interface JumperPart extends PartBase {
  readonly kind: "jumper";
  readonly installed: boolean;
}

export type BenchPart = ResistorPart | SwitchPart | JumperPart;

export interface BenchSupply {
  readonly id: "PS1";
  readonly positivePost: PostId;
  readonly negativePost: PostId;
  /** Set-point, V. */
  readonly voltage: number;
  /** Current limit, A. */
  readonly currentLimit: number;
  readonly outputOn: boolean;
  readonly voltageEditable: boolean;
  readonly maxVoltage: number;
  /** Whether the supply's own current readout is enabled for this exercise. */
  readonly showCurrent: boolean;
}

export interface BenchMeter {
  readonly mode: MultimeterMode;
  readonly red: PostId | null;
  readonly black: PostId | null;
  readonly fuseIntact: boolean;
}

/** Hidden fault injected by a scenario. */
export type BenchFault = { readonly kind: "open"; readonly partId: string };

export interface BenchState {
  readonly parts: readonly BenchPart[];
  readonly supply: BenchSupply;
  readonly meter: BenchMeter;
  readonly fault: BenchFault | null;
  /** Increments on every change to the electrical circuit (not the meter). */
  readonly revision: number;
}

export type SafetyCode = MeterHazardCode | "component-change-energized";

export interface SafetyEvent {
  readonly code: SafetyCode;
  readonly severity: "violation" | "technique";
  readonly message: string;
  readonly t: number;
}

export interface LoggedReading {
  readonly id: string;
  readonly t: number;
  readonly mode: MultimeterMode;
  readonly red: PostId | null;
  readonly black: PostId | null;
  readonly status: string;
  readonly value: number | null;
  readonly unit: string | null;
  readonly display: string;
  readonly displayUnit: string;
  readonly revision: number;
  readonly hazardCodes: readonly string[];
  /** Parts whose terminals coincide with the probe nodes (voltage / resistance). */
  readonly acrossParts: readonly string[];
  /** Parts carrying the same current as the meter (current mode, series connection). */
  readonly seriesParts: readonly string[];
}

export type BenchAction =
  | { readonly type: "set-supply-voltage"; readonly value: number }
  | { readonly type: "set-current-limit"; readonly value: number }
  | { readonly type: "set-output"; readonly on: boolean }
  | { readonly type: "set-resistance"; readonly partId: string; readonly value: number }
  | { readonly type: "set-switch"; readonly partId: string; readonly closed: boolean }
  | { readonly type: "set-jumper"; readonly partId: string; readonly installed: boolean }
  | { readonly type: "set-meter-mode"; readonly mode: MultimeterMode }
  | { readonly type: "place-probe"; readonly probe: "red" | "black"; readonly postId: PostId | null }
  | { readonly type: "replace-fuse" };

export type RecordedAction = (BenchAction | { readonly type: "log-reading" }) & { readonly t: number };
