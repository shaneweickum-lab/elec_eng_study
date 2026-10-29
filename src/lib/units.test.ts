import { describe, expect, it } from "vitest";
import { parseEngineering } from "./units";

describe("parseEngineering", () => {
  it.each([
    ["4.7k", 4700],
    ["4.7 kΩ", 4700],
    ["50mA", 0.05],
    ["50 m", 0.05],
    ["2.2M", 2.2e6],
    ["0.05", 0.05],
    ["2,200", 2200],
    ["250µA", 250e-6],
    ["250uA", 250e-6],
    ["12V", 12],
    ["1e-3", 0.001],
  ])("%s → %d", (input, expected) => {
    expect(parseEngineering(input)).toBeCloseTo(expected, 12);
  });
  it.each(["", "abc", "4.7x", "--1"])("rejects %s", (input) => {
    expect(parseEngineering(input)).toBeNull();
  });
});
