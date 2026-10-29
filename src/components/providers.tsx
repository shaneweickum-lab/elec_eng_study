"use client";

import { useEffect } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useProgressStore } from "@/stores/progress-store";
import { prefersReducedMotion, useSettingsStore } from "@/stores/settings-store";

export function Providers({ children }: { children: React.ReactNode }) {
  const hydrate = useProgressStore((s) => s.hydrate);
  const reducedMotion = useSettingsStore((s) => s.reducedMotion);

  useEffect(() => {
    hydrate();
    // Keep tabs in sync when progress changes elsewhere.
    const onStorage = (e: StorageEvent) => {
      if (e.key === "iea.progress.v1") hydrate();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [hydrate]);

  useEffect(() => {
    document.documentElement.dataset.reducedMotion = String(prefersReducedMotion(reducedMotion));
  }, [reducedMotion]);

  return <TooltipProvider delayDuration={300}>{children}</TooltipProvider>;
}
