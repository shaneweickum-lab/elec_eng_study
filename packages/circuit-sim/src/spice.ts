import type { Circuit } from "./schema";
import type { CoilStates } from "./topology";
import { linkState } from "./topology";

/**
 * Export a circuit as a SPICE-compatible netlist for cross-validation with an
 * external simulator (e.g. ngspice). Ideal links become 0 V voltage sources,
 * which is the conventional SPICE idiom for an ammeter / zero-ohm link.
 */
export function toSpiceNetlist(circuit: Circuit, coilStates: CoilStates = {}): string {
  const node = (name: string) => (name === circuit.ground ? "0" : name.replace(/[^A-Za-z0-9_]/g, "_"));
  const lines = [`* ${circuit.id} (exported by @iea/circuit-sim)`];
  for (const c of circuit.components) {
    const name = c.id.replace(/[^A-Za-z0-9_]/g, "_");
    switch (c.kind) {
      case "resistor":
        lines.push(`R${name} ${node(c.a)} ${node(c.b)} ${c.resistance}`);
        break;
      case "relay-coil":
        lines.push(`R${name} ${node(c.a)} ${node(c.b)} ${c.resistance} ; relay coil`);
        break;
      case "voltage-source":
        lines.push(`V${name} ${node(c.positive)} ${node(c.negative)} DC ${c.voltage}`);
        break;
      case "current-source":
        // SPICE: current flows from n+ through the source to n−.
        lines.push(`I${name} ${node(c.from)} ${node(c.to)} DC ${c.current}`);
        break;
      default:
        if (linkState(c, coilStates) === "closed") lines.push(`V${name} ${node(c.a)} ${node(c.b)} DC 0 ; closed ${c.kind}`);
        else lines.push(`* ${c.kind} ${c.id} open`);
    }
  }
  lines.push(".op", ".end");
  return lines.join("\n");
}
