import { LESSONS, SKILLS, type Lesson } from "@/content/curriculum";
import { CHALLENGES } from "@/domain/challenges/definitions";
import type { ChallengeDefinition, ChallengeMode } from "@/domain/challenges/schema";
import type { AttemptRecord, Progress } from "./schema";

/* -------------------------------------------------------------- lessons */

export function startLesson(progress: Progress, lesson: Lesson, now: string): Progress {
  if (progress.lessons[lesson.slug]) return progress;
  return {
    ...progress,
    lessons: { ...progress.lessons, [lesson.slug]: { status: "in-progress", startedAt: now, contentVersion: lesson.contentVersion, checks: [] } },
  };
}

/** Record a knowledge-check result. A lesson completes only when its check is passed. */
export function recordKnowledgeCheck(progress: Progress, lesson: Lesson, score: number, now: string): Progress {
  const started = startLesson(progress, lesson, now);
  const current = started.lessons[lesson.slug]!;
  const passed = score >= lesson.knowledgeCheck.passThreshold;
  return {
    ...started,
    lessons: {
      ...started.lessons,
      [lesson.slug]: {
        ...current,
        contentVersion: lesson.contentVersion,
        status: passed || current.status === "completed" ? "completed" : "in-progress",
        completedAt: current.completedAt ?? (passed ? now : undefined),
        checks: [...current.checks, { at: now, score, passed, contentVersion: lesson.contentVersion }],
      },
    },
  };
}

export const isLessonComplete = (progress: Progress, slug: string) => progress.lessons[slug]?.status === "completed";

export function missingLessonPrerequisites(progress: Progress, lesson: Lesson): string[] {
  return lesson.prerequisites.required.filter((slug) => !isLessonComplete(progress, slug));
}

/* ----------------------------------------------------------- challenges */

export function recordAttempt(progress: Progress, attempt: AttemptRecord): Progress {
  return { ...progress, attempts: [...progress.attempts, attempt] };
}

export const isChallengePassed = (progress: Progress, id: string) => progress.attempts.some((a) => a.challengeId === id && a.passed);

export function challengeLockReasons(progress: Progress, challenge: ChallengeDefinition): string[] {
  const reasons: string[] = [];
  for (const slug of challenge.prerequisites.lessons) {
    if (!isLessonComplete(progress, slug)) {
      const lesson = LESSONS.find((l) => l.slug === slug);
      reasons.push(`Complete the lesson "${lesson?.title ?? slug}"`);
    }
  }
  for (const id of challenge.prerequisites.challenges) {
    if (!isChallengePassed(progress, id)) {
      const c = CHALLENGES.find((x) => x.id === id);
      reasons.push(`Pass the challenge "${c?.title ?? id}"`);
    }
  }
  return reasons;
}

/* -------------------------------------------------------------- mastery */

export type MasteryLevel = "not-started" | "developing" | "proficient" | "mastered";

export interface SkillMastery {
  readonly skillId: string;
  readonly level: MasteryLevel;
  /** 0–1 progress toward mastery, for display. */
  readonly progress: number;
  /** Distinct scenarios (challenge + seed) passed safely outside guided mode. */
  readonly independentScenarios: number;
  readonly guidedScenarios: number;
  readonly masteryAssessmentPassed: boolean;
  readonly knowledgeDemonstrated: boolean;
  readonly lastDemonstrated?: string;
}

/**
 * Evidence-based skill model.
 *  • Evidence comes only from passed attempts with no safety violations.
 *  • Each distinct scenario (challenge id + seed) counts once — repeating an
 *    identical scenario adds nothing.
 *  • Guided attempts and knowledge checks show the skill is developing but
 *    cannot reach proficiency on their own.
 *  • Proficient: ≥ 2 distinct independent/timed/mastery scenarios.
 *  • Mastered: proficient and at least one mastery-mode pass.
 */
