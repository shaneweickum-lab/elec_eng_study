import { describe, expect, it } from "vitest";
import { getLesson, LESSONS, TIER_1_MODULES, TIER_2_MODULES } from "@/content/curriculum";
import { CHALLENGES } from "@/domain/challenges/definitions";
import { emptyProgress, type AttemptRecord } from "@/domain/progress/schema";
import { LocalProgressRepository, MemoryStorage, PROGRESS_STORAGE_KEY } from "@/domain/progress/repository";
import {
  challengeLockReasons,
  computeAchievements,
  computeSkillMastery,
  computeXp,
  missingLessonPrerequisites,
  recordAttempt,
  recordKnowledgeCheck,
  recommendedNextLesson,
} from "@/domain/progress/progress";

const ohms = getLesson("ohms-law")!;
const safety = getLesson("electrical-safety-fundamentals")!;
const NOW = "2026-10-29T10:00:00.000Z";

const attempt = (overrides: Partial<AttemptRecord>): AttemptRecord => ({
  id: Math.random().toString(36),
  challengeId: "dc-current-basic",
  definitionVersion: 1,
  seed: 1,
  mode: "independent",
  startedAt: NOW,
  submittedAt: NOW,
  durationSeconds: 100,
  hintsUsed: 0,
  passed: true,
  score: 100,
  safetyScore: 100,
  safetyPassed: true,
  actions: [],
  readings: 1,
  safetyCodes: [],
  ...overrides,
});

describe("curriculum", () => {
  it("lists twelve modules per tier and only marks authored modules available", () => {
    expect(TIER_1_MODULES).toHaveLength(12);
    expect(TIER_2_MODULES).toHaveLength(12);
    const available = [...TIER_1_MODULES, ...TIER_2_MODULES].filter((m) => m.status === "available");
    for (const m of available) for (const slug of m.lessonSlugs) expect(getLesson(slug)).toBeDefined();
    expect(TIER_2_MODULES.every((m) => m.status === "planned")).toBe(true);
  });

  it("every lesson defines objectives, checks, mastery criteria and review status", () => {
    for (const lesson of LESSONS) {
      expect(lesson.objectives.length).toBeGreaterThan(0);
      expect(lesson.knowledgeCheck.questions.length).toBeGreaterThan(0);
      expect(lesson.masteryCriteria.length).toBeGreaterThan(0);
      expect(lesson.reviewStatus).not.toBe("reviewed");
      for (const q of lesson.knowledgeCheck.questions) {
        if (q.kind === "single-choice") expect(q.options.map((o) => o.id)).toContain(q.correct);
      }
    }
  });

  it("challenges reference existing lessons and challenges", () => {
    for (const c of CHALLENGES) {
      for (const slug of c.prerequisites.lessons) expect(getLesson(slug)).toBeDefined();
      for (const id of c.prerequisites.challenges) expect(CHALLENGES.some((x) => x.id === id)).toBe(true);
    }
  });
});

describe("prerequisites", () => {
  it("locks the first challenge until the Ohm's law lesson is complete", () => {
    const first = CHALLENGES.find((c) => c.id === "dc-current-basic")!;
    expect(challengeLockReasons(emptyProgress(), first)).toHaveLength(1);
    const p = recordKnowledgeCheck(emptyProgress(), ohms, 1, NOW);
    expect(challengeLockReasons(p, first)).toHaveLength(0);
  });

  it("chains later challenges on earlier passes", () => {
    const second = CHALLENGES.find((c) => c.id === "target-current")!;
    let p = recordKnowledgeCheck(emptyProgress(), ohms, 1, NOW);
    expect(challengeLockReasons(p, second)).toHaveLength(1);
    p = recordAttempt(p, attempt({ passed: false }));
    expect(challengeLockReasons(p, second)).toHaveLength(1);
    p = recordAttempt(p, attempt({}));
    expect(challengeLockReasons(p, second)).toHaveLength(0);
  });

  it("does not complete a lesson on a failed knowledge check", () => {
    const p = recordKnowledgeCheck(emptyProgress(), ohms, 0.5, NOW);
    expect(p.lessons["ohms-law"]!.status).toBe("in-progress");
    expect(missingLessonPrerequisites(p, ohms)).toEqual([]);
  });

  it("recommends lessons in order", () => {
    expect(recommendedNextLesson(emptyProgress())?.slug).toBe(safety.slug);
    const p = recordKnowledgeCheck(emptyProgress(), safety, 1, NOW);
    expect(recommendedNextLesson(p)?.slug).toBe("ohms-law");
  });
});

