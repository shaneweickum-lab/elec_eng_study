"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CircleDot, Gauge, Plug, Power, RotateCcw, ShieldAlert, Trash2, Zap } from "lucide-react";
import type { MultimeterMode } from "@iea/circuit-sim";
import { resistorColorCode } from "@iea/voxel-engine";
import { POSTS, post } from "@/domain/bench/board";
import type { BenchPart, BenchState, LoggedReading, SafetyEvent } from "@/domain/bench/types";
import { useBenchStore } from "@/stores/bench-store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { formatOhms, METER_MODE_LABELS, METER_MODE_NAMES, partLabel } from "@/lib/format";
import { parseEngineering } from "@/lib/units";
import { cn } from "@/lib/utils";
import { usePhysicalSolution } from "./use-bench-view";

const MODES: MultimeterMode[] = ["off", "dc-voltage", "dc-current", "resistance", "continuity"];

function Section({ title, icon, children, className }: { title: string; icon?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("space-y-3", className)}>
      <h3 className="flex items-center gap-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  );
}

/* ------------------------------------------------------------- meter */

export function MeterReadout() {
  const session = useBenchStore((s) => s.session);
  if (!session) return null;
  const { reading, state } = session;
  const off = state.meter.mode === "off";
  const status =
    reading.status === "invalid-energized"
      ? "Invalid: circuit energized"
      : reading.status === "fuse-blown"
        ? "Fuse open"
        : reading.status === "overload"
          ? "Over range / open"
          : reading.status === "incomplete"
            ? "Probes not connected"
            : reading.status === "circuit-error"
              ? "Circuit error"
              : null;
  return (
    <div className="rounded-md border border-border bg-[#0d1611] p-3" data-testid="meter-readout">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[10px] font-medium tracking-wider text-emerald-300/60 uppercase">{METER_MODE_NAMES[state.meter.mode]}</span>
        <span className="lcd text-[10px] text-emerald-300/60">{reading.annunciators.join(" ")}</span>
      </div>
      <div className="lcd mt-1 flex items-baseline justify-end gap-2 text-emerald-200" aria-live="polite" aria-atomic="true">
        <span className="text-3xl font-semibold" data-testid="meter-display">
          {off ? "" : reading.display}
        </span>
        <span className="text-sm" data-testid="meter-unit">
          {off ? "" : reading.displayUnit}
        </span>
        <span className="sr-only">{off ? "Meter off" : `Reading ${reading.display} ${reading.displayUnit}`}</span>
      </div>
      {status && !off && <p className="mt-1 text-right text-[11px] text-amber">{status}</p>}
    </div>
  );
}

