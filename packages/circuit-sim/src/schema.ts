import { z } from "zod";

/**
 * Versioned circuit definition contract.
 *
 * A circuit is a flat list of two-terminal components that reference nodes by
 * name. Nodes are implicit: any string used as a terminal is a node.
 * Every numeric value is in SI base units.
 */
export const CIRCUIT_SCHEMA_VERSION = 1 as const;

const identifier = z.string().min(1).max(64);
const positive = z.number().positive();

export const ResistorSchema = z.object({
  kind: z.literal("resistor"),
  id: identifier,
  a: identifier,
  b: identifier,
  /** Ohms. Must be finite and > 0; an open component is modelled by removing it. */
  resistance: positive,
});

/** Ideal zero-impedance conductor. */
export const WireSchema = z.object({
  kind: z.literal("wire"),
  id: identifier,
  a: identifier,
  b: identifier,
});

/** Maintained switch: closed = ideal conductor, open = no connection. */
export const SwitchSchema = z.object({
  kind: z.literal("switch"),
  id: identifier,
  a: identifier,
  b: identifier,
  closed: z.boolean(),
});

/**
 * Independent DC voltage source. `currentLimit` (A) optionally models a
 * bench supply with constant-voltage / constant-current crossover.
 */
export const VoltageSourceSchema = z.object({
  kind: z.literal("voltage-source"),
  id: identifier,
  positive: identifier,
  negative: identifier,
  voltage: z.number(),
  currentLimit: positive.optional(),
});

/** Independent DC current source; current flows through the source from `from` to `to`. */
export const CurrentSourceSchema = z.object({
  kind: z.literal("current-source"),
  id: identifier,
  from: identifier,
  to: identifier,
  current: z.number(),
});

/** Momentary pushbutton (spring return). */
export const PushbuttonSchema = z.object({
  kind: z.literal("pushbutton"),
  id: identifier,
  a: identifier,
  b: identifier,
  contact: z.enum(["NO", "NC"]),
  pressed: z.boolean(),
});

/**
 * Electromechanical relay / contactor coil, modelled as a resistive load with
 * pickup and dropout voltage thresholds (hysteresis).
 */
export const RelayCoilSchema = z
  .object({
    kind: z.literal("relay-coil"),
    id: identifier,
    a: identifier,
    b: identifier,
    resistance: positive,
    pickupVoltage: positive,
    dropoutVoltage: positive,
  })
  .refine((c) => c.dropoutVoltage < c.pickupVoltage, {
    message: "dropoutVoltage must be lower than pickupVoltage",
  });

/** Contact actuated by a relay coil elsewhere in the same circuit. */
export const RelayContactSchema = z.object({
  kind: z.literal("relay-contact"),
  id: identifier,
  a: identifier,
  b: identifier,
  coilId: identifier,
  contact: z.enum(["NO", "NC"]),
});

export const ComponentSchema = z.union([
  ResistorSchema,
  WireSchema,
  SwitchSchema,
  VoltageSourceSchema,
  CurrentSourceSchema,
  PushbuttonSchema,
  RelayCoilSchema,
  RelayContactSchema,
]);

export const CircuitSchema = z.object({
  schemaVersion: z.literal(CIRCUIT_SCHEMA_VERSION),
  id: identifier,
  /** Optional reference node (0 V). Otherwise one is chosen per isolated network. */
  ground: identifier.optional(),
  components: z.array(ComponentSchema),
});

export type Resistor = z.infer<typeof ResistorSchema>;
export type Wire = z.infer<typeof WireSchema>;
export type Switch = z.infer<typeof SwitchSchema>;
export type VoltageSource = z.infer<typeof VoltageSourceSchema>;
export type CurrentSource = z.infer<typeof CurrentSourceSchema>;
export type Pushbutton = z.infer<typeof PushbuttonSchema>;
export type RelayCoil = z.infer<typeof RelayCoilSchema>;
export type RelayContact = z.infer<typeof RelayContactSchema>;
export type Component = z.infer<typeof ComponentSchema>;
export type ComponentKind = Component["kind"];
export type Circuit = z.infer<typeof CircuitSchema>;

export type ParseResult =
  | { readonly ok: true; readonly circuit: Circuit }
  | { readonly ok: false; readonly errors: string[] };

/** Validate untrusted input (e.g. from storage or a challenge file). */
export function parseCircuit(input: unknown): ParseResult {
  const parsed = CircuitSchema.safeParse(input);
  if (parsed.success) return { ok: true, circuit: parsed.data };
  return {
    ok: false,
    errors: parsed.error.issues.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`),
  };
}

/** Terminal pair of any two-terminal component, in its sign convention order. */
export function terminalsOf(component: Component): readonly [string, string] {
  switch (component.kind) {
    case "voltage-source":
      return [component.positive, component.negative];
    case "current-source":
      return [component.from, component.to];
    default:
      return [component.a, component.b];
  }
}