describe("mastery and XP", () => {
  it("repeating one scenario does not create proficiency", () => {
    let p = emptyProgress();
    for (let i = 0; i < 10; i++) p = recordAttempt(p, attempt({ seed: 5 }));
    expect(computeSkillMastery(p)["ohms-law.calculate"]!.level).toBe("developing");
  });

  it("two distinct independent scenarios make a skill proficient; a mastery pass masters it", () => {
    let p = recordAttempt(emptyProgress(), attempt({ seed: 1 }));
    p = recordAttempt(p, attempt({ seed: 2 }));
    expect(computeSkillMastery(p)["ohms-law.calculate"]!.level).toBe("proficient");
    p = recordAttempt(p, attempt({ seed: 3, mode: "mastery" }));
    expect(computeSkillMastery(p)["ohms-law.calculate"]!.level).toBe("mastered");
  });

  it("guided attempts and unsafe passes are not competency evidence", () => {
    let p = recordAttempt(emptyProgress(), attempt({ seed: 1, mode: "guided" }));
    p = recordAttempt(p, attempt({ seed: 2, mode: "guided" }));
    p = recordAttempt(p, attempt({ seed: 3, safetyPassed: false }));
    p = recordAttempt(p, attempt({ seed: 4, safetyPassed: false }));
    const m = computeSkillMastery(p)["ohms-law.calculate"]!;
    expect(m.level).toBe("developing");
    expect(m.independentScenarios).toBe(0);
  });

  it("XP has diminishing returns for repeated passes", () => {
    let p = emptyProgress();
    const gains: number[] = [];
    for (let i = 0; i < 4; i++) {
      const before = computeXp(p);
      p = recordAttempt(p, attempt({ seed: i, submittedAt: `2026-10-29T10:0${i}:00.000Z` }));
      gains.push(computeXp(p) - before);
    }
    expect(gains).toEqual([60, 30, 15, 8]);
  });

  it("derives achievements", () => {
    const p = recordKnowledgeCheck(emptyProgress(), ohms, 1, NOW);
    const earned = computeAchievements(p).filter((a) => a.earned).map((a) => a.id);
    expect(earned).toEqual(["first-steps", "ohms-apprentice"]);
  });
});

describe("local persistence", () => {
  it("round-trips progress through storage", () => {
    const storage = new MemoryStorage();
    const repo = new LocalProgressRepository(storage);
    const p = recordAttempt(recordKnowledgeCheck(emptyProgress(), ohms, 1, NOW), attempt({}));
    repo.save(p);
    expect(new LocalProgressRepository(storage).load()).toEqual(p);
  });

  it("recovers from corrupted data without losing it", () => {
    const storage = new MemoryStorage();
    storage.setItem(PROGRESS_STORAGE_KEY, "{not json");
    const loaded = new LocalProgressRepository(storage).load();
    expect(loaded.attempts).toEqual([]);
    expect(storage.keys().some((k) => k.includes("corrupt"))).toBe(true);
  });

  it("rejects structurally invalid data", () => {
    const storage = new MemoryStorage();
    storage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({ version: 99 }));
    expect(new LocalProgressRepository(storage).load().version).toBe(1);
  });
});
