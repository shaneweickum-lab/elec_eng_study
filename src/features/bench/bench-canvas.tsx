"use client";

import { useEffect, useRef, useState } from "react";
import { BenchRenderer, type BenchView, type RendererStats, type SceneEvent } from "@/game/bench-renderer";
import { useBenchStore } from "@/stores/bench-store";
import { prefersReducedMotion, useSettingsStore } from "@/stores/settings-store";
import { usePhysicalSolution } from "./use-bench-view";

export interface BenchCanvasHandle {
  zoomBy(factor: number): void;
  panBy(dx: number, dy: number): void;
  resetView(): void;
  overview(): void;
}

/**
 * Hosts the PixiJS renderer. Loaded client-side only (dynamic import), so
 * PixiJS never runs during server rendering.
 */
export default function BenchCanvas({
  onEvent,
  handleRef,
  onStats,
}: {
  onEvent: (event: SceneEvent) => void;
  handleRef: React.RefObject<BenchCanvasHandle | null>;
  onStats?: (stats: RendererStats) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const renderer = useRef<BenchRenderer | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const session = useBenchStore((s) => s.session);
  const selection = useBenchStore((s) => s.selection);
  const settings = useSettingsStore();
  const physical = usePhysicalSolution(session);
  const eventRef = useRef(onEvent);
  eventRef.current = onEvent;

  useEffect(() => {
    let cancelled = false;
    let instance: BenchRenderer | null = null;
    BenchRenderer.create(host.current!, (e) => eventRef.current(e))
      .then((r) => {
        if (cancelled) {
          r.destroy();
          return;
        }
        instance = r;
        renderer.current = r;
        handleRef.current = {
          zoomBy: (f) => r.zoomBy(f),
          panBy: (dx, dy) => r.panBy(dx, dy),
          resetView: () => r.resetView(),
          overview: () => r.overview(),
        };
        // Test/automation hook: locate posts on the canvas without guessing pixels.
        (window as unknown as { __ieaBench?: unknown }).__ieaBench = { postScreenPosition: (id: string) => r.postScreenPosition(id) };
        setReady(true);
      })
      .catch((error: unknown) => {
        console.error(error);
        setFailed(error instanceof Error ? error.message : String(error));
      });
    return () => {
      cancelled = true;
      instance?.destroy();
      renderer.current = null;
      handleRef.current = null;
    };
  }, [handleRef]);

  useEffect(() => {
    if (!ready || !session || !renderer.current) return;
    const { state, reading } = session;
    const solved = physical?.status === "ok" ? physical : null;
    const view: BenchView = {
      parts: state.parts.map((part) => ({ part, current: solved ? (solved.componentCurrents[part.id] ?? null) : null })),
      supply: {
        voltage: state.supply.voltage,
        current: solved && state.supply.outputOn ? (solved.componentCurrents[state.supply.id] ?? null) : null,
        outputOn: state.supply.outputOn,
        regulation: solved?.sourceModes[state.supply.id] === "constant-current" ? "cc" : "cv",
        showCurrent: state.supply.showCurrent,
        positivePost: state.supply.positivePost,
        negativePost: state.supply.negativePost,
      },
      meter: {
        mode: state.meter.mode,
        display: reading.display,
        displayUnit: reading.displayUnit,
        red: state.meter.red,
        black: state.meter.black,
        fuseIntact: state.meter.fuseIntact,
        current: state.meter.mode === "dc-current" && reading.status === "ok" ? reading.value : null,
      },
      selection,
      options: {
        showPostLabels: settings.showPostLabels,
        showPartLabels: settings.showPartLabels,
        showCurrentFlow: settings.showCurrentFlow,
        reducedMotion: prefersReducedMotion(settings.reducedMotion),
        maxDetail: settings.maxDetail,
        showPerformance: settings.showPerformance,
      },
    };
    renderer.current.update(view);
  }, [ready, session, selection, physical, settings]);

  useEffect(() => {
    if (!ready || !onStats || !settings.showPerformance) return;
    const id = window.setInterval(() => renderer.current && onStats(renderer.current.stats()), 500);
    return () => window.clearInterval(id);
  }, [ready, onStats, settings.showPerformance]);

  return (
    <div className="absolute inset-0">
      <div ref={host} className="absolute inset-0 touch-none" data-testid="bench-canvas" data-ready={ready ? "true" : "false"} />
      {!ready && !failed && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">Generating bench geometry…</div>
      )}
      {failed && (
        <div className="absolute inset-0 flex items-center justify-center p-8 text-center text-sm text-danger">
          The isometric view could not start ({failed}). All controls remain available in the side panel.
        </div>
      )}
    </div>
  );
}
