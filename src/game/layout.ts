import { POST_TOP_Z, type AssetDefinition, type Vec3 } from "@iea/voxel-engine";
import { BOARD_COLS, BOARD_ROWS, type BenchPart } from "@/domain/bench/types";
import { post } from "@/domain/bench/board";

/**
 * World placement for Environment A (voxel units, 1 voxel ≈ 1 cm).
 * Pure data: shared by the renderer and by tests.
 */

export const WORLD_UNIT = 2; // screen px per voxel half-width at zoom 1
export const ROOM = { width: 320, depth: 224, tile: 32 } as const;
export const BENCH = { x: 64, y: 2, length: 200, depth: 70, height: 78 } as const;
export const SURFACE_Z = BENCH.height + 1;
export const SUPPLY_POS: Vec3 = { x: 76, y: 30, z: SURFACE_Z };
export const BOARD = { x: 118, y: 22, z: SURFACE_Z, spacing: 16, margin: 8 } as const;
export const METER_POS: Vec3 = { x: 226, y: 40, z: SURFACE_Z };
export const CABINET_POS: Vec3 = { x: 280, y: 2, z: 0 };
export const TOOLBOX_POS: Vec3 = { x: 20, y: 64, z: 0 };
export const PROBE_REST = { red: { x: 246, y: 50, z: SURFACE_Z }, black: { x: 252, y: 50, z: SURFACE_Z } } as const;

export const BOARD_DEF: AssetDefinition = { type: "terminal-board", params: { cols: BOARD_COLS, rows: BOARD_ROWS, spacing: BOARD.spacing, margin: BOARD.margin } };

/** World position of a post's top (where probes and leads touch). */
export function postTop(postId: string): Vec3 {
  const p = post(postId);
  return { x: BOARD.x + BOARD.margin + p.col * BOARD.spacing, y: BOARD.y + BOARD.margin + p.row * BOARD.spacing, z: BOARD.z + POST_TOP_Z };
}

/** Asset definition and world position for a part spanning two posts. */
export function partPlacement(part: BenchPart): { def: AssetDefinition; pos: Vec3; axis: "x" | "y" } {
  const a = post(part.a);
  const b = post(part.b);
  const axis: "x" | "y" = a.row === b.row ? "x" : "y";
  const first = axis === "x" ? (a.col < b.col ? part.a : part.b) : a.row < b.row ? part.a : part.b;
  const top = postTop(first);
  const length = BOARD.spacing;
  const offset = axis === "x" ? { x: 0, y: -2 } : { x: -2, y: 0 };
  switch (part.kind) {
    case "resistor":
      return { def: { type: "resistor", params: { axis, length, resistance: part.resistance } }, pos: { x: top.x + offset.x, y: top.y + offset.y, z: top.z }, axis };
    case "switch":
      return { def: { type: "knife-switch", params: { axis, length, closed: part.closed } }, pos: { x: top.x + offset.x * 1.25, y: top.y + offset.y * 1.25, z: BOARD.z + 2 }, axis };
    case "jumper":
      return { def: { type: "jumper-link", params: { axis, length } }, pos: { x: top.x + offset.x, y: top.y + offset.y, z: top.z - 1 }, axis };
  }
}

export function partMidpoint(part: BenchPart): Vec3 {
  const a = postTop(part.a);
  const b = postTop(part.b);
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: a.z + 2 };
}
