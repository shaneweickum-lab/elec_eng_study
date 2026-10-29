"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Expand, Keyboard, Maximize2, Minus, Plus, X } from "lucide-react";
import type { MultimeterMode } from "@iea/circuit-sim";
import type { RendererStats, SceneEvent } from "@/game/bench-renderer";
import { useBenchStore } from "@/stores/bench-store";
import { useSettingsStore } from "@/stores/settings-store";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BenchSchematic } from "./bench-schematic";
import type { BenchCanvasHandle } from "./bench-canvas";
import { CircuitList, Inspector, MeterControls, ReadingsLog, SafetyFeed, SupplyControls } from "./panels";

const BenchCanvas = dynamic(() => import("./bench-canvas"), { ssr: false });

const KEY_MODES: Record<string, MultimeterMode> = { "1": "off", "2": "dc-voltage", "3": "dc-current", "4": "resistance", "5": "continuity" };

const SHORTCUTS: Array<[string, string]> = [
  ["Drag / Arrow keys", "Pan the view"],
  ["Scroll / + −", "Zoom"],
  ["0", "Frame the work area"],
  ["O", "Overview of the room"],
  ["1 – 5", "Meter: off, V⎓, A⎓, Ω, continuity"],
  ["R / B", "Put the red / black probe on the selected terminal"],
  ["L", "Log the current meter reading"],
  ["P", "Toggle the supply output"],
  ["Esc", "Clear selection"],
];

export interface BenchWorkspaceProps {
  title: string;
  subtitle?: string;
  backHref: string;
  backLabel: string;
  headerExtra?: React.ReactNode;
  /** Primary task panel (challenge brief, workshop tools). Rendered as the first tab. */
  taskPanel?: React.ReactNode;
  taskLabel?: string;
  /** Overlay over the canvas (e.g. a start dialog). */
  overlay?: React.ReactNode;
}

