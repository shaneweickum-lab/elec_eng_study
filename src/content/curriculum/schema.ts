import { z } from "zod";

/** Versioned, data-driven curriculum contract. */

export const ReviewStatusSchema = z.enum(["draft", "pending-technical-review", "reviewed"]);

export const QuestionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("single-choice"),
    id: z.string(),
    prompt: z.string(),
    options: z.array(z.object({ id: z.string(), text: z.string() })).min(2),
    correct: z.string(),
    explanation: z.string(),
  }),
  z.object({
    kind: z.literal("numeric"),
    id: z.string(),
    prompt: z.string(),
    answer: z.number(),
    unit: z.string(),
    /** Relative tolerance. */
    tolerance: z.number().positive(),
    explanation: z.string(),
  }),
]);
export type Question = z.infer<typeof QuestionSchema>;

export const BlockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), body: z.string() }),
  z.object({ type: z.literal("list"), items: z.array(z.string()), ordered: z.boolean().default(false) }),
  z.object({ type: z.literal("formula"), expressions: z.array(z.string()), caption: z.string().optional() }),
  z.object({ type: z.literal("callout"), tone: z.enum(["safety", "note", "tip"]), title: z.string(), body: z.string() }),
  z.object({ type: z.literal("worked-example"), title: z.string(), given: z.array(z.string()), steps: z.array(z.string()), result: z.string() }),
  z.object({ type: z.literal("demo"), demo: z.enum(["ohms-law-explorer", "series-parallel-explorer"]) }),
  z.object({
    type: z.literal("table"),
    headers: z.array(z.string()),
    rows: z.array(z.array(z.string())),
    caption: z.string().optional(),
  }),
]);
export type Block = z.infer<typeof BlockSchema>;

export const LessonSchema = z.object({
  slug: z.string(),
  moduleId: z.string(),
  title: z.string(),
  subtitle: z.string(),
  contentVersion: z.string(),
  reviewStatus: ReviewStatusSchema,
  estimatedMinutes: z.number().int().positive(),
  objectives: z.array(z.string()).min(1),
  prerequisites: z.object({ required: z.array(z.string()), recommended: z.array(z.string()) }),
  skills: z.array(z.string()),
  sections: z.array(z.object({ id: z.string(), title: z.string(), blocks: z.array(BlockSchema) })).min(1),
  knowledgeCheck: z.object({ passThreshold: z.number().min(0).max(1), questions: z.array(QuestionSchema).min(1) }),
  challenges: z.array(z.string()),
  masteryCriteria: z.array(z.string()),
  references: z.array(z.string()),
});
export type Lesson = z.infer<typeof LessonSchema>;

export const ModuleSchema = z.object({
  id: z.string(),
  tier: z.enum(["tier-1", "tier-2"]),
  order: z.number().int(),
  title: z.string(),
  summary: z.string(),
  status: z.enum(["available", "planned"]),
  lessonSlugs: z.array(z.string()),
  skills: z.array(z.string()),
});
export type CurriculumModule = z.infer<typeof ModuleSchema>;

export const SkillSchema = z.object({
  id: z.string(),
  name: z.string(),
  tier: z.enum(["tier-1", "tier-2"]),
  category: z.enum(["safety", "theory", "instruments", "circuits", "troubleshooting"]),
  description: z.string(),
  prerequisites: z.array(z.string()),
});
export type Skill = z.infer<typeof SkillSchema>;
