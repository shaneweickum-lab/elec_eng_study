"use client";

import { useMemo, useState } from "react";
import { formatQuantity, solveDC } from "@iea/circuit-sim";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";

/** Logarithmic slider mapping for resistance: 10 Ω … 10 kΩ. */
const toR = (t: number) => Number((10 * 10 ** (t * 3)).toPrecision(3));
const fromR = (r: number) => Math.log10(r / 10) / 3;

export function OhmsLawExplorer() {
  const [voltage, setVoltage] = useState(12);
  const [resistance, setResistance] = useState(240);
  const result = useMemo(
    () =>
      solveDC({
        schemaVersion: 1,
        id: "explorer",
        ground: "n",
        components: [
          { kind: "voltage-source", id: "V", positive: "p", negative: "n", voltage },
          { kind: "resistor", id: "R", a: "p", b: "n", resistance },
        ],
      }),
    [voltage, resistance],
  );
  const current = result.status === "ok" ? (result.componentCurrents.R ?? 0) : 0;
  const power = result.status === "ok" ? (result.componentPower.R ?? 0) : 0;
  const intensity = Math.min(1, Math.log10(1 + current * 1000) / 3);

  return (
    <div className="rounded-lg border border-border bg-background/50 p-5" data-testid="ohms-explorer">
      <div className="grid gap-6 md:grid-cols-[1fr_220px]">
        <div className="space-y-5">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <label htmlFor="explorer-v">Source voltage</label>
              <span className="lcd text-cyan">{voltage.toFixed(1)} V</span>
            </div>
            <Slider id="explorer-v" aria-label="Source voltage" min={0} max={30} step={0.5} value={[voltage]} onValueChange={([v]) => v !== undefined && setVoltage(v)} />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <label htmlFor="explorer-r">Resistance</label>
              <span className="lcd text-cyan">{formatQuantity(resistance, "Ω", { significantDigits: 3 })}</span>
            </div>
            <Slider id="explorer-r" aria-label="Resistance" min={0} max={1} step={0.001} value={[fromR(resistance)]} onValueChange={([t]) => t !== undefined && setResistance(toR(t))} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => setVoltage((v) => Math.min(30, v * 2))}>
              Double V
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setResistance((r) => Math.min(10000, r * 2))}>
              Double R
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setVoltage(12); setResistance(240); }}>
              Reset (12 V, 240 Ω)
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          <svg viewBox="0 0 200 120" className="w-full" role="img" aria-label={`Circuit: ${voltage} volt source across ${resistance} ohm resistor`}>
            <rect x="30" y="20" width="140" height="80" rx="4" fill="none" stroke="currentColor" className="text-muted-foreground" strokeWidth="1.5" />
            <rect x="22" y="48" width="16" height="24" fill="var(--background)" />
            <line x1="20" y1="52" x2="40" y2="52" stroke="var(--cyan)" strokeWidth="2" />
            <line x1="25" y1="60" x2="35" y2="60" stroke="currentColor" strokeWidth="3" />
            <rect x="160" y="40" width="20" height="40" rx="2" fill="var(--background)" stroke="var(--amber)" strokeOpacity={0.4 + intensity * 0.6} strokeWidth="1.5" />
            <text x="120" y="64" className="fill-muted-foreground text-[10px]">R</text>
            <circle cx="100" cy="20" r={2 + intensity * 3} fill="var(--cyan)" opacity={current > 0 ? 0.9 : 0.2} />
          </svg>
          <dl className="grid grid-cols-2 gap-2 text-center">
            <div className="rounded-md bg-[#0d1611] p-2">
              <dt className="text-[10px] text-emerald-300/60">CURRENT</dt>
              <dd className="lcd text-lg text-emerald-200" data-testid="explorer-current" aria-live="polite">
                {formatQuantity(current, "A", { significantDigits: 3 })}
              </dd>
            </div>
            <div className="rounded-md bg-[#0d1611] p-2">
              <dt className="text-[10px] text-emerald-300/60">POWER</dt>
              <dd className="lcd text-lg text-emerald-200">{formatQuantity(power, "W", { significantDigits: 3 })}</dd>
            </div>
          </dl>
          <p className="text-center text-xs text-muted-foreground">
            I = {voltage.toFixed(1)} V ÷ {formatQuantity(resistance, "Ω", { significantDigits: 3 })}
          </p>
        </div>
      </div>
    </div>
  );
}
