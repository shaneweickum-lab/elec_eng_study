import { z } from "zod";
import { ChallengeModeSchema } from "@/domain/challenges/schema";

/** Persisted learner progress (local mode). Versioned so stored data can be migrated. */
export const PROGRESS_VERSION = 1 as const;

export const KnowledgeCheckRecordSchema = z.object({
  at: z.string(),
  score: z.number().min(0).max(1),
  passed: z.boolean(),
  contentVersion: z.string(),
});

export const LessonProgressSchema = z.object({
  status: z.enum(["in-progress", "completed"]),
  startedAt: z.string(),
  completedAt: z.string().optional(),
  contentVersion: z.string(),
  checks: z.array(KnowledgeCheckRecordSchema),
});
export type LessonProgress = z.infer<typeof LessonProgressSchema>;

export const AttemptRecordSchema = z.object({
  id: z.string(),
  challengeId: z.string(),
  definitionVersion: z.number().int(),
  seed: z.number().int().nonnegative(),
  mode: ChallengeModeSchema,
  startedAt: z.string(),
  submittedAt: z.string(),
  durationSeconds: z.number().nonnegative(),
  hintsUsed: z.number().int().nonnegative(),
  passed: z.boolean(),
  score: z.number(),
  safetyScore: z.number(),
  safetyPassed: z.boolean(),
  /** Complete learner action log (bench actions and logged readings, with timestamps). Enables deterministic replay. */
  actions: z.array(z.looseObject({ type: z.string(), t: z.number() })),
  /** Raw numeric answers as entered, keyed by task id. */
  answers: z.record(z.string(), z.string()).default({}),
  diagnosis: z.string().optional(),
  wrongDiagnoses: z.number().int().nonnegative().default(0),
  readings: z.number().int().nonnegative(),
  safetyCodes: z.array(z.string()),
});
export type AttemptRecord = z.infer<typeof AttemptRecordSchema>;

export const SavedProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  savedAt: z.string(),
  preset: z.string(),
  /** Serialized bench state. Validated structurally when loaded. */
  bench: z.unknown(),
});
export type SavedProject = z.infer<typeof SavedProjectSchema>;

export const ProgressSchema = z.object({
  version: z.literal(PROGRESS_VERSION),
  createdAt: z.string(),
  lessons: z.record(z.string(), LessonProgressSchema),
  attempts: z.array(AttemptRecordSchema),
  projects: z.array(SavedProjectSchema),
});
export type Progress = z.infer<typeof ProgressSchema>;

export function emptyProgress(now = new Date().toISOString()): Progress {
  return { version: PROGRESS_VERSION, createdAt: now, lessons: {}, attempts: [], projects: [] };
}
