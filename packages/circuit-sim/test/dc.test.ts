import { describe, expect, it } from "vitest";
import { parseCircuit, solveDC, solveLinearSystem, toSpiceNetlist, runAnalysis, type DCSolution } from "../src";
import { circuit, R, S, V, W } from "./helpers";

const ok = (result: ReturnType<typeof solveDC>): DCSolution => {
  if (result.status !== "ok") throw new Error(`expected ok, got ${result.status}: ${JSON.stringify(result.issues)}`);
  return result;
};

describe("linear solver", () => {
  it("solves a 3×3 system", () => {
    const r = solveLinearSystem([[2, 1, -1], [-3, -1, 2], [-2, 1, 2]], [8, -11, -3]);
    expect(r.ok).toBe(true);
    if (r.ok) expect([...r.x].map((v) => Math.round(v * 1e9) / 1e9)).toEqual([2, 3, -1]);
  });
  it("reports singular systems", () => {
    expect(solveLinearSystem([[1, 2], [2, 4]], [1, 2]).ok).toBe(false);
  });
});

describe("Ohm's law", () => {
  it.each([
    [12, 240, 0.05],
    [9, 1000, 0.009],
    [24, 4700, 24 / 4700],
    [5, 1, 5],
  ])("V=%d, R=%d → I=%d", (volts, ohms, amps) => {
    const s = ok(solveDC(circuit([V("V1", "p", "n", volts), R("R1", "p", "n", ohms)])));
    expect(s.componentCurrents.R1).toBeCloseTo(amps, 12);
    expect(s.componentCurrents.V1).toBeCloseTo(amps, 12);
    expect(s.componentVoltages.R1).toBeCloseTo(volts, 12);
    expect(s.componentPower.R1).toBeCloseTo(volts * amps, 9);
    expect(s.componentPower.V1).toBeCloseTo(-volts * amps, 9);
  });
});

describe("series circuits", () => {
  const c = circuit([V("V1", "a", "gnd", 12), R("R1", "a", "b", 100), R("R2", "b", "c", 200), R("R3", "c", "gnd", 300)], "gnd");
  it("has a single current equal to V / ΣR", () => {
    const s = ok(solveDC(c));
    for (const id of ["R1", "R2", "R3"]) expect(s.componentCurrents[id]).toBeCloseTo(0.02, 12);
  });
  it("divides voltage in proportion to resistance and satisfies KVL", () => {
    const s = ok(solveDC(c));
    expect(s.componentVoltages.R1).toBeCloseTo(2, 12);
    expect(s.componentVoltages.R2).toBeCloseTo(4, 12);
    expect(s.componentVoltages.R3).toBeCloseTo(6, 12);
    expect(s.nodeVoltages.b).toBeCloseTo(10, 12);
    expect(s.nodeVoltages.c).toBeCloseTo(6, 12);
    expect(s.nodeVoltages.gnd).toBe(0);
  });
});

describe("parallel circuits", () => {
  it("splits current by conductance and satisfies KCL", () => {
    const s = ok(solveDC(circuit([V("V1", "a", "g", 10), R("R1", "a", "g", 100), R("R2", "a", "g", 400), R("R3", "a", "g", 80)], "g")));
    expect(s.componentCurrents.R1).toBeCloseTo(0.1, 12);
    expect(s.componentCurrents.R2).toBeCloseTo(0.025, 12);
    expect(s.componentCurrents.R3).toBeCloseTo(0.125, 12);
    expect(s.componentCurrents.V1).toBeCloseTo(0.25, 12);
    const req = 1 / (1 / 100 + 1 / 400 + 1 / 80);
    expect(10 / s.componentCurrents.V1!).toBeCloseTo(req, 9);
  });
});

describe("node analysis", () => {
  it("solves a bridge-style network with two sources", () => {
    // Hand-derived: nodes x, y with Va=10, Vb=5 (ground g).
    const c = circuit(
      [V("Va", "a", "g", 10), V("Vb", "b", "g", 5), R("R1", "a", "x", 1000), R("R2", "x", "g", 1000), R("R3", "x", "y", 2000), R("R4", "y", "b", 1000), R("R5", "y", "g", 2000)],
      "g",
    );
    const s = ok(solveDC(c));
    // KCL x: (10-x)/1k = x/1k + (x-y)/2k ; KCL y: (x-y)/2k = (y-5)/1k + y/2k
    // → 2.5x - 0.5y = 10 ; -0.5x + 2y = 5 → x = 4.5263…, y = 3.6316…
    const x = (10 * 2 + 0.5 * 5) / (2.5 * 2 - 0.25);
    const y = (5 + 0.5 * x) / 2;
    expect(s.nodeVoltages.x).toBeCloseTo(x, 10);
    expect(s.nodeVoltages.y).toBeCloseTo(y, 10);
  });

  it("chooses a reference per isolated network", () => {
    const s = ok(solveDC(circuit([V("V1", "a", "b", 5), R("R1", "a", "b", 10), R("R2", "c", "d", 10)])));
    expect(s.references.a).toBe("b");
    expect(s.references.c).not.toBe("b");
    expect(s.componentCurrents.R2).toBe(0);
  });

  it("returns null voltage between isolated networks", () => {
    const s = ok(solveDC(circuit([V("V1", "a", "b", 5), R("R1", "a", "b", 10), S("S1", "a", "z", false), R("R2", "z", "y", 10)])));
    expect(s.componentVoltages.S1).toBeNull();
  });
});