export function MeterControls() {
  const session = useBenchStore((s) => s.session);
  const act = useBenchStore((s) => s.act);
  const log = useBenchStore((s) => s.log);
  if (!session) return null;
  const { meter } = session.state;
  const placeOptions = POSTS.map((p) => p.id);
  return (
    <Section title="Digital multimeter" icon={<Gauge className="size-3.5" />}>
      <MeterReadout />
      <div className="grid grid-cols-5 gap-1" role="radiogroup" aria-label="Meter function">
        {MODES.map((mode, i) => (
          <button
            key={mode}
            role="radio"
            aria-checked={meter.mode === mode}
            title={`${METER_MODE_NAMES[mode]} (key ${i + 1})`}
            onClick={() => act({ type: "set-meter-mode", mode })}
            data-testid={`meter-mode-${mode}`}
            className={cn(
              "h-8 rounded-md border text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              meter.mode === mode ? "border-amber/60 bg-amber/15 text-amber" : "border-border bg-secondary text-secondary-foreground hover:bg-accent",
            )}
          >
            {mode === "continuity" ? "•)))" : METER_MODE_LABELS[mode]}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {(["red", "black"] as const).map((probe) => (
          <div key={probe} className="space-y-1">
            <Label htmlFor={`probe-${probe}`} className="flex items-center gap-1.5">
              <span className={cn("inline-block size-2 rounded-full", probe === "red" ? "bg-danger" : "bg-zinc-200")} />
              {probe === "red" ? "Red probe (+)" : "Black probe (COM)"}
            </Label>
            <select
              id={`probe-${probe}`}
              data-testid={`probe-${probe}`}
              value={meter[probe] ?? ""}
              onChange={(e) => act({ type: "place-probe", probe, postId: e.target.value || null })}
              className="h-8 w-full rounded-md border border-input bg-background/60 px-2 text-sm"
            >
              <option value="">Not connected</option>
              {placeOptions.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
      {meter.mode === "dc-current" && (
        <p className="text-xs text-muted-foreground">The red lead is in the 10 A jack. Connect the meter in series — across an opened link — never across a source.</p>
      )}
      {!meter.fuseIntact && (
        <div className="flex items-center justify-between gap-2 rounded-md border border-danger/40 bg-danger/10 p-2 text-xs text-danger">
          <span>Current-input fuse is open.</span>
          <Button size="sm" variant="outline" onClick={() => act({ type: "replace-fuse" })}>
            Replace fuse
          </Button>
        </div>
      )}
      <Button className="w-full" variant="secondary" onClick={log} data-testid="log-reading" disabled={meter.mode === "off"}>
        <CircleDot /> Log reading <kbd className="ml-auto text-[10px] text-muted-foreground">L</kbd>
      </Button>
    </Section>
  );
}

/* ------------------------------------------------------------ supply */

export function SupplyControls() {
  const session = useBenchStore((s) => s.session);
  const act = useBenchStore((s) => s.act);
  const physical = usePhysicalSolution(session);
  const [voltageText, setVoltageText] = useState("");
  const voltage = session?.state.supply.voltage;
  useEffect(() => {
    if (voltage !== undefined) setVoltageText(voltage.toFixed(2));
  }, [voltage]);
  if (!session) return null;
  const { supply } = session.state;
  const ok = physical?.status === "ok" ? physical : null;
  const cc = ok?.sourceModes[supply.id] === "constant-current";
  const current = supply.outputOn && ok ? Math.abs(ok.componentCurrents[supply.id] ?? 0) : 0;
  const commitVoltage = () => {
    const v = parseEngineering(voltageText);
    if (v !== null) act({ type: "set-supply-voltage", value: v });
    else setVoltageText(supply.voltage.toFixed(2));
  };
  return (
    <Section title="Bench supply PS1" icon={<Plug className="size-3.5" />}>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-md border border-border bg-[#0d1611] p-2">
          <div className="text-[10px] text-emerald-300/60">VOLTAGE {supply.outputOn ? (cc ? "· CC" : "· CV") : ""}</div>
          <div className="lcd text-xl text-emerald-200" data-testid="supply-voltage-display">
            {supply.outputOn ? (ok ? Math.abs(ok.componentVoltages[supply.id] ?? 0).toFixed(2) : "Err") : "--.--"} V
          </div>
        </div>
        <div className="rounded-md border border-border bg-[#0d1611] p-2">
          <div className="text-[10px] text-emerald-300/60">CURRENT</div>
          <div className="lcd text-xl text-emerald-200">{supply.outputOn && supply.showCurrent ? current.toFixed(3) : "-.---"} A</div>
        </div>
      </div>
      {!supply.showCurrent && <p className="text-[11px] text-muted-foreground">The supply's ammeter is disabled for this exercise. Use the multimeter.</p>}
      <Button
        className="w-full"
        variant={supply.outputOn ? "warning" : "secondary"}
        onClick={() => act({ type: "set-output", on: !supply.outputOn })}
        data-testid="supply-output"
        aria-pressed={supply.outputOn}
      >
        <Power /> Output {supply.outputOn ? "ON — click to turn off" : "OFF — click to energize"}
        <kbd className="ml-auto text-[10px] opacity-70">P</kbd>
      </Button>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="supply-voltage">Voltage set-point</Label>
          {!supply.voltageEditable && <Badge variant="outline">fixed</Badge>}
        </div>
        <Slider
          aria-label="Voltage set-point"
          min={0}
          max={supply.maxVoltage}
          step={0.1}
          value={[supply.voltage]}
          disabled={!supply.voltageEditable}
          onValueChange={([v]) => v !== undefined && act({ type: "set-supply-voltage", value: v })}
        />
        <div className="flex gap-2">
          <Input
            id="supply-voltage"
            data-testid="supply-voltage-input"
            value={voltageText}
            disabled={!supply.voltageEditable}
            onChange={(e) => setVoltageText(e.target.value)}
            onBlur={commitVoltage}
            onKeyDown={(e) => e.key === "Enter" && commitVoltage()}
          />
          <span className="self-center text-sm text-muted-foreground">V</span>
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="supply-limit">Current limit</Label>
        <div className="flex gap-2">
          <Input
            id="supply-limit"
            key={supply.currentLimit}
            defaultValue={supply.currentLimit.toFixed(3)}
            onBlur={(e) => {
              const v = parseEngineering(e.target.value);
              if (v !== null) act({ type: "set-current-limit", value: v });
            }}
          />
          <span className="self-center text-sm text-muted-foreground">A</span>
        </div>
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------- parts */

function ResistorEditor({ part }: { part: Extract<BenchPart, { kind: "resistor" }> }) {
  const act = useBenchStore((s) => s.act);
  const energized = useBenchStore((s) => s.session?.state.supply.outputOn ?? false);
  const [text, setText] = useState(String(part.resistance));
  useEffect(() => setText(String(part.resistance)), [part.resistance]);
  const code = resistorColorCode(part.resistance);
  const commit = () => {
    const v = parseEngineering(text);
    if (v !== null) act({ type: "set-resistance", partId: part.id, value: v });
    else setText(String(part.resistance));
  };
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5" aria-label={`Color bands: ${code.bands.join(", ")}`}>
        {code.bands.map((band, i) => (
          <span key={i} title={band} className="h-5 w-3 rounded-sm border border-black/40" style={{ background: BAND_CSS[band] }} />
        ))}
        <span className="ml-2 text-xs text-muted-foreground">{code.bands.join(" · ")}</span>
      </div>
      {part.editable ? (
        <div className="space-y-1">
          <Label htmlFor={`r-${part.id}`}>Replace with value (e.g. 470, 4.7k)</Label>
          <div className="flex gap-2">
            <Input id={`r-${part.id}`} data-testid={`resistance-${part.id}`} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && commit()} />
            <Button variant="secondary" onClick={commit} data-testid={`apply-resistance-${part.id}`}>
              Fit
            </Button>
          </div>
          {energized && (
            <p className="flex items-center gap-1.5 text-xs text-amber">
              <AlertTriangle className="size-3.5" /> Circuit is energized. Turn the supply output off before replacing a component.
            </p>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">This component is fixed for the exercise.</p>
      )}
    </div>
  );
}

export function PartControls({ part }: { part: BenchPart }) {
  const act = useBenchStore((s) => s.act);
  const energized = useBenchStore((s) => s.session?.state.supply.outputOn ?? false);
  const [a, b] = [post(part.a), post(part.b)];
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <div className="text-sm font-semibold">{part.kind === "resistor" ? `${part.label} — ${formatOhms(part.resistance)}` : part.label}</div>
        <span className="text-xs text-muted-foreground">
          {a.label} ↔ {b.label}
        </span>
      </div>
      {part.kind === "resistor" && <ResistorEditor part={part} />}
      {part.kind === "switch" && (
        <Button variant="secondary" className="w-full" onClick={() => act({ type: "set-switch", partId: part.id, closed: !part.closed })} data-testid={`switch-${part.id}`}>
          Knife switch is {part.closed ? "CLOSED" : "OPEN"} — {part.closed ? "open it" : "close it"}
        </Button>
      )}
      {part.kind === "jumper" && (
        <>
          <p className="text-xs text-muted-foreground">
            A removable link. Remove it to open the circuit here, then connect the meter across {a.label} and {b.label} to measure current in series.
          </p>
          <Button variant="secondary" className="w-full" onClick={() => act({ type: "set-jumper", partId: part.id, installed: !part.installed })} data-testid={`jumper-${part.id}`}>
            {part.installed ? "Remove link" : "Install link"}
          </Button>
          {energized && <p className="flex items-center gap-1.5 text-xs text-amber"><AlertTriangle className="size-3.5" /> De-energize before changing wiring.</p>}
        </>
      )}
    </div>
  );
}

export function PostDetails({ postId }: { postId: string }) {
  const session = useBenchStore((s) => s.session);
  const act = useBenchStore((s) => s.act);
  const select = useBenchStore((s) => s.select);
  if (!session) return null;
  const { state } = session;
  const connected = state.parts.filter((p) => p.a === postId || p.b === postId);
  const supplyRole = state.supply.positivePost === postId ? "Supply + lead" : state.supply.negativePost === postId ? "Supply − lead" : null;
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <div className="text-sm font-semibold">Terminal {postId}</div>
        {supplyRole && <Badge variant="secondary">{supplyRole}</Badge>}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button size="sm" variant="secondary" onClick={() => act({ type: "place-probe", probe: "red", postId })} data-testid="place-red">
          <span className="size-2 rounded-full bg-danger" /> Red probe here <kbd className="ml-auto opacity-60">R</kbd>
        </Button>
        <Button size="sm" variant="secondary" onClick={() => act({ type: "place-probe", probe: "black", postId })} data-testid="place-black">
          <span className="size-2 rounded-full bg-zinc-200" /> Black probe here <kbd className="ml-auto opacity-60">B</kbd>
        </Button>
      </div>
      <div className="space-y-1">
        <div className="text-xs text-muted-foreground">Connected parts</div>
        {connected.length === 0 && <p className="text-xs text-muted-foreground">Nothing is connected to this terminal.</p>}
        {connected.map((p) => (
          <button key={p.id} onClick={() => select({ kind: "part", id: p.id })} className="flex w-full items-center justify-between rounded-md border border-border px-2 py-1.5 text-left text-xs hover:bg-accent">
            <span>{partLabel(p)}</span>
            <span className="text-muted-foreground">to {p.a === postId ? p.b : p.a}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function Inspector() {
  const selection = useBenchStore((s) => s.selection);
  const session = useBenchStore((s) => s.session);
  if (!session) return null;
  if (!selection)
    return (
      <div className="space-y-2 text-sm text-muted-foreground">
        <p>Select an object on the bench or use the lists below.</p>
        <ul className="list-inside list-disc space-y-1 text-xs">
          <li>Click a terminal post to place the meter probes.</li>
          <li>Click a part to inspect or change it.</li>
          <li>Click the supply's green button to switch its output.</li>
          <li>Drag to pan, scroll to zoom.</li>
        </ul>
      </div>
    );
  if (selection.kind === "post") return <PostDetails postId={selection.id} />;
  if (selection.kind === "supply") return <SupplyControls />;
  if (selection.kind === "meter") return <MeterControls />;
  const part = session.state.parts.find((p) => p.id === selection.id);
  return part ? <PartControls part={part} /> : null;
}

/* ----------------------------------------------------------- circuit */

export function CircuitList() {
  const session = useBenchStore((s) => s.session);
  const select = useBenchStore((s) => s.select);
  const selection = useBenchStore((s) => s.selection);
  if (!session) return null;
  const { state } = session;
  return (
    <Section title="Components" icon={<Zap className="size-3.5" />}>
      <ul className="space-y-1" aria-label="Circuit components">
        <li>
          <button onClick={() => select({ kind: "supply" })} className={cn("flex w-full justify-between rounded-md border px-2 py-1.5 text-left text-xs hover:bg-accent", selection?.kind === "supply" ? "border-amber/50" : "border-border")}>
            <span>PS1 bench supply · {state.supply.voltage.toFixed(2)} V</span>
            <span className="text-muted-foreground">
              + {state.supply.positivePost} / − {state.supply.negativePost} · {state.supply.outputOn ? "ON" : "OFF"}
            </span>
          </button>
        </li>
        {state.parts.map((p) => (
          <li key={p.id}>
            <button
              onClick={() => select({ kind: "part", id: p.id })}
              data-testid={`part-row-${p.id}`}
              className={cn("flex w-full justify-between rounded-md border px-2 py-1.5 text-left text-xs hover:bg-accent", selection?.kind === "part" && selection.id === p.id ? "border-amber/50" : "border-border")}
            >
              <span>{partLabel(p)}</span>
              <span className="text-muted-foreground">
                {p.a} – {p.b}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function ReadingsLog({ readings }: { readings: readonly LoggedReading[] }) {
  return (
    <Section title={`Logged readings (${readings.length})`} icon={<CircleDot className="size-3.5" />}>
      {readings.length === 0 ? (
        <p className="text-xs text-muted-foreground">No readings logged yet. Take a measurement and press “Log reading”.</p>
      ) : (
        <ol className="space-y-1" data-testid="readings-log">
          {[...readings].reverse().map((r) => (
            <li key={r.id} className="flex items-center justify-between rounded-md border border-border px-2 py-1.5 text-xs">
              <span className="text-muted-foreground">
                {r.id} · {METER_MODE_NAMES[r.mode]} · {r.red ?? "—"}(+) {r.black ?? "—"}(−)
              </span>
              <span className={cn("lcd", r.status === "ok" && r.hazardCodes.length === 0 ? "text-foreground" : "text-amber")}>
                {r.display} {r.displayUnit}
              </span>
            </li>
          ))}
        </ol>
      )}
    </Section>
  );
}

export function SafetyFeed({ events }: { events: readonly SafetyEvent[] }) {
  if (events.length === 0) return null;
  return (
    <Section title="Safety log" icon={<ShieldAlert className="size-3.5 text-danger" />}>
      <ul className="space-y-1" data-testid="safety-log">
        {events.map((e, i) => (
          <li key={i} className={cn("rounded-md border px-2 py-1.5 text-xs", e.severity === "violation" ? "border-danger/40 bg-danger/10 text-danger" : "border-amber/40 bg-amber/10 text-amber")}>
            <span className="font-semibold">{e.severity === "violation" ? "Violation" : "Technique"}:</span> {e.message}
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function ResetCircuitButton({ onReset }: { onReset: () => void }) {
  return (
    <Button variant="ghost" size="sm" onClick={onReset}>
      <RotateCcw /> Reset bench
    </Button>
  );
}

export function DeleteButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <Button variant="ghost" size="icon-sm" onClick={onClick} aria-label={label}>
      <Trash2 />
    </Button>
  );
}

const BAND_CSS: Record<string, string> = {
  black: "#141414",
  brown: "#6b3b1d",
  red: "#c42121",
  orange: "#e86b12",
  yellow: "#f2d01a",
  green: "#2c9a3a",
  blue: "#2552c9",
  violet: "#7a3fc4",
  gray: "#8a8a8a",
  white: "#f3f3f3",
  gold: "#c8a032",
  silver: "#b8bcc2",
};

export type { BenchState };
