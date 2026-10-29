import { describe, expect, it } from "vitest";
import { formatMeterDisplay, formatQuantity, measure } from "../src";
import { circuit, R, V, W } from "./helpers";

// 12 V across R1 (1 kΩ) and R2 (2 kΩ) in series; jumper J1 between posts a and a2.
const series = (jumper: boolean, supplyOn = true) =>
  circuit([
    ...(supplyOn ? [V("PS", "a", "g", 12, 3)] : []),
    ...(jumper ? [W("J1", "a", "a2")] : []),
    R("R1", "a2", "m", 1000),
    R("R2", "m", "g", 2000),
  ]);

describe("multimeter — voltage", () => {
  it("reads voltage across a resistor including 10 MΩ loading", () => {
    const r = measure(series(true), { mode: "dc-voltage", red: "m", black: "g" });
    expect(r.status).toBe("ok");
    // Thevenin: 8 V behind 666.7 Ω; 10 MΩ input loads it by ≈ 0.007 %.
    const rth = (1000 * 2000) / 3000;
    expect(r.value).toBeCloseTo((8 * 10e6) / (10e6 + rth), 9);
    expect(r.display).toBe("8.00"); // 6000 counts: 6–60 V range has two decimals
  });
  it("reads negative voltage with reversed probes", () => {
    const r = measure(series(true), { mode: "dc-voltage", red: "g", black: "a" });
    expect(r.value).toBeCloseTo(-12, 6);
    expect(r.display).toBe("-12.00");
  });
  it("reads source voltage across an open (removed jumper)", () => {
    const r = measure(series(false), { mode: "dc-voltage", red: "a", black: "a2" });
    // The meter's 10 MΩ completes the loop through the 3 kΩ load.
    expect(r.value).toBeCloseTo((12 * 10e6) / (10e6 + 3000), 9);
  });
});

describe("multimeter — current", () => {
  it("reads series current when inserted across a break", () => {
    const r = measure(series(false), { mode: "dc-current", red: "a", black: "a2" });
    expect(r.status).toBe("ok");
    expect(r.value).toBeCloseTo(12 / 3000.1, 9);
    expect(r.hazards).toHaveLength(0);
    expect(r.displayUnit).toBe("mA");
  });
  it("flags an ammeter placed directly across the source", () => {
    const r = measure(series(true), { mode: "dc-current", red: "a", black: "g" });
    expect(r.hazards.map((h) => h.code)).toContain("ammeter-across-source");
    // The current-limited supply enters CC mode at 3 A; the 0.1 Ω shunt takes nearly all of it.
    expect(r.value).toBeCloseTo((3 * 3000) / 3000.1, 9);
    expect(r.notes.join(" ")).toMatch(/CC/);
  });
  it("flags a parallel ammeter across a load as a technique error", () => {
    const r = measure(series(true), { mode: "dc-current", red: "a2", black: "m" });
    expect(r.hazards.map((h) => h.code)).toContain("ammeter-in-parallel-with-load");
    expect(r.hazards[0]!.severity).toBe("technique");
  });
  it("blows the fuse above its rating with an unlimited source", () => {
    const r = measure(circuit([V("V1", "a", "g", 12), R("R1", "a", "g", 100)]), { mode: "dc-current", red: "a", black: "g" });
    expect(r.status).toBe("fuse-blown");
    expect(r.blowsFuse).toBe(true);
  });
  it("reads zero with a blown fuse", () => {
    const r = measure(series(false), { mode: "dc-current", red: "a", black: "a2", fuseIntact: false });
    expect(r.status).toBe("fuse-blown");
    expect(r.value).toBe(0);
  });
});

describe("multimeter — resistance", () => {
  it("refuses to give a valid reading on an energized circuit", () => {
    const r = measure(series(true), { mode: "resistance", red: "a2", black: "m" });
    expect(r.status).toBe("invalid-energized");
    expect(r.hazards[0]!.code).toBe("ohmmeter-on-energized-circuit");
  });
  it("measures a resistor in a de-energized circuit (parallel paths included)", () => {
    // With the supply removed, R1 is measured alone between a2 and m because the other path is open.
    const r = measure(series(true, false), { mode: "resistance", red: "a2", black: "m" });
    expect(r.status).toBe("ok");
    expect(r.value).toBeCloseTo(1000, 6);
    expect(r.display).toBe("1.000");
    expect(r.displayUnit).toBe("kΩ");
  });
  it("measures the series total", () => {
    const r = measure(series(true, false), { mode: "resistance", red: "a", black: "g" });
    expect(r.value).toBeCloseTo(3000, 6);
  });
  it("shows OL across an open circuit", () => {
    const r = measure(series(false, false), { mode: "resistance", red: "a", black: "a2" });
    expect(r.display).toBe("OL");
  });
  it("beeps for continuity through a jumper", () => {
    const r = measure(series(true, false), { mode: "continuity", red: "a", black: "a2" });
    expect(r.annunciators).toContain("BEEP");
  });
});

describe("display formatting", () => {
  it("auto-ranges on a 6000-count display", () => {
    expect(formatMeterDisplay(12, "V")).toEqual({ text: "12.00", unitText: "V" });
    expect(formatMeterDisplay(0.05, "A")).toEqual({ text: "50.00", unitText: "mA" });
    expect(formatMeterDisplay(470, "Ω")).toEqual({ text: "470.0", unitText: "Ω" });
    expect(formatMeterDisplay(0.75, "V")).toEqual({ text: "0.750", unitText: "V" });
    expect(formatMeterDisplay(4700, "Ω")).toEqual({ text: "4.700", unitText: "kΩ" });
  });
  it("formats engineering quantities", () => {
    expect(formatQuantity(0.0472, "A")).toBe("47.20 mA");
    expect(formatQuantity(4700, "Ω")).toBe("4.700 kΩ");
    expect(formatQuantity(0.9999999, "V")).toBe("1.000 V");
  });
});
