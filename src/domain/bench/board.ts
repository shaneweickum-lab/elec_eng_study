import { BOARD_COLS, BOARD_ROWS, type BenchPart, type BenchPost, type PostId } from "./types";

export const POSTS: readonly BenchPost[] = Array.from({ length: BOARD_ROWS * BOARD_COLS }, (_, i) => ({
  id: `T${i + 1}`,
  label: `T${i + 1}`,
  col: i % BOARD_COLS,
  row: Math.floor(i / BOARD_COLS),
}));

const byId = new Map(POSTS.map((p) => [p.id, p]));

export function post(id: PostId): BenchPost {
  const p = byId.get(id);
  if (!p) throw new Error(`Unknown post ${id}`);
  return p;
}

export function postAt(col: number, row: number): PostId {
  return `T${row * BOARD_COLS + col + 1}`;
}

/** Orientation of a part on the board; parts must join adjacent posts. */
export function partAxis(part: Pick<BenchPart, "a" | "b">): "x" | "y" {
  const a = post(part.a);
  const b = post(part.b);
  if (a.row === b.row && Math.abs(a.col - b.col) === 1) return "x";
  if (a.col === b.col && Math.abs(a.row - b.row) === 1) return "y";
  throw new Error(`Part between ${part.a} and ${part.b} does not join adjacent posts`);
}

/** Validate a layout: adjacent posts, unique ids, one part per post pair. */
export function validateLayout(parts: readonly BenchPart[]): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  const spans = new Set<string>();
  for (const part of parts) {
    if (ids.has(part.id)) errors.push(`Duplicate part id ${part.id}`);
    ids.add(part.id);
    try {
      partAxis(part);
    } catch (e) {
      errors.push((e as Error).message);
    }
    const span = [part.a, part.b].sort().join("-");
    if (spans.has(span)) errors.push(`Two parts share posts ${span}`);
    spans.add(span);
  }
  return errors;
}

/** Parts sorted so the lower-numbered post comes first (for consistent display). */
export function partPosts(part: BenchPart): [BenchPost, BenchPost] {
  return [post(part.a), post(part.b)];
}