export function computeSkillMastery(progress: Progress): Record<string, SkillMastery> {
  const result: Record<string, SkillMastery> = {};
  for (const skill of SKILLS) {
    const independent = new Set<string>();
    const guided = new Set<string>();
    let masteryPassed = false;
    let last: string | undefined;
    for (const attempt of progress.attempts) {
      if (!attempt.passed || !attempt.safetyPassed) continue;
      const def = CHALLENGES.find((c) => c.id === attempt.challengeId);
      if (!def?.targetSkills.includes(skill.id)) continue;
      const scenario = `${attempt.challengeId}:${attempt.seed}`;
      if (attempt.mode === "guided") guided.add(scenario);
      else independent.add(scenario);
      if (attempt.mode === "mastery") masteryPassed = true;
      if (!last || attempt.submittedAt > last) last = attempt.submittedAt;
    }
    const knowledge = LESSONS.some((l) => l.skills.includes(skill.id) && isLessonComplete(progress, l.slug));
    const proficient = independent.size >= 2;
    const level: MasteryLevel = proficient && masteryPassed ? "mastered" : proficient ? "proficient" : independent.size + guided.size > 0 || knowledge ? "developing" : "not-started";
    const progressValue = Math.min(1, (knowledge ? 0.1 : 0) + Math.min(guided.size, 2) * 0.1 + Math.min(independent.size, 2) * 0.3 + (masteryPassed ? 0.2 : 0));
    result[skill.id] = {
      skillId: skill.id,
      level,
      progress: level === "mastered" ? 1 : progressValue,
      independentScenarios: independent.size,
      guidedScenarios: guided.size,
      masteryAssessmentPassed: masteryPassed,
      knowledgeDemonstrated: knowledge,
      lastDemonstrated: last,
    };
  }
  return result;
}

/* ------------------------------------------------------------------ XP */

const MODE_XP: Record<ChallengeMode, number> = { guided: 0.6, independent: 1, timed: 1.2, mastery: 1.5 };

/**
 * Engagement XP — rewards activity, deliberately separate from mastery.
 * Repeating the same challenge pays half as much each time, so XP cannot be
 * farmed from an easy activity.
 */
export function computeXp(progress: Progress): number {
  let xp = 0;
  for (const lesson of LESSONS) {
    if (isLessonComplete(progress, lesson.slug)) xp += 100;
  }
  const passesByChallenge = new Map<string, number>();
  const ordered = [...progress.attempts].sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
  for (const attempt of ordered) {
    const def = CHALLENGES.find((c) => c.id === attempt.challengeId);
    if (!def) continue;
    if (!attempt.passed) {
      xp += 5; // effort
      continue;
    }
    const n = passesByChallenge.get(def.id) ?? 0;
    passesByChallenge.set(def.id, n + 1);
    xp += Math.round(def.rewards.xp * MODE_XP[attempt.mode] * 0.5 ** n);
  }
  return xp;
}

export function levelFromXp(xp: number): { level: number; current: number; next: number } {
  let level = 1;
  let threshold = 200;
  let floor = 0;
  while (xp >= floor + threshold) {
    floor += threshold;
    level += 1;
    threshold = Math.round(threshold * 1.35);
  }
  return { level, current: xp - floor, next: threshold };
}

/* -------------------------------------------------------- achievements */

export interface Achievement {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly earned: boolean;
}

export function computeAchievements(progress: Progress): Achievement[] {
  const safeAttempts = progress.attempts.filter((a) => a.passed && a.safetyPassed).length;
  const tier1Challenges = CHALLENGES.filter((c) => c.tier === "tier-1");
  return [
    { id: "first-steps", title: "First Steps", description: "Complete your first lesson.", earned: Object.values(progress.lessons).some((l) => l.status === "completed") },
    { id: "safety-first", title: "Safety First", description: "Complete Electrical Safety Fundamentals.", earned: isLessonComplete(progress, "electrical-safety-fundamentals") },
    { id: "ohms-apprentice", title: "Ohm's Apprentice", description: "Complete the Ohm's Law lesson.", earned: isLessonComplete(progress, "ohms-law") },
    { id: "first-circuit", title: "Bench Debut", description: "Pass your first simulator challenge.", earned: progress.attempts.some((a) => a.passed) },
    { id: "safe-hands", title: "Safe Hands", description: "Pass five challenge attempts with no safety violations.", earned: safeAttempts >= 5 },
    { id: "troubleshooter", title: "Troubleshooter", description: "Diagnose an open circuit from measurements.", earned: isChallengePassed(progress, "open-circuit-diagnosis") },
    { id: "bench-certified", title: "Bench Ready", description: "Pass every Tier 1 bench challenge.", earned: tier1Challenges.every((c) => isChallengePassed(progress, c.id)) },
    { id: "mastery", title: "Demonstrated Mastery", description: "Pass a challenge in mastery mode with no safety violations.", earned: progress.attempts.some((a) => a.mode === "mastery" && a.passed && a.safetyPassed) },
  ];
}

