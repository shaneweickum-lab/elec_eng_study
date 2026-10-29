import { z } from "zod";
import { validateLayout } from "./board";
import type { BenchState } from "./types";

/** Runtime validation for bench states loaded from storage (saved projects). */
const post = z.string().regex(/^T([1-9]|1[0-8])$/);
const base = { id: z.string().min(1).max(16), label: z.string().min(1).max(16), a: post, b: post };

export const BenchPartSchema = z.discriminatedUnion("kind", [
  z.object({ ...base, kind: z.literal("resistor"), resistance: z.number().min(1).max(10e6), editable: z.boolean() }),
  z.object({ ...base, kind: z.literal("switch"), closed: z.boolean() }),
  z.object({ ...base, kind: z.literal("jumper"), installed: z.boolean() }),
]);

export const BenchStateSchema = z
  .object({
    parts: z.array(BenchPartSchema).max(40),
    supply: z.object({
      id: z.literal("PS1"),
      positivePost: post,
      negativePost: post,
      voltage: z.number().min(0).max(30),
      currentLimit: z.number().min(0.001).max(5),
      outputOn: z.boolean(),
      voltageEditable: z.boolean(),
      maxVoltage: z.number().positive().max(30),
      showCurrent: z.boolean(),
    }),
    meter: z.object({
      mode: z.enum(["off", "dc-voltage", "dc-current", "resistance", "continuity"]),
      red: post.nullable(),
      black: post.nullable(),
      fuseIntact: z.boolean(),
    }),
    fault: z.null(),
    revision: z.number().int().nonnegative(),
  })
  .refine((s) => validateLayout(s.parts).length === 0, { message: "Invalid part layout" });

export function parseBenchState(input: unknown): BenchState | null {
  const parsed = BenchStateSchema.safeParse(input);
  return parsed.success ? (parsed.data as BenchState) : null;
}
