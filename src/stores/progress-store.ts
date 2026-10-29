"use client";

import { create } from "zustand";
import type { Lesson } from "@/content/curriculum";
import { recordAttempt, recordKnowledgeCheck, startLesson } from "@/domain/progress/progress";
import { LocalProgressRepository, type ProgressRepository } from "@/domain/progress/repository";
import { emptyProgress, ProgressSchema, type AttemptRecord, type Progress, type SavedProject } from "@/domain/progress/schema";

/**
 * Learner progress, persisted through a ProgressRepository. Local mode uses
 * browser localStorage; the repository boundary is where a Supabase
 * implementation plugs in.
 */
interface ProgressStore {
  progress: Progress;
  hydrated: boolean;
  hydrate(): void;
  startLesson(lesson: Lesson): void;
  submitKnowledgeCheck(lesson: Lesson, score: number): void;
  addAttempt(attempt: AttemptRecord): void;
  saveProject(project: SavedProject): void;
  deleteProject(id: string): void;
  importProgress(json: string): { ok: boolean; error?: string };
  reset(): void;
}

let repository: ProgressRepository | null = null;
function repo(): ProgressRepository | null {
  if (typeof window === "undefined") return null;
  repository ??= new LocalProgressRepository(window.localStorage);
  return repository;
}

export const useProgressStore = create<ProgressStore>((set, get) => {
  const commit = (progress: Progress) => {
    set({ progress });
    repo()?.save(progress);
  };
  const now = () => new Date().toISOString();
  return {
    progress: emptyProgress("1970-01-01T00:00:00.000Z"),
    hydrated: false,
    hydrate() {
      const r = repo();
      if (!r) return;
      set({ progress: r.load(), hydrated: true });
    },
    startLesson(lesson) {
      const next = startLesson(get().progress, lesson, now());
      if (next !== get().progress) commit(next);
    },
    submitKnowledgeCheck(lesson, score) {
      commit(recordKnowledgeCheck(get().progress, lesson, score, now()));
    },
    addAttempt(attempt) {
      commit(recordAttempt(get().progress, attempt));
    },
    saveProject(project) {
      const projects = [...get().progress.projects.filter((p) => p.id !== project.id), project];
      commit({ ...get().progress, projects });
    },
    deleteProject(id) {
      commit({ ...get().progress, projects: get().progress.projects.filter((p) => p.id !== id) });
    },
    importProgress(json) {
      try {
        const parsed = ProgressSchema.safeParse(JSON.parse(json));
        if (!parsed.success) return { ok: false, error: "The file is not a valid progress export." };
        commit(parsed.data);
        return { ok: true };
      } catch {
        return { ok: false, error: "The file could not be read as JSON." };
      }
    },
    reset() {
      repo()?.clear();
      set({ progress: emptyProgress() });
      repo()?.save(get().progress);
    },
  };
});