export function BenchWorkspace({ title, subtitle, backHref, backLabel, headerExtra, taskPanel, taskLabel = "Task", overlay }: BenchWorkspaceProps) {
  const session = useBenchStore((s) => s.session);
  const selection = useBenchStore((s) => s.selection);
  const select = useBenchStore((s) => s.select);
  const act = useBenchStore((s) => s.act);
  const log = useBenchStore((s) => s.log);
  const clearNotice = useBenchStore((s) => s.clearNotice);
  const showPerformance = useSettingsStore((s) => s.showPerformance);
  const canvas = useRef<BenchCanvasHandle | null>(null);
  const tooltip = useRef<HTMLDivElement>(null);
  const [hoverLabel, setHoverLabel] = useState<string | null>(null);
  const [tab, setTab] = useState(taskPanel ? "task" : "inspect");
  const [help, setHelp] = useState(false);
  const [stats, setStats] = useState<RendererStats | null>(null);

  const onEvent = useCallback(
    (event: SceneEvent) => {
      if (event.type === "hover") {
        setHoverLabel(event.label);
        if (tooltip.current) tooltip.current.style.transform = `translate(${event.x + 14}px, ${event.y + 12}px)`;
        return;
      }
      if (event.type === "select") {
        select(event.target);
        return;
      }
      const state = useBenchStore.getState().session?.state;
      if (!state) return;
      if (event.target.kind === "supply" && event.hotspot === "output-button") act({ type: "set-output", on: !state.supply.outputOn });
      if (event.target.kind === "part" && event.hotspot === "blade") {
        const part = state.parts.find((p) => p.id === (event.target as { id: string }).id);
        if (part?.kind === "switch") act({ type: "set-switch", partId: part.id, closed: !part.closed });
      }
    },
    [act, select],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable || e.metaKey || e.ctrlKey || e.altKey) return;
      const c = canvas.current;
      const state = useBenchStore.getState();
      const step = 60;
      switch (e.key) {
        case "ArrowLeft":
        case "a":
          c?.panBy(step, 0);
          break;
        case "ArrowRight":
        case "d":
          c?.panBy(-step, 0);
          break;
        case "ArrowUp":
        case "w":
          c?.panBy(0, step);
          break;
        case "ArrowDown":
        case "s":
          c?.panBy(0, -step);
          break;
        case "+":
        case "=":
          c?.zoomBy(1.25);
          break;
        case "-":
        case "_":
          c?.zoomBy(0.8);
          break;
        case "0":
          c?.resetView();
          break;
        case "o":
        case "O":
          c?.overview();
          break;
        case "l":
        case "L":
          log();
          break;
        case "p":
        case "P":
          if (state.session) act({ type: "set-output", on: !state.session.state.supply.outputOn });
          break;
        case "r":
        case "R":
        case "b":
        case "B":
          if (state.selection?.kind === "post") act({ type: "place-probe", probe: e.key.toLowerCase() === "r" ? "red" : "black", postId: state.selection.id });
          break;
        case "Escape":
          select(null);
          break;
        case "?":
          setHelp(true);
          break;
        default:
          if (KEY_MODES[e.key]) act({ type: "set-meter-mode", mode: KEY_MODES[e.key]! });
          else return;
      }
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [act, log, select]);

  // Any new selection (canvas, lists or keyboard) brings the inspector forward.
  useEffect(() => {
    if (selection) setTab("inspect");
  }, [selection]);

  useEffect(() => {
    if (!session?.notice) return;
    const id = window.setTimeout(clearNotice, 6000);
    return () => window.clearTimeout(id);
  }, [session?.notice, clearNotice]);

  return (
    <div className="flex h-dvh flex-col bg-background">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-card/80 px-3">
        <Button asChild variant="ghost" size="sm">
          <Link href={backHref}>
            <ArrowLeft /> {backLabel}
          </Link>
        </Button>
        <div className="h-5 w-px bg-border" />
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold">{title}</h1>
          {subtitle && <p className="truncate text-[11px] text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {headerExtra}
          <Button variant="ghost" size="icon-sm" onClick={() => setHelp(true)} aria-label="Keyboard shortcuts">
            <Keyboard />
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <main className="relative min-w-0 flex-1 overflow-hidden" aria-label="Isometric training bench view">
          <BenchCanvas onEvent={onEvent} handleRef={canvas} onStats={setStats} />
          <div
            ref={tooltip}
            className="pointer-events-none absolute top-0 left-0 z-10 rounded-md border border-border bg-popover/95 px-2 py-1 text-xs whitespace-nowrap shadow-md"
            style={{ display: hoverLabel ? "block" : "none" }}
          >
            {hoverLabel}
          </div>
          {session?.notice && (
            <div role="status" className="absolute top-3 left-1/2 z-20 flex max-w-xl -translate-x-1/2 items-start gap-2 rounded-md border border-amber/40 bg-[#1d1608]/95 px-3 py-2 text-sm text-amber shadow-lg">
              <span>{session.notice}</span>
              <button onClick={clearNotice} aria-label="Dismiss" className="opacity-70 hover:opacity-100">
                <X className="size-4" />
              </button>
            </div>
          )}
          <div className="absolute bottom-3 left-3 z-10 flex items-center gap-1 rounded-md border border-border bg-card/90 p-1 shadow-md">
            <Button variant="ghost" size="icon-sm" onClick={() => canvas.current?.zoomBy(1.25)} aria-label="Zoom in">
              <Plus />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={() => canvas.current?.zoomBy(0.8)} aria-label="Zoom out">
              <Minus />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={() => canvas.current?.resetView()} aria-label="Frame work area">
              <Maximize2 />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={() => canvas.current?.overview()} aria-label="Room overview">
              <Expand />
            </Button>
          </div>
          {showPerformance && stats && (
            <div className="lcd absolute top-3 left-3 z-10 rounded-md border border-border bg-card/90 px-2 py-1 text-[10px] text-muted-foreground">
              {stats.fps} fps · {stats.entities} sprites · {stats.textures} textures · LOD {stats.unit}px · {stats.visibleVoxels.toLocaleString()} visible voxels · bake {stats.bakeMs} ms
            </div>
          )}
          {overlay}
        </main>

        <aside className="flex w-[380px] shrink-0 flex-col border-l border-border bg-card/60" aria-label="Bench controls">
          <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
            <div className="border-b border-border p-2">
              <TabsList className="w-full">
                {taskPanel && <TabsTrigger value="task">{taskLabel}</TabsTrigger>}
                <TabsTrigger value="inspect">Inspect</TabsTrigger>
                <TabsTrigger value="instruments" data-testid="tab-instruments">
                  Instruments
                </TabsTrigger>
                <TabsTrigger value="circuit">Circuit</TabsTrigger>
              </TabsList>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {taskPanel && <TabsContent value="task">{taskPanel}</TabsContent>}
              <TabsContent value="inspect" className="space-y-6">
                <Inspector />
              </TabsContent>
              <TabsContent value="instruments" className="space-y-6">
                <MeterControls />
                <div className="h-px bg-border" />
                <SupplyControls />
              </TabsContent>
              <TabsContent value="circuit" className="space-y-6">
                {session && <BenchSchematic state={session.state} className="rounded-md border border-border bg-background/50 p-1 text-foreground" />}
                <CircuitList />
                {session && <ReadingsLog readings={session.readings} />}
                {session && <SafetyFeed events={session.safetyEvents} />}
              </TabsContent>
            </div>
          </Tabs>
          {session && tab !== "instruments" && (
            <div className="border-t border-border p-3">
              <MiniMeter />
            </div>
          )}
        </aside>
      </div>

      <Dialog open={help} onOpenChange={setHelp}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Keyboard and mouse</DialogTitle>
            <DialogDescription>Every bench action is also available from the side panel.</DialogDescription>
          </DialogHeader>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            {SHORTCUTS.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="lcd text-amber">{k}</dt>
                <dd className="text-muted-foreground">{v}</dd>
              </div>
            ))}
          </dl>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Compact always-visible meter readout. */
function MiniMeter() {
  const session = useBenchStore((s) => s.session);
  const log = useBenchStore((s) => s.log);
  if (!session) return null;
  const { reading, state } = session;
  return (
    <div className="flex items-center gap-3">
      <div className="lcd flex-1 rounded-md bg-[#0d1611] px-3 py-1.5 text-right text-emerald-200" aria-live="polite" data-testid="mini-meter">
        <span className="mr-2 text-[10px] text-emerald-300/60">{state.meter.mode === "off" ? "METER OFF" : reading.annunciators.join(" ")}</span>
        <span className="text-lg">{state.meter.mode === "off" ? "" : reading.display}</span> <span className="text-xs">{state.meter.mode === "off" ? "" : reading.displayUnit}</span>
      </div>
      <Button size="sm" variant="secondary" onClick={log} disabled={state.meter.mode === "off"}>
        Log
      </Button>
    </div>
  );
}
