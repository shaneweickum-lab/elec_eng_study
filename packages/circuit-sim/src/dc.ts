import type { Circuit, Component, VoltageSource } from "./schema";
import { terminalsOf } from "./schema";
import { solveLinearSystem } from "./linear";
import { buildSupernodes, DisjointSet, isLinkKind, linkState, type CoilStates, type Supernodes } from "./topology";

/**
 * DC operating-point analysis by Modified Nodal Analysis (MNA).
 *
 *  1. Ideal links (wires, closed switches/contacts) merge nodes into supernodes.
 *  2. Each isolated network gets its own reference node (0 V).
 *  3. Unknowns: supernode voltages + one branch current per voltage source.
 *  4. The linear system is solved with partial pivoting; singular systems are
 *     classified and reported, never approximated.
 *  5. Current-limited sources iterate between constant-voltage and
 *     constant-current operation until the operating point is consistent.
 */

export type IssueCode =
  | "duplicate-id"
  | "unknown-coil"
  | "ideal-source-short"
  | "voltage-source-loop"
  | "current-source-cutset"
  | "singular-matrix"
  | "source-mode-unstable";

export interface CircuitIssue {
  readonly code: IssueCode;
  readonly message: string;
  readonly componentIds: readonly string[];
}

export type SourceMode = "constant-voltage" | "constant-current";

export interface DCSolveOptions {
  readonly coilStates?: CoilStates;
  readonly maxSourceModeIterations?: number;
}

export interface DCSolution {
  readonly status: "ok";
  /** Volts, relative to the reference node of the node's isolated network. */
  readonly nodeVoltages: Readonly<Record<string, number>>;
  /** Reference (0 V) node of each node's isolated network. */
  readonly references: Readonly<Record<string, string>>;
  /**
   * Amperes. Two-terminal parts: positive from terminal `a` to `b` through the part.
   * Voltage sources: current delivered out of the positive terminal.
   * Current sources: the source value (from → to through the source).
   * `null` means physically indeterminate (e.g. current split between parallel ideal wires).
   */
  readonly componentCurrents: Readonly<Record<string, number | null>>;
  /** Volts across each part, V(a) − V(b) (sources: V(+) − V(−)); `null` if terminals are in isolated networks. */
  readonly componentVoltages: Readonly<Record<string, number | null>>;
  /** Watts absorbed by each part (negative = delivering energy). */
  readonly componentPower: Readonly<Record<string, number | null>>;
  readonly sourceModes: Readonly<Record<string, SourceMode>>;
  readonly supernodes: Supernodes;
}

export interface DCFailure {
  readonly status: "short-circuit" | "invalid" | "singular";
  readonly issues: readonly CircuitIssue[];
}

export type DCResult = DCSolution | DCFailure;

const isVoltageSource = (c: Component): c is VoltageSource => c.kind === "voltage-source";

function semanticIssues(circuit: Circuit): CircuitIssue[] {
  const issues: CircuitIssue[] = [];
  const seen = new Set<string>();
  for (const component of circuit.components) {
    if (seen.has(component.id)) {
      issues.push({ code: "duplicate-id", message: `Duplicate component id "${component.id}".`, componentIds: [component.id] });
    }
    seen.add(component.id);
  }
  const coils = new Set(circuit.components.filter((c) => c.kind === "relay-coil").map((c) => c.id));
  for (const component of circuit.components) {
    if (component.kind === "relay-contact" && !coils.has(component.coilId)) {
      issues.push({
        code: "unknown-coil",
        message: `Contact "${component.id}" references missing coil "${component.coilId}".`,
        componentIds: [component.id],
      });
    }
  }
  return issues;
}

interface SourceState {
  mode: SourceMode;
  /** Sign of delivered current while in constant-current mode. */
  direction: number;
}

interface Assembled {
  readonly voltageOf: (supernode: string) => number;
  readonly groupOf: (supernode: string) => string;
  readonly referenceOfGroup: (group: string) => string;
  /** Delivered current for constant-voltage sources (null if shorted with 0 V). */
  readonly cvDelivered: ReadonlyMap<string, number | null>;
}

