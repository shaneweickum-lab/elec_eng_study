import { z } from "zod";

/**
 * Challenge definition contract. Challenges are data: a scenario generator,
 * a list of evaluable tasks and safety rules — never bespoke mini-games.
 */

export const ChallengeModeSchema = z.enum(["guided", "independent", "timed", "mastery"]);
export type ChallengeMode = z.infer<typeof ChallengeModeSchema>;

export const QuantityRefSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("current"), partId: z.string() }),
  z.object({ kind: z.literal("voltage"), partId: z.string() }),
  z.object({ kind: z.literal("supply-current") }),
  z.object({ kind: z.literal("equivalent-resistance") }),
]);
export type QuantityRef = z.infer<typeof QuantityRefSchema>;

const unit = z.enum(["A", "V", "Ω"]);

export const MeasurementSpecSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("dc-voltage"), across: z.string() }),
  /** `through` may name any part, or "supply" for total source current. */
  z.object({ mode: z.literal("dc-current"), through: z.string() }),
  z.object({ mode: z.literal("resistance"), of: z.string() }),
]);
export type MeasurementSpec = z.infer<typeof MeasurementSpecSchema>;

export const TaskSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("numeric-answer"),
    id: z.string(),
    prompt: z.string(),
    quantity: QuantityRefSchema,
    unit,
    tolerance: z.number().positive(),
  }),
  z.object({
    kind: z.literal("measurement"),
    id: z.string(),
    prompt: z.string(),
    measurement: MeasurementSpecSchema,
    /** Reading must be taken on the circuit as it is at submission. */
    requireCurrentRevision: z.boolean().default(false),
  }),
  z.object({
    kind: z.literal("circuit-target"),
    id: z.string(),
    prompt: z.string(),
    quantity: QuantityRefSchema,
    targetFact: z.string(),
    unit,
    tolerance: z.number().positive(),
  }),
  z.object({ kind: z.literal("identify-fault"), id: z.string(), prompt: z.string() }),
  z.object({
    kind: z.literal("evidence"),
    id: z.string(),
    prompt: z.string(),
    minReadings: z.number().int().positive(),
    modes: z.array(z.enum(["dc-voltage", "dc-current", "resistance", "continuity"])),
  }),
]);
export type ChallengeTask = z.infer<typeof TaskSchema>;

export const SafetyRuleSchema = z.enum([
  "de-energize-before-changes",
  "no-ohmmeter-on-energized-circuit",
  "no-ammeter-across-source",
  "no-meter-overcurrent",
]);
export type SafetyRule = z.infer<typeof SafetyRuleSchema>;

export const ChallengeDefinitionSchema = z.object({
  id: z.string(),
  version: z.number().int().positive(),
  order: z.number().int(),
  title: z.string(),
  summary: z.string(),
  briefing: z.array(z.string()),
  difficulty: z.number().int().min(1).max(5),
  tier: z.enum(["tier-1", "tier-2"]),
  targetSkills: z.array(z.string()).min(1),
  prerequisites: z.object({
    lessons: z.array(z.string()),
    challenges: z.array(z.string()),
  }),
  environment: z.literal("training-bench"),
  availableTools: z.array(z.enum(["multimeter", "bench-supply"])),
  scenario: z.object({
    generator: z.enum(["single-resistor", "target-current", "series-three", "parallel-branches", "series-open-fault"]),
  }),
  allowedActions: z.array(z.string()),
  tasks: z.array(TaskSchema).min(1),
  safetyRules: z.array(SafetyRuleSchema),
  hints: z.array(z.object({ id: z.string(), text: z.string() })),
  scoring: z.object({
    passThreshold: z.number().min(0).max(100),
    hintPenalty: z.number().min(0),
    wrongDiagnosisPenalty: z.number().min(0),
    timeLimitSeconds: z.number().int().positive(),
  }),
  rewards: z.object({ xp: z.number().int().nonnegative() }),
  relatedLessons: z.array(z.string()),
});
export type ChallengeDefinition = z.infer<typeof ChallengeDefinitionSchema>;
