import { ModuleSchema, type CurriculumModule } from "./schema";

type Draft = Omit<CurriculumModule, "tier" | "order" | "status" | "lessonSlugs" | "skills"> & Partial<Pick<CurriculumModule, "lessonSlugs" | "skills" | "status">>;

const tier = (t: CurriculumModule["tier"], items: Draft[]): CurriculumModule[] =>
  items.map((m, i) =>
    ModuleSchema.parse({
      tier: t,
      order: i + 1,
      lessonSlugs: [],
      skills: [],
      status: m.lessonSlugs && m.lessonSlugs.length > 0 ? "available" : "planned",
      ...m,
    }),
  );

export const TIER_1_MODULES = tier("tier-1", [
  { id: "t1-safety", title: "Electrical Safety Fundamentals", summary: "Hazards, safe isolation, lockout/tagout principles and verifying the absence of voltage.", lessonSlugs: ["electrical-safety-fundamentals"], skills: ["safety.hazard-recognition", "safety.de-energize"] },
  { id: "t1-quantities", title: "Electrical Quantities and Units", summary: "SI units, prefixes and the quantities used throughout electrical work." },
  { id: "t1-vir", title: "Voltage, Current and Resistance", summary: "What each quantity is physically and how they relate in a circuit." },
  { id: "t1-ohms-law", title: "Ohm's Law", summary: "The linear relationship V = I × R, applied to calculation, design and measurement.", lessonSlugs: ["ohms-law"], skills: ["ohms-law.calculate", "ohms-law.apply", "meter.current"] },
  { id: "t1-power", title: "Electrical Power", summary: "Power, energy and component power ratings." },
  { id: "t1-series", title: "Series Circuits", summary: "Shared current, additive resistance and voltage division.", skills: ["circuits.series"] },
  { id: "t1-parallel", title: "Parallel Circuits", summary: "Shared voltage, branch currents and equivalent resistance.", skills: ["circuits.parallel"] },
  { id: "t1-components", title: "Basic Circuit Components", summary: "Resistors, switches, fuses, lamps and their ratings." },
  { id: "t1-multimeter", title: "Multimeter Fundamentals", summary: "Meter functions, input impedance, category ratings and safe technique.", skills: ["meter.voltage", "meter.current", "meter.resistance"] },
  { id: "t1-troubleshooting", title: "Introductory Electrical Troubleshooting", summary: "Systematic fault finding for opens and shorts.", skills: ["troubleshooting.open-circuit"] },
  { id: "t1-ac", title: "AC Fundamentals", summary: "Sinusoidal waveforms, frequency, RMS values and phase." },
  { id: "t1-schematics", title: "Basic Electrical Schematics", summary: "Reading symbols, nodes and circuit diagrams." },
]);

export const TIER_2_MODULES = tier("tier-2", [
  { id: "t2-schematics", title: "Industrial Electrical Schematics", summary: "Ladder diagrams, wire numbering and cross-referencing." },
  { id: "t2-control", title: "Control Circuit Fundamentals", summary: "Control versus power circuits and control voltages." },
  { id: "t2-relays", title: "Relays and Contactors", summary: "Coils, contacts, ratings and seal-in logic." },
  { id: "t2-operators", title: "Pushbuttons and Selector Switches", summary: "NO/NC operators, maintained and momentary devices." },
  { id: "t2-motor-control", title: "Motor Control Circuits", summary: "Start/stop stations, starters and interlocking." },
  { id: "t2-overload", title: "Overload Protection", summary: "Thermal and electronic overloads and coordination." },
  { id: "t2-three-phase", title: "Three-Phase Electrical Fundamentals", summary: "Line and phase quantities, wye and delta." },
  { id: "t2-sensors", title: "Industrial Sensors", summary: "Proximity, photoelectric and limit devices." },
  { id: "t2-control-transformers", title: "Control Transformers", summary: "Sizing, fusing and grounding of control power." },
  { id: "t2-fault-diagnosis", title: "Electrical Fault Diagnosis", summary: "Systematic diagnosis of control and power faults." },
  { id: "t2-pm", title: "Preventive Maintenance Concepts", summary: "Inspection, thermography and maintenance planning." },
  { id: "t2-plc-intro", title: "Introductory PLC Concepts", summary: "Inputs, outputs, scan cycle and ladder logic basics." },
]);

export const ALL_MODULES: readonly CurriculumModule[] = [...TIER_1_MODULES, ...TIER_2_MODULES];

export const PATHWAYS = [
  {
    id: "tier-1",
    href: "/academy/tier-1",
    title: "Industrial Maintenance — Tier 1",
    subtitle: "Electrical fundamentals",
    description: "Safety, quantities, Ohm's law, series and parallel circuits, instruments and first troubleshooting.",
    modules: TIER_1_MODULES,
  },
  {
    id: "tier-2",
    href: "/academy/tier-2",
    title: "Industrial Maintenance — Tier 2",
    subtitle: "Industrial controls and troubleshooting",
    description: "Control circuits, relays, motor starters, protection, three-phase power and fault diagnosis.",
    modules: TIER_2_MODULES,
  },
] as const;

/** Future disciplines the architecture is designed to accommodate (not yet implemented). */
export const FUTURE_PATHWAYS = ["Tier 3 — Advanced maintenance", "PLC programming", "Industrial automation", "Robotics", "Mechatronics"] as const;