function assembleAndSolve(
  circuit: Circuit,
  supernodes: Supernodes,
  sources: ReadonlyMap<string, SourceState>,
): Assembled | DCFailure {
  const sup = supernodes.of;
  const groups = new DisjointSet();
  const allSupernodes = [...new Set(supernodes.nodes.map(sup))].sort();
  for (const s of allSupernodes) groups.add(s);
  for (const component of circuit.components) {
    if (linkState(component, {}) !== "not-a-link") continue;
    const [a, b] = terminalsOf(component);
    groups.union(sup(a), sup(b));
  }

  // Reference per isolated network: ground, else a source's negative terminal, else the smallest supernode.
  const references = new Map<string, string>();
  if (circuit.ground) references.set(groups.find(sup(circuit.ground)), sup(circuit.ground));
  for (const component of circuit.components) {
    if (!isVoltageSource(component)) continue;
    const s = sup(component.negative);
    const g = groups.find(s);
    if (!references.has(g)) references.set(g, s);
  }
  for (const s of allSupernodes) {
    const g = groups.find(s);
    if (!references.has(g)) references.set(g, s);
  }
  const referenceSet = new Set(references.values());

  const nodeIndex = new Map<string, number>();
  for (const s of allSupernodes) if (!referenceSet.has(s)) nodeIndex.set(s, nodeIndex.size);

  const cvSources: VoltageSource[] = [];
  const shortedZeroSources: string[] = [];
  for (const component of circuit.components) {
    if (!isVoltageSource(component)) continue;
    const state = sources.get(component.id)!;
    if (state.mode !== "constant-voltage") continue;
    if (sup(component.positive) === sup(component.negative)) shortedZeroSources.push(component.id);
    else cvSources.push(component);
  }

  const size = nodeIndex.size + cvSources.length;
  const matrix: Float64Array[] = Array.from({ length: size }, () => new Float64Array(size));
  const rhs = new Float64Array(size);
  const idx = (node: string): number | undefined => nodeIndex.get(sup(node));

  const stampConductance = (a: string, b: string, g: number) => {
    const i = idx(a);
    const j = idx(b);
    if (i !== undefined) matrix[i]![i]! += g;
    if (j !== undefined) matrix[j]![j]! += g;
    if (i !== undefined && j !== undefined) {
      matrix[i]![j]! -= g;
      matrix[j]![i]! -= g;
    }
  };
  /** Current injected into `node` from an element. */
  const inject = (node: string, current: number) => {
    const i = idx(node);
    if (i !== undefined) rhs[i]! += current;
  };

  for (const component of circuit.components) {
    switch (component.kind) {
      case "resistor":
      case "relay-coil":
        if (sup(component.a) !== sup(component.b)) stampConductance(component.a, component.b, 1 / component.resistance);
        break;
      case "current-source":
        inject(component.to, component.current);
        inject(component.from, -component.current);
        break;
      case "voltage-source": {
        const state = sources.get(component.id)!;
        if (state.mode === "constant-current") {
          const delivered = state.direction * component.currentLimit!;
          inject(component.positive, delivered);
          inject(component.negative, -delivered);
        }
        break;
      }
      default:
        break;
    }
  }
  cvSources.forEach((source, k) => {
    const row = nodeIndex.size + k;
    const p = idx(source.positive);
    const n = idx(source.negative);
    if (p !== undefined) {
      matrix[p]![row]! += 1;
      matrix[row]![p]! += 1;
    }
    if (n !== undefined) {
      matrix[n]![row]! -= 1;
      matrix[row]![n]! -= 1;
    }
    rhs[row] = source.voltage;
  });

  const solved = solveLinearSystem(matrix, rhs);
  if (!solved.ok) return classifySingular(circuit, supernodes, cvSources, sources);

  const voltageOf = (s: string) => {
    const i = nodeIndex.get(s);
    return i === undefined ? 0 : solved.x[i]!;
  };
  const cvDelivered = new Map<string, number | null>();
  cvSources.forEach((source, k) => cvDelivered.set(source.id, -solved.x[nodeIndex.size + k]!));
  for (const id of shortedZeroSources) cvDelivered.set(id, null);
  return {
    voltageOf,
    groupOf: (s) => groups.find(s),
    referenceOfGroup: (g) => references.get(g)!,
    cvDelivered,
  };
}

function classifySingular(
  circuit: Circuit,
  supernodes: Supernodes,
  cvSources: readonly VoltageSource[],
  sources: ReadonlyMap<string, SourceState>,
): DCFailure {
  const loop = new DisjointSet();
  for (const source of cvSources) {
    const a = supernodes.of(source.positive);
    const b = supernodes.of(source.negative);
    if (loop.find(a) === loop.find(b)) {
      const root = loop.find(a);
      const involved = cvSources
        .filter((s) => loop.find(supernodes.of(s.positive)) === root || s.id === source.id)
        .map((s) => s.id);
      return {
        status: "invalid",
        issues: [
          {
            code: "voltage-source-loop",
            message:
              "Ideal voltage sources are connected in a loop (for example in parallel). Their currents cannot be determined without modeled internal resistance.",
            componentIds: involved,
          },
        ],
      };
    }
    loop.union(a, b);
  }
  const currentDriven = circuit.components
    .filter((c) => c.kind === "current-source" || (c.kind === "voltage-source" && sources.get(c.id)?.mode === "constant-current"))
    .map((c) => c.id);
  if (currentDriven.length > 0) {
    return {
      status: "invalid",
      issues: [
        {
          code: "current-source-cutset",
          message: "A current source has no closed path for its current (it is in series with an open circuit).",
          componentIds: currentDriven,
        },
      ],
    };
  }
  return {
    status: "singular",
    issues: [{ code: "singular-matrix", message: "The circuit equations are singular and cannot be solved.", componentIds: [] }],
  };
}