/* ------------------------------------------------------ recommendations */

export function recommendedNextLesson(progress: Progress): Lesson | undefined {
  return LESSONS.find((l) => !isLessonComplete(progress, l.slug) && missingLessonPrerequisites(progress, l).length === 0);
}

export function recommendedNextChallenge(progress: Progress): ChallengeDefinition | undefined {
  return [...CHALLENGES]
    .sort((a, b) => a.order - b.order)
    .find((c) => !isChallengePassed(progress, c.id) && challengeLockReasons(progress, c).length === 0);
}

/**
 * Readiness for the platform's own Tier assessment: the share of the tier's
 * skills at proficient or better. Not a prediction of any employer exam.
 */
export function assessmentReadiness(progress: Progress, tier: "tier-1" | "tier-2"): { ratio: number; proficient: number; total: number } {
  const mastery = computeSkillMastery(progress);
  const skills = SKILLS.filter((s) => s.tier === tier);
  const proficient = skills.filter((s) => {
    const level = mastery[s.id]?.level;
    return level === "proficient" || level === "mastered";
  }).length;
  return { ratio: skills.length === 0 ? 0 : proficient / skills.length, proficient, total: skills.length };
}

export function tierCompletion(progress: Progress, tier: "tier-1" | "tier-2"): { completed: number; available: number } {
  const lessons = LESSONS.filter((l) => (tier === "tier-1" ? l.moduleId.startsWith("t1-") : l.moduleId.startsWith("t2-")));
  return { completed: lessons.filter((l) => isLessonComplete(progress, l.slug)).length, available: lessons.length };
}

export interface HistoryEntry {
  readonly at: string;
  readonly kind: "lesson-started" | "lesson-completed" | "knowledge-check" | "attempt";
  readonly title: string;
  readonly detail: string;
  readonly href: string;
}

export function studyHistory(progress: Progress): HistoryEntry[] {
  const entries: HistoryEntry[] = [];
  for (const [slug, record] of Object.entries(progress.lessons)) {
    const lesson = LESSONS.find((l) => l.slug === slug);
    const title = lesson?.title ?? slug;
    entries.push({ at: record.startedAt, kind: "lesson-started", title, detail: "Lesson started", href: `/academy/lesson/${slug}` });
    for (const check of record.checks) {
      entries.push({ at: check.at, kind: "knowledge-check", title, detail: `Knowledge check ${Math.round(check.score * 100)} %${check.passed ? " — passed" : ""}`, href: `/academy/lesson/${slug}` });
    }
    if (record.completedAt) entries.push({ at: record.completedAt, kind: "lesson-completed", title, detail: "Lesson completed", href: `/academy/lesson/${slug}` });
  }
  for (const attempt of progress.attempts) {
    const def = CHALLENGES.find((c) => c.id === attempt.challengeId);
    entries.push({
      at: attempt.submittedAt,
      kind: "attempt",
      title: def?.title ?? attempt.challengeId,
      detail: `${attempt.mode} · score ${attempt.score} · safety ${attempt.safetyScore}${attempt.passed ? " · passed" : ""}`,
      href: `/challenges/${attempt.challengeId}`,
    });
  }
  return entries.sort((a, b) => b.at.localeCompare(a.at));
}
