import { LessonSchema, type Lesson } from "./schema";
import { ohmsLawLesson } from "./lessons/ohms-law";
import { electricalSafetyLesson } from "./lessons/electrical-safety";
import { ALL_MODULES } from "./modules";

export * from "./schema";
export * from "./modules";
export * from "./skills";

/** Authored lessons, in recommended study order. Validated at load. */
export const LESSONS: readonly Lesson[] = [electricalSafetyLesson, ohmsLawLesson].map((l) => LessonSchema.parse(l));

export function getLesson(slug: string): Lesson | undefined {
  return LESSONS.find((l) => l.slug === slug);
}

export function moduleOfLesson(slug: string) {
  return ALL_MODULES.find((m) => m.lessonSlugs.includes(slug));
}