export function solveDC(circuit: Circuit, options: DCSolveOptions = {}): DCResult {
  const coilStates = options.coilStates ?? {};
  const maxIterations = options.maxSourceModeIterations ?? 12;
  const issues = semanticIssues(circuit);
  if (issues.length > 0) return { status: "invalid", issues };

  const supernodes = buildSupernodes(circuit, coilStates);
  const sources = new Map<string, SourceState>();
  for (const component of circuit.components) {
    if (!isVoltageSource(component)) continue;
    const shorted = supernodes.of(component.positive) === supernodes.of(component.negative);
    if (shorted && component.currentLimit !== undefined) {
      sources.set(component.id, { mode: "constant-current", direction: Math.sign(component.voltage) || 1 });
    } else if (shorted && component.voltage !== 0) {
      return {
        status: "short-circuit",
        issues: [
          {
            code: "ideal-source-short",
            message: `Voltage source "${component.id}" is short-circuited by an ideal conductor. An ideal source would deliver unbounded current, so no finite result exists.`,
            componentIds: [component.id],
          },
        ],
      };
    } else {
      sources.set(component.id, { mode: "constant-voltage", direction: 1 });
    }
  }

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    const assembled = assembleAndSolve(circuit, supernodes, sources);
    if ("status" in assembled) return assembled;

    let changed = false;
    for (const component of circuit.components) {
      if (!isVoltageSource(component) || component.currentLimit === undefined) continue;
      const state = sources.get(component.id)!;
      const limit = component.currentLimit;
      if (state.mode === "constant-voltage") {
        const delivered = assembled.cvDelivered.get(component.id);
        if (delivered != null && Math.abs(delivered) > limit * (1 + 1e-9)) {
          sources.set(component.id, { mode: "constant-current", direction: Math.sign(delivered) });
          changed = true;
        }
      } else {
        const terminal =
          assembled.voltageOf(supernodes.of(component.positive)) - assembled.voltageOf(supernodes.of(component.negative));
        const setpoint = component.voltage;
        const exceeded = setpoint >= 0 ? terminal > setpoint * (1 + 1e-9) + 1e-12 : terminal < setpoint * (1 + 1e-9) - 1e-12;
        if (exceeded) {
          sources.set(component.id, { mode: "constant-voltage", direction: 1 });
          changed = true;
        }
      }
    }
    if (!changed) return buildSolution(circuit, supernodes, sources, assembled, coilStates);
  }
  return {
    status: "invalid",
    issues: [
      {
        code: "source-mode-unstable",
        message: "Current-limited sources did not settle into a consistent operating mode.",
        componentIds: [...sources.keys()],
      },
    ],
  };
}

