import type { Circuit, Component } from "./schema";
import { terminalsOf } from "./schema";

/** Minimal union-find over string keys. */
export class DisjointSet {
  private readonly parent = new Map<string, string>();

  add(key: string): void {
    if (!this.parent.has(key)) this.parent.set(key, key);
  }

  find(key: string): string {
    this.add(key);
    let root = key;
    while (this.parent.get(root) !== root) root = this.parent.get(root)!;
    // Path compression.
    let cursor = key;
    while (cursor !== root) {
      const next = this.parent.get(cursor)!;
      this.parent.set(cursor, root);
      cursor = next;
    }
    return root;
  }

  /** Union two keys; the lexicographically smaller root wins for determinism. */
  union(a: string, b: string): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra === rb) return;
    if (ra < rb) this.parent.set(rb, ra);
    else this.parent.set(ra, rb);
  }

  keys(): string[] {
    return [...this.parent.keys()];
  }
}

/** State of electromechanical coils, keyed by coil id (true = energized). */
export type CoilStates = Readonly<Record<string, boolean>>;

/**
 * Whether a component currently behaves as an ideal zero-impedance link.
 * Open links are absent from the electrical network entirely.
 */
export function linkState(component: Component, coilStates: CoilStates): "closed" | "open" | "not-a-link" {
  switch (component.kind) {
    case "wire":
      return "closed";
    case "switch":
      return component.closed ? "closed" : "open";
    case "pushbutton": {
      const conducting = component.contact === "NO" ? component.pressed : !component.pressed;
      return conducting ? "closed" : "open";
    }
    case "relay-contact": {
      const energized = coilStates[component.coilId] === true;
      const conducting = component.contact === "NO" ? energized : !energized;
      return conducting ? "closed" : "open";
    }
    default:
      return "not-a-link";
  }
}

export function isLinkKind(component: Component): boolean {
  return (
    component.kind === "wire" ||
    component.kind === "switch" ||
    component.kind === "pushbutton" ||
    component.kind === "relay-contact"
  );
}

export interface Supernodes {
  /** Original node → supernode representative. */
  readonly of: (node: string) => string;
  /** All original node names, sorted. */
  readonly nodes: readonly string[];
}

/** Merge nodes joined by closed ideal links into supernodes. */
export function buildSupernodes(circuit: Circuit, coilStates: CoilStates = {}): Supernodes {
  const set = new DisjointSet();
  for (const component of circuit.components) {
    const [a, b] = terminalsOf(component);
    set.add(a);
    set.add(b);
  }
  if (circuit.ground) set.add(circuit.ground);
  for (const component of circuit.components) {
    if (linkState(component, coilStates) === "closed") {
      const [a, b] = terminalsOf(component);
      set.union(a, b);
    }
  }
  const nodes = set.keys().sort();
  return { of: (node) => set.find(node), nodes };
}
