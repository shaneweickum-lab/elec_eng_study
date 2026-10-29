import type { Circuit, Component } from "../src";

export const circuit = (components: Component[], ground?: string): Circuit => ({
  schemaVersion: 1,
  id: "test",
  ...(ground ? { ground } : {}),
  components,
});
export const R = (id: string, a: string, b: string, resistance: number): Component => ({ kind: "resistor", id, a, b, resistance });
export const V = (id: string, positive: string, negative: string, voltage: number, currentLimit?: number): Component => ({
  kind: "voltage-source",
  id,
  positive,
  negative,
  voltage,
  ...(currentLimit ? { currentLimit } : {}),
});
export const W = (id: string, a: string, b: string): Component => ({ kind: "wire", id, a, b });
export const S = (id: string, a: string, b: string, closed: boolean): Component => ({ kind: "switch", id, a, b, closed });