function buildSolution(
  circuit: Circuit,
  supernodes: Supernodes,
  sources: ReadonlyMap<string, SourceState>,
  assembled: Assembled,
  coilStates: CoilStates,
): DCSolution {
  const sup = supernodes.of;
  const v = (node: string) => assembled.voltageOf(sup(node));
  const sameNetwork = (a: string, b: string) => assembled.groupOf(sup(a)) === assembled.groupOf(sup(b));

  const nodeVoltages: Record<string, number> = {};
  const references: Record<string, string> = {};
  for (const node of supernodes.nodes) {
    nodeVoltages[node] = v(node);
    references[node] = assembled.referenceOfGroup(assembled.groupOf(sup(node)));
  }

  const currents: Record<string, number | null> = {};
  const voltages: Record<string, number | null> = {};
  const power: Record<string, number | null> = {};
  const sourceModes: Record<string, SourceMode> = {};
  /** Current leaving each original node through non-link elements. */
  const leaving = new Map<string, number>();
  const addLeaving = (node: string, current: number) => leaving.set(node, (leaving.get(node) ?? 0) + current);
  const indeterminateSupernodes = new Set<string>();

  for (const component of circuit.components) {
    const [a, b] = terminalsOf(component);
    voltages[component.id] = sameNetwork(a, b) ? v(a) - v(b) : null;
    switch (component.kind) {
      case "resistor":
      case "relay-coil": {
        const current = sup(a) === sup(b) ? 0 : (v(a) - v(b)) / component.resistance;
        currents[component.id] = current;
        addLeaving(a, current);
        addLeaving(b, -current);
        break;
      }
      case "voltage-source": {
        const state = sources.get(component.id)!;
        sourceModes[component.id] = state.mode;
        const delivered =
          state.mode === "constant-current" ? state.direction * component.currentLimit! : assembled.cvDelivered.get(component.id)!;
        currents[component.id] = delivered;
        if (delivered === null) {
          indeterminateSupernodes.add(sup(a));
        } else {
          addLeaving(a, -delivered);
          addLeaving(b, delivered);
        }
        break;
      }
      case "current-source":
        currents[component.id] = component.current;
        addLeaving(a, component.current);
        addLeaving(b, -component.current);
        break;
      default:
        // Links are resolved below; open links carry no current.
        currents[component.id] = 0;
        break;
    }
  }

  resolveLinkCurrents(circuit, supernodes, coilStates, leaving, indeterminateSupernodes, currents);

  for (const component of circuit.components) {
    const voltage = voltages[component.id] ?? null;
    const current = currents[component.id] ?? null;
    if (voltage === null || current === null) {
      power[component.id] = isLinkKind(component) ? 0 : null;
      continue;
    }
    // Sources report delivered current out of the positive terminal, so absorbed power is −V·I.
    power[component.id] = component.kind === "voltage-source" ? -voltage * current : voltage * current;
  }

  return {
    status: "ok",
    nodeVoltages,
    references,
    componentCurrents: currents,
    componentVoltages: voltages,
    componentPower: power,
    sourceModes,
    supernodes,
  };
}

/**
 * Currents in ideal links follow from KCL. Within a supernode whose links form
 * a tree the solution is unique; loops of ideal conductors make the split
 * indeterminate and those currents are reported as null.
 */
function resolveLinkCurrents(
  circuit: Circuit,
  supernodes: Supernodes,
  coilStates: CoilStates,
  leaving: ReadonlyMap<string, number>,
  indeterminate: ReadonlySet<string>,
  currents: Record<string, number | null>,
): void {
  const linksBySupernode = new Map<string, { id: string; a: string; b: string }[]>();
  for (const component of circuit.components) {
    if (linkState(component, coilStates) !== "closed") continue;
    const [a, b] = terminalsOf(component);
    const key = supernodes.of(a);
    if (!linksBySupernode.has(key)) linksBySupernode.set(key, []);
    linksBySupernode.get(key)!.push({ id: component.id, a, b });
  }
  const nodesBySupernode = new Map<string, string[]>();
  for (const node of supernodes.nodes) {
    const key = supernodes.of(node);
    if (!nodesBySupernode.has(key)) nodesBySupernode.set(key, []);
    nodesBySupernode.get(key)!.push(node);
  }

  for (const [key, links] of linksBySupernode) {
    const nodes = nodesBySupernode.get(key)!;
    const isTree = links.length === nodes.length - 1 && links.every((l) => l.a !== l.b);
    if (!isTree || indeterminate.has(key)) {
      for (const link of links) currents[link.id] = null;
      continue;
    }
    const adjacency = new Map<string, { id: string; other: string }[]>();
    for (const node of nodes) adjacency.set(node, []);
    for (const link of links) {
      adjacency.get(link.a)!.push({ id: link.id, other: link.b });
      adjacency.get(link.b)!.push({ id: link.id, other: link.a });
    }
    const root = nodes[0]!;
    const order: string[] = [];
    const parentLink = new Map<string, { id: string; parent: string }>();
    const visited = new Set([root]);
    const queue = [root];
    while (queue.length > 0) {
      const node = queue.shift()!;
      order.push(node);
      for (const edge of adjacency.get(node)!) {
        if (visited.has(edge.other)) continue;
        visited.add(edge.other);
        parentLink.set(edge.other, { id: edge.id, parent: node });
        queue.push(edge.other);
      }
    }
    // Net current that must leave each subtree through its parent link.
    const subtreeNeed = new Map<string, number>();
    for (const node of order) subtreeNeed.set(node, -(leaving.get(node) ?? 0));
    for (let i = order.length - 1; i > 0; i--) {
      const child = order[i]!;
      const { id, parent } = parentLink.get(child)!;
      const flowChildToParent = subtreeNeed.get(child)!;
      subtreeNeed.set(parent, subtreeNeed.get(parent)! + flowChildToParent);
      const link = links.find((l) => l.id === id)!;
      currents[id] = link.a === child ? flowChildToParent : -flowChildToParent;
    }
  }
}
