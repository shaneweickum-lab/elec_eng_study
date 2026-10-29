import { SkillSchema, type Skill } from "./schema";

const raw: Skill[] = [
  { id: "safety.hazard-recognition", name: "Electrical hazard recognition", tier: "tier-1", category: "safety", description: "Identify shock, arc-flash and stored-energy hazards and the controls that address them.", prerequisites: [] },
  { id: "safety.de-energize", name: "De-energize before work", tier: "tier-1", category: "safety", description: "Remove power before changing wiring or components, and keep it off while working.", prerequisites: ["safety.hazard-recognition"] },
  { id: "ohms-law.calculate", name: "Ohm's law calculation", tier: "tier-1", category: "theory", description: "Calculate voltage, current or resistance from the other two quantities, with correct units.", prerequisites: [] },
  { id: "ohms-law.apply", name: "Ohm's law application", tier: "tier-1", category: "theory", description: "Select component values to achieve a required circuit condition.", prerequisites: ["ohms-law.calculate"] },
  { id: "meter.voltage", name: "Voltage measurement", tier: "tier-1", category: "instruments", description: "Measure voltage across components with correct probe placement and polarity.", prerequisites: [] },
  { id: "meter.current", name: "Current measurement", tier: "tier-1", category: "instruments", description: "Measure current by inserting the meter in series, de-energizing to make connections.", prerequisites: ["safety.de-energize"] },
  { id: "meter.resistance", name: "Resistance measurement", tier: "tier-1", category: "instruments", description: "Measure resistance and continuity only on isolated, de-energized circuits.", prerequisites: ["safety.de-energize"] },
  { id: "circuits.series", name: "Series circuit analysis", tier: "tier-1", category: "circuits", description: "Apply series resistance, shared current and voltage division.", prerequisites: ["ohms-law.calculate"] },
  { id: "circuits.parallel", name: "Parallel circuit analysis", tier: "tier-1", category: "circuits", description: "Apply shared voltage, branch currents and equivalent resistance.", prerequisites: ["ohms-law.calculate"] },
  { id: "troubleshooting.open-circuit", name: "Open-circuit diagnosis", tier: "tier-1", category: "troubleshooting", description: "Locate an open in a series circuit from measurements.", prerequisites: ["meter.voltage", "circuits.series"] },
];

export const SKILLS: readonly Skill[] = raw.map((s) => SkillSchema.parse(s));

export function getSkill(id: string): Skill | undefined {
  return SKILLS.find((s) => s.id === id);
}
