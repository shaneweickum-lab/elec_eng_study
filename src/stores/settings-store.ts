"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface Settings {
  reducedMotion: "system" | "reduce" | "full";
  showPostLabels: boolean;
  showPartLabels: boolean;
  showCurrentFlow: boolean;
  showPerformance: boolean;
  /** Maximum rasterization detail level (voxel unit in pixels). */
  maxDetail: 4 | 8;
}

interface SettingsStore extends Settings {
  update(patch: Partial<Settings>): void;
  resetSettings(): void;
}

const DEFAULTS: Settings = {
  reducedMotion: "system",
  showPostLabels: true,
  showPartLabels: true,
  showCurrentFlow: true,
  showPerformance: false,
  maxDetail: 8,
};

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      update: (patch) => set(patch),
      resetSettings: () => set(DEFAULTS),
    }),
    {
      name: "iea.settings.v1",
      storage: createJSONStorage(() => localStorage),
      version: 1,
      partialize: ({ update: _u, resetSettings: _r, ...rest }) => rest,
    },
  ),
);

/** Resolve the effective reduced-motion preference. */
export function prefersReducedMotion(setting: Settings["reducedMotion"]): boolean {
  if (setting === "reduce") return true;
  if (setting === "full") return false;
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}
