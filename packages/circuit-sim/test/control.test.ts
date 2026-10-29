import { describe, expect, it } from "vitest";
import { settleControlCircuit, type Circuit, type Component } from "../src";

const coil = (id: string, a: string, b: string): Component => ({ kind: "relay-coil", id, a, b, resistance: 400, pickupVoltage: 18, dropoutVoltage: 8 });

/** Classic three-wire start/stop station with a seal-in contact. */
function startStop(startPressed: boolean, stopPressed: boolean): Circuit {
  return {
    schemaVersion: 1,
    id: "start-stop",
    ground: "N",
    components: [
      { kind: "voltage-source", id: "CT", positive: "L", negative: "N", voltage: 24 },
      { kind: "pushbutton", id: "STOP", a: "L", b: "s1", contact: "NC", pressed: stopPressed },
      { kind: "pushbutton", id: "START", a: "s1", b: "s2", contact: "NO", pressed: startPressed },
      { kind: "relay-contact", id: "M-seal", a: "s1", b: "s2", coilId: "M", contact: "NO" },
      coil("M", "s2", "N"),
      { kind: "relay-contact", id: "M-aux", a: "L", b: "lamp", coilId: "M", contact: "NO" },
      { kind: "resistor", id: "PL", a: "lamp", b: "N", resistance: 480 },
    ],
  };
}

describe("relay control logic", () => {
  it("stays de-energized until START is pressed", () => {
    const r = settleControlCircuit(startStop(false, false));
    expect(r.status).toBe("stable");
    if (r.status === "stable") expect(r.coilStates.M).toBe(false);
  });

  it("energizes on START and seals in after release", () => {
    const pressed = settleControlCircuit(startStop(true, false));
    expect(pressed.status === "stable" && pressed.coilStates.M).toBe(true);
    if (pressed.status !== "stable") return;
    const released = settleControlCircuit(startStop(false, false), pressed.coilStates);
    expect(released.status === "stable" && released.coilStates.M).toBe(true);
    if (released.status === "stable") expect(released.solution.componentCurrents.PL).toBeCloseTo(0.05, 12);
  });

  it("drops out when STOP is pressed", () => {
    const r = settleControlCircuit(startStop(false, true), { M: true });
    expect(r.status === "stable" && r.coilStates.M).toBe(false);
  });

  it("an NC contact opens when its coil energizes", () => {
    const c: Circuit = {
      schemaVersion: 1,
      id: "nc",
      components: [
        { kind: "voltage-source", id: "V", positive: "L", negative: "N", voltage: 24 },
        coil("K1", "L", "N"),
        { kind: "relay-contact", id: "K1-nc", a: "L", b: "x", coilId: "K1", contact: "NC" },
        { kind: "resistor", id: "R", a: "x", b: "N", resistance: 100 },
      ],
    };
    const r = settleControlCircuit(c);
    expect(r.status).toBe("stable");
    if (r.status === "stable") {
      expect(r.coilStates.K1).toBe(true);
      expect(r.solution.componentCurrents.R).toBe(0);
    }
  });

  it("detects oscillation of a coil fed through its own NC contact", () => {
    const c: Circuit = {
      schemaVersion: 1,
      id: "buzzer",
      components: [
        { kind: "voltage-source", id: "V", positive: "L", negative: "N", voltage: 24 },
        { kind: "relay-contact", id: "K1-nc", a: "L", b: "x", coilId: "K1", contact: "NC" },
        coil("K1", "x", "N"),
      ],
    };
    expect(settleControlCircuit(c).status).toBe("oscillating");
  });

  it("respects the hysteresis band", () => {
    const c = (volts: number): Circuit => ({
      schemaVersion: 1,
      id: "h",
      components: [{ kind: "voltage-source", id: "V", positive: "L", negative: "N", voltage: volts }, coil("K", "L", "N")],
    });
    const mid = 12; // between dropout (8) and pickup (18)
    expect(settleControlCircuit(c(mid), { K: false }).status === "stable" && settleControlCircuit(c(mid), { K: false })).toMatchObject({ coilStates: { K: false } });
    expect(settleControlCircuit(c(mid), { K: true })).toMatchObject({ coilStates: { K: true } });
  });
});