describe("open circuits", () => {
  it("an open switch stops current and drops the full source voltage", () => {
    const s = ok(solveDC(circuit([V("V1", "a", "g", 9), S("S1", "a", "b", false), R("R1", "b", "g", 100)], "g")));
    expect(s.componentCurrents.R1).toBe(0);
    expect(s.componentCurrents.S1).toBe(0);
    expect(s.componentVoltages.S1).toBeCloseTo(9, 12);
    expect(s.componentVoltages.R1).toBeCloseTo(0, 12);
  });
  it("a closed switch conducts and reports its current", () => {
    const s = ok(solveDC(circuit([V("V1", "a", "g", 9), S("S1", "a", "b", true), R("R1", "b", "g", 100)], "g")));
    expect(s.componentCurrents.S1).toBeCloseTo(0.09, 12);
    expect(s.componentVoltages.S1).toBe(0);
  });
});

describe("wire currents", () => {
  it("resolves currents through a tree of wires by KCL", () => {
    const s = ok(solveDC(circuit([V("V1", "a", "g", 10), W("W1", "a", "b"), W("W2", "b", "c"), R("R1", "b", "g", 10), R("R2", "c", "g", 10)], "g")));
    expect(s.componentCurrents.W1).toBeCloseTo(2, 12);
    expect(s.componentCurrents.W2).toBeCloseTo(1, 12);
  });
  it("reports indeterminate current for parallel ideal wires", () => {
    const s = ok(solveDC(circuit([V("V1", "a", "g", 10), W("W1", "a", "b"), W("W2", "a", "b"), R("R1", "b", "g", 10)], "g")));
    expect(s.componentCurrents.W1).toBeNull();
    expect(s.componentCurrents.W2).toBeNull();
    expect(s.componentCurrents.R1).toBeCloseTo(1, 12);
  });
});

describe("short circuits", () => {
  it("detects an ideal voltage source shorted by a wire", () => {
    const r = solveDC(circuit([V("V1", "a", "g", 12), W("W1", "a", "g"), R("R1", "a", "g", 100)]));
    expect(r.status).toBe("short-circuit");
    if (r.status !== "ok") expect(r.issues[0]!.componentIds).toContain("V1");
  });
  it("detects a short through a closed switch", () => {
    const r = solveDC(circuit([V("V1", "a", "g", 12), S("S1", "a", "g", true)]));
    expect(r.status).toBe("short-circuit");
  });
  it("a current-limited supply enters constant-current mode instead", () => {
    const s = ok(solveDC(circuit([V("PS", "a", "g", 12, 3), W("W1", "a", "g")])));
    expect(s.sourceModes.PS).toBe("constant-current");
    expect(s.componentCurrents.PS).toBeCloseTo(3, 12);
    expect(s.componentCurrents.W1).toBeCloseTo(3, 12);
  });
  it("crosses over to CC mode when the load demands more than the limit", () => {
    const s = ok(solveDC(circuit([V("PS", "a", "g", 12, 0.5), R("R1", "a", "g", 10)])));
    expect(s.sourceModes.PS).toBe("constant-current");
    expect(s.componentCurrents.R1).toBeCloseTo(0.5, 12);
    expect(s.componentVoltages.PS).toBeCloseTo(5, 12);
  });
  it("stays in CV mode below the limit", () => {
    const s = ok(solveDC(circuit([V("PS", "a", "g", 12, 0.5), R("R1", "a", "g", 100)])));
    expect(s.sourceModes.PS).toBe("constant-voltage");
    expect(s.componentCurrents.R1).toBeCloseTo(0.12, 12);
  });
});

describe("invalid circuits", () => {
  it("rejects parallel ideal voltage sources", () => {
    const r = solveDC(circuit([V("V1", "a", "g", 12), V("V2", "a", "g", 9), R("R1", "a", "g", 10)]));
    expect(r.status).toBe("invalid");
    if (r.status !== "ok") expect(r.issues[0]!.code).toBe("voltage-source-loop");
  });
  it("rejects a current source with no return path", () => {
    const r = solveDC(circuit([{ kind: "current-source", id: "I1", from: "a", to: "b", current: 0.01 }, R("R1", "b", "c", 10)]));
    expect(r.status).toBe("invalid");
    if (r.status !== "ok") expect(r.issues[0]!.code).toBe("current-source-cutset");
  });
  it("rejects duplicate ids", () => {
    const r = solveDC(circuit([V("X", "a", "g", 1), R("X", "a", "g", 1)]));
    expect(r.status).toBe("invalid");
  });
  it("schema validation rejects non-positive resistance and wrong versions", () => {
    expect(parseCircuit({ schemaVersion: 1, id: "c", components: [{ kind: "resistor", id: "R", a: "a", b: "b", resistance: 0 }] }).ok).toBe(false);
    expect(parseCircuit({ schemaVersion: 2, id: "c", components: [] }).ok).toBe(false);
    expect(parseCircuit({ schemaVersion: 1, id: "c", components: [{ kind: "resistor", id: "R", a: "a", b: "b", resistance: Infinity }] }).ok).toBe(false);
    expect(parseCircuit(circuit([V("V1", "a", "g", 1)])).ok).toBe(true);
  });
});

describe("extension points", () => {
  it("reports unimplemented analyses as unsupported", () => {
    const r = runAnalysis({ kind: "ac-sweep", circuit: circuit([]), frequenciesHz: [60] });
    expect(r.result.status).toBe("unsupported");
  });
  it("exports a SPICE netlist", () => {
    const text = toSpiceNetlist(circuit([V("V1", "a", "g", 12), R("R1", "a", "g", 240)], "g"));
    expect(text).toContain("VV1 a 0 DC 12");
    expect(text).toContain("RR1 a 0 240");
    expect(text).toContain(".op");
  });
});
