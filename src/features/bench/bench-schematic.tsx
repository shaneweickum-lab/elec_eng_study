"use client";

import { post, POSTS } from "@/domain/bench/board";
import type { BenchState } from "@/domain/bench/types";
import { formatOhms } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Schematic view of the bench, laid out on the same grid as the terminal
 * board so learners can relate symbols to physical posts. Hidden faults are
 * never shown.
 */
const CELL_X = 74;
const CELL_Y = 64;
const OX = 74;
const OY = 30;

const at = (postId: string) => {
  const p = post(postId);
  return { x: OX + p.col * CELL_X, y: OY + p.row * CELL_Y };
};

function zigzag(x1: number, y1: number, x2: number, y2: number): string {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy;
  const ny = ux;
  const lead = len * 0.25;
  const body = len - 2 * lead;
  const pts: string[] = [`${x1},${y1}`, `${x1 + ux * lead},${y1 + uy * lead}`];
  const peaks = 6;
  for (let i = 1; i <= peaks; i++) {
    const t = lead + (body * (i - 0.5)) / peaks;
    const side = i % 2 === 0 ? -1 : 1;
    pts.push(`${x1 + ux * t + nx * 6 * side},${y1 + uy * t + ny * 6 * side}`);
  }
  pts.push(`${x2 - ux * lead},${y2 - uy * lead}`, `${x2},${y2}`);
  return pts.join(" ");
}

export function BenchSchematic({ state, className, highlight }: { state: BenchState; className?: string; highlight?: string | null }) {
  const used = new Set<string>([state.supply.positivePost, state.supply.negativePost]);
  for (const p of state.parts) {
    used.add(p.a);
    used.add(p.b);
  }
  const pos = at(state.supply.positivePost);
  const neg = at(state.supply.negativePost);
  const sx = 22;
  const midY = (pos.y + neg.y) / 2;
  const width = OX + 5 * CELL_X + 30;
  const height = OY + 2 * CELL_Y + 30;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={cn("w-full", className)} role="img" aria-label="Schematic of the bench circuit">
      {/* Supply symbol (battery style, longer plate positive). */}
      <g stroke="currentColor" strokeWidth={1.5} fill="none" className="text-muted-foreground">
        <polyline points={`${pos.x},${pos.y} ${sx},${pos.y} ${sx},${midY - 6}`} />
        <polyline points={`${neg.x},${neg.y} ${sx},${neg.y} ${sx},${midY + 6}`} />
        <line x1={sx - 12} y1={midY - 6} x2={sx + 12} y2={midY - 6} className={state.supply.outputOn ? "text-cyan" : ""} stroke="currentColor" strokeWidth={2} />
        <line x1={sx - 6} y1={midY + 6} x2={sx + 6} y2={midY + 6} stroke="currentColor" strokeWidth={3} />
      </g>
      <text x={sx + 16} y={midY - 12} className="fill-muted-foreground text-[9px]">
        PS1 {state.supply.voltage.toFixed(2)} V
      </text>
      <text x={sx + 16} y={midY + 2} className={cn("text-[9px]", state.supply.outputOn ? "fill-cyan" : "fill-muted-foreground")}>
        {state.supply.outputOn ? "output ON" : "output OFF"}
      </text>
      <text x={sx - 16} y={midY - 9} className="fill-danger text-[10px]">+</text>

      {state.parts.map((part) => {
        const a = at(part.a);
        const b = at(part.b);
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        const horizontal = a.y === b.y;
        const labelPos = horizontal ? { x: mx, y: my - 10 } : { x: mx + 10, y: my + 3 };
        const active = highlight === part.id;
        const stroke = active ? "var(--amber)" : "currentColor";
        let symbol: React.ReactNode;
        let label = part.label;
        if (part.kind === "resistor") {
          symbol = <polyline points={zigzag(a.x, a.y, b.x, b.y)} fill="none" stroke={stroke} strokeWidth={1.5} />;
          label = `${part.label} ${formatOhms(part.resistance)}`;
        } else if (part.kind === "switch") {
          const ux = (b.x - a.x) / 2;
          const uy = (b.y - a.y) / 2;
          const p1 = { x: a.x + ux * 0.5, y: a.y + uy * 0.5 };
          const p2 = { x: b.x - ux * 0.5, y: b.y - uy * 0.5 };
          const blade = part.closed ? p2 : { x: p2.x - (horizontal ? 4 : -10), y: p2.y - (horizontal ? 10 : 4) };
          symbol = (
            <g stroke={stroke} strokeWidth={1.5} fill="none">
              <line x1={a.x} y1={a.y} x2={p1.x} y2={p1.y} />
              <line x1={p1.x} y1={p1.y} x2={blade.x} y2={blade.y} />
              <line x1={p2.x} y1={p2.y} x2={b.x} y2={b.y} />
              <circle cx={p1.x} cy={p1.y} r={2} />
              <circle cx={p2.x} cy={p2.y} r={2} />
            </g>
          );
          label = `${part.label} ${part.closed ? "closed" : "open"}`;
        } else {
          symbol = part.installed ? (
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={stroke} strokeWidth={1.5} />
          ) : (
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--amber)" strokeWidth={1.2} strokeDasharray="3 4" />
          );
          if (!part.installed) label = `${part.label} removed`;
        }
        return (
          <g key={part.id} className="text-foreground/80">
            {symbol}
            <text x={labelPos.x} y={labelPos.y} textAnchor={horizontal ? "middle" : "start"} className={cn("text-[9px]", active ? "fill-amber" : "fill-muted-foreground")}>
              {label}
            </text>
          </g>
        );
      })}

      {POSTS.filter((p) => used.has(p.id)).map((p) => {
        const c = at(p.id);
        const red = state.meter.red === p.id;
        const black = state.meter.black === p.id;
        return (
          <g key={p.id}>
            <circle cx={c.x} cy={c.y} r={3} className="fill-background" stroke="currentColor" strokeWidth={1.2} />
            <text x={c.x - 6} y={c.y + 13} className="fill-muted-foreground/70 text-[8px]">
              {p.label}
            </text>
            {red && <circle cx={c.x + 5} cy={c.y - 5} r={3} fill="var(--danger)" />}
            {black && <circle cx={c.x - 5} cy={c.y - 5} r={3} fill="#e5e7eb" />}
          </g>
        );
      })}
    </svg>
  );
}
