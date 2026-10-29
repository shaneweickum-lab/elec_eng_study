# Simulation engine — `@iea/circuit-sim`

A framework-independent TypeScript package. It accepts a versioned circuit definition and returns structured results; it never depends on React, Next.js, PixiJS or Supabase.

## Units

All quantities are stored in coherent SI units: volts (V), amperes (A), ohms (Ω), watts (W). Formatting (`formatQuantity`, `formatMeterDisplay`) is presentation only and never feeds back into calculation.

## Circuit definition (schema version 1)

```ts
{
  schemaVersion: 1,
  id: "training-bench",
  ground?: "T7",                 // optional 0 V reference
  components: [
    { kind: "voltage-source", id: "PS1", positive: "T1", negative: "T7", voltage: 12, currentLimit?: 1 },
    { kind: "resistor", id: "R1", a: "T2", b: "T8", resistance: 470 },
    { kind: "wire", id: "J1", a: "T1", b: "T2" },
    { kind: "switch", id: "S1", a: "x", b: "y", closed: true },
    { kind: "current-source", id: "I1", from: "a", to: "b", current: 0.001 },
    { kind: "pushbutton", id: "START", a, b, contact: "NO" | "NC", pressed },
    { kind: "relay-coil", id: "K1", a, b, resistance, pickupVoltage, dropoutVoltage },
    { kind: "relay-contact", id: "K1-1", a, b, coilId: "K1", contact: "NO" | "NC" },
  ]
}
```

Nodes are implicit (any terminal name). `parseCircuit()` validates untrusted input with Zod (positive finite resistance, version literal, etc.).

## DC operating point (`solveDC`)

Modified Nodal Analysis:

1. **Supernodes** — ideal links (wires, closed switches, conducting contacts and pushbuttons) are merged with union-find. Open links are absent.
2. **Isolated networks** — each connected group of supernodes receives its own reference: the declared ground, else a voltage source's negative terminal, else the lexicographically smallest node. Voltages between isolated networks are reported as `null` (undefined), never as a number.
3. **Unknowns** — non-reference supernode voltages plus one branch current per constant-voltage source.
4. **Stamps** — conductance `1/R` for resistors and coils; injections for current sources; the standard ±1 MNA pattern for voltage sources.
5. **Solve** — dense Gaussian elimination with partial pivoting. A pivot below `1e-13 × max|A|` is treated as singular.
6. **Classification of failures**
   - `short-circuit / ideal-source-short` — an ideal source with V ≠ 0 whose terminals collapse to one supernode. An ideal source would deliver unbounded current, so no finite answer is fabricated.
   - `invalid / voltage-source-loop` — ideal sources in a loop (e.g. two in parallel).
   - `invalid / current-source-cutset` — a current source with no return path.
   - `singular / singular-matrix` — anything else.
   - `invalid / duplicate-id`, `unknown-coil` — semantic errors found before solving.
7. **Current-limited sources** — a source with `currentLimit` starts in constant-voltage (CV) mode; if it would deliver more than the limit it becomes a constant-current (CC) source; if its terminal voltage in CC would exceed its set-point it returns to CV. Iterates to consistency (max 12). A limited supply that is short-circuited goes straight to CC (bench-supply behavior).
8. **Link currents** — currents in ideal links follow from KCL: in a supernode whose links form a tree the solution is unique (computed by subtree sums); loops of ideal conductors make the split indeterminate and those currents are reported as `null`.

Sign conventions: two-terminal currents are positive from `a` to `b` through the part; voltage sources report current delivered out of the positive terminal; power is absorbed power (sources negative when delivering).

## Relay / control settling (`settleControlCircuit`)

Coils are resistive loads with pickup and dropout thresholds. After each solve every coil updates (|V| ≥ pickup → energized; |V| < dropout → de-energized; otherwise unchanged). Contacts follow their coils, changing topology, so the process repeats until stable. A revisited state is reported as `oscillating` (e.g. a coil fed through its own NC contact).

Simplifications: no coil inductance, contact bounce, operate/release time, or arc suppression. Timers, overloads, motors and three-phase sources are not yet modeled (see roadmap).

## Virtual multimeter (`measure`)

The meter is inserted into the circuit as an element, so readings come from the same solver.

| Function | Model | Notes |
| --- | --- | --- |
| DC voltage | 10 MΩ between probes | Real loading error is visible on high-impedance nodes. |
| DC current | 0.1 Ω shunt between probes, 10 A fuse | Must be in series (across a break). |
| Resistance | 1 mA test current into the passive network | Only valid when no source is present in the probed network. |
| Continuity | Resistance model, beep below 50 Ω | |

Display: auto-ranging 6000-count formatting (e.g. `12.00 V`, `50.00 mA`, `4.700 kΩ`, `OL`).

Hazard detection (reported with every reading):

| Code | Severity | Condition |
| --- | --- | --- |
| `ohmmeter-on-energized-circuit` | violation | Resistance/continuity on a network containing a non-zero source. Reading shown as `----`. |
| `ammeter-across-source` | violation | Current mode with probes directly across a voltage source. |
| `ammeter-in-parallel-with-load` | technique | Current mode bypassing an energized load. |
| `ammeter-overcurrent` | violation | Meter current exceeds the fuse rating; the fuse opens and stays open until replaced. |

## Extension points

- `runAnalysis(request)` — `dc-operating-point` is implemented; `ac-sweep` and `transient` return `unsupported` until implemented (complex-valued MNA and companion-model integration respectively).
- `toSpiceNetlist(circuit)` — exports SPICE so results can be cross-validated with ngspice. Ideal links are exported as 0 V sources.
- New components implement a stamp in `dc.ts` and a schema entry in `schema.ts`; control devices add a state rule in `control.ts`.

## Verification

`packages/circuit-sim/test/` covers Ohm's law, series and parallel analysis, a hand-derived two-source nodal problem, open circuits, wire-tree and indeterminate link currents, ideal shorts, CV/CC crossover, invalid circuits, schema validation, relay seal-in / drop-out / NC behavior / oscillation / hysteresis, every meter function and hazard, and display formatting.
