import { z } from "zod";

/**
 * Glossary of terminology that may not be common knowledge. Lesson text is
 * matched against `aliases` automatically (whole words, case-insensitive), so
 * new lessons pick up definitions without extra markup.
 *
 * Keep definitions short, plain-language and accurate; they are part of the
 * curriculum and go through the same technical review as lessons.
 */
export const GlossaryEntrySchema = z.object({
  id: z.string(),
  term: z.string(),
  aliases: z.array(z.string().min(2)).min(1),
  definition: z.string().min(10),
});
export type GlossaryEntry = z.infer<typeof GlossaryEntrySchema>;

const raw: GlossaryEntry[] = [
  // Fundamentals
  { id: "potential-difference", term: "Potential difference", aliases: ["potential difference"], definition: "The difference in electrical energy per unit of charge between two points. It is another name for voltage and is measured in volts." },
  { id: "charge", term: "Charge", aliases: ["charge"], definition: "A property of particles such as electrons. Moving charge is electric current. Charge is measured in coulombs (C)." },
  { id: "coulomb", term: "Coulomb", aliases: ["coulomb", "coulombs"], definition: "The SI unit of electric charge — roughly the charge of 6.24 × 10¹⁸ electrons." },
  { id: "ampere", term: "Ampere (amp)", aliases: ["ampere", "amperes", "milliamperes", "milliamps", "microamps"], definition: "The SI unit of current: one coulomb of charge passing a point every second. 1 mA (milliamp) = 0.001 A; 1 µA (microamp) = 0.000 001 A." },
  { id: "ohm", term: "Ohm (Ω)", aliases: ["ohm", "ohms", "kilohm", "kilohms", "megohm", "megohms"], definition: "The SI unit of resistance. One ohm lets one ampere flow when one volt is applied. 1 kΩ (kilohm) = 1 000 Ω; 1 MΩ (megohm) = 1 000 000 Ω." },
  { id: "ground-reference", term: "Common / ground reference", aliases: ["ground reference"], definition: "The point in a circuit chosen as 0 V, against which other voltages are measured. It is often, but not always, connected to earth." },
  { id: "proportional", term: "Directly proportional", aliases: ["directly proportional", "proportional"], definition: "Two quantities that change by the same factor: double one and the other doubles. “Inversely proportional” means double one and the other halves." },
  { id: "constant-of-proportionality", term: "Constant of proportionality", aliases: ["constant of proportionality"], definition: "The fixed number linking two proportional quantities. In V = I × R, the resistance R is the constant linking voltage and current." },
  { id: "ohmic", term: "Ohmic (linear) conductor", aliases: ["ohmic", "linear conductors", "linear conductor"], definition: "A conductor whose resistance stays constant as voltage and current change, so a graph of current against voltage is a straight line." },
  { id: "conductor", term: "Conductor", aliases: ["conductor", "conductors"], definition: "A material or wire that carries current easily, such as copper. In wiring, “conductor” usually means one insulated wire." },
  { id: "filament", term: "Filament", aliases: ["filament"], definition: "The thin wire inside an incandescent lamp that glows when current heats it. Its resistance rises considerably as it gets hot." },
  { id: "diode", term: "Diode", aliases: ["diode", "diodes"], definition: "A semiconductor device that lets current flow easily in one direction and blocks it in the other." },
  { id: "transistor", term: "Transistor", aliases: ["transistor", "transistors"], definition: "A semiconductor device that uses a small signal to control a larger current, used as an electronic switch or amplifier." },
  { id: "polarity", term: "Polarity", aliases: ["polarity"], definition: "Which terminal or point is positive and which is negative. Reversing the probes on a DC meter reverses the sign of the reading." },
  { id: "operating-point", term: "Operating point", aliases: ["operating point"], definition: "The particular voltage and current at which a device is working at a given moment." },
  { id: "orders-of-magnitude", term: "Order of magnitude", aliases: ["orders of magnitude", "order of magnitude"], definition: "A factor of ten. Values three orders of magnitude apart differ by a factor of 1 000." },
  { id: "leakage", term: "Leakage current", aliases: ["leakage current", "leakage"], definition: "A small, unintended current flowing where ideally none should — through insulation, or through a device that is switched off." },
  { id: "pull-up", term: "Pull-up resistor", aliases: ["pull-up resistors", "pull-up resistor", "pull-up"], definition: "A resistor that holds a signal line at a defined high voltage when nothing else is driving it, common on sensor and controller inputs." },
  { id: "insulation-resistance", term: "Insulation resistance", aliases: ["insulation readings", "insulation resistance"], definition: "The resistance of insulation between conductors, or between a conductor and ground — normally megohms or more. A low value indicates damaged, wet or contaminated insulation. It is measured with an insulation resistance tester." },
  { id: "base-units", term: "Base (SI) units", aliases: ["base units", "SI"], definition: "Units of the International System without a prefix: volts, amperes, ohms, watts. Convert to these before calculating." },
  { id: "e12", term: "E12 series", aliases: ["E12"], definition: "A standard set of 12 preferred values per decade — 1.0, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2 (times a power of ten) — in which resistors are manufactured. It was designed for ±10 % tolerance parts." },
  { id: "voltage-source", term: "Voltage source", aliases: ["voltage source", "voltage sources"], definition: "A device that maintains a voltage between its terminals, such as a battery or power supply." },
  { id: "load", term: "Load", aliases: ["load"], definition: "The device that uses the electrical energy in a circuit — a lamp, motor, heater or resistor." },
  { id: "series", term: "In series", aliases: ["in series", "series string"], definition: "Connected end to end in a single path, so the same current flows through every part." },
  { id: "parallel", term: "In parallel", aliases: ["in parallel"], definition: "Connected across the same two points, so every part has the same voltage across it and the currents divide between them." },
  { id: "short-circuit", term: "Short circuit", aliases: ["short circuits", "short circuit"], definition: "An unintended very low-resistance path that bypasses the load and lets excessive current flow." },
  { id: "open-circuit", term: "Open circuit", aliases: ["open circuit"], definition: "A break in the current path, so no current can flow. The full source voltage appears across the break." },
  { id: "fuse", term: "Fuse", aliases: ["fuse"], definition: "A protective device containing a metal link that melts and opens the circuit when current exceeds its rating for long enough. It must be replaced afterward." },

  // Instruments
  { id: "probe", term: "Probe", aliases: ["probe", "probes"], definition: "The insulated, hand-held tip of a test lead that touches the circuit. The red probe is the meter's positive input; black goes to COM (common)." },
  { id: "jack", term: "Jack", aliases: ["jack", "jacks"], definition: "A socket on the meter where the test leads plug in. Current measurements use a separate, fused jack." },
  { id: "input-resistance", term: "Input resistance", aliases: ["input resistance", "input impedance"], definition: "The resistance a meter presents between its probes. A voltmeter's high input resistance (about 10 MΩ) means it draws almost no current from the circuit it measures." },
  { id: "voltmeter", term: "Voltmeter", aliases: ["voltmeter"], definition: "An instrument, or meter function, that measures the voltage between two points. It is connected across (in parallel with) what it measures." },
  { id: "ammeter", term: "Ammeter", aliases: ["ammeter"], definition: "An instrument, or meter function, that measures current. It has very low resistance and must be connected in series with the circuit." },
  { id: "ohmmeter", term: "Ohmmeter", aliases: ["ohmmeter"], definition: "An instrument, or meter function, that measures resistance by passing its own small test current. Its readings are only valid on de-energized, isolated circuits." },
  { id: "clamp-meter", term: "Clamp meter", aliases: ["clamp meter", "clamp meters"], definition: "A meter with jaws that close around a single conductor and measure its current from the magnetic field, without disconnecting anything." },
  { id: "continuity", term: "Continuity", aliases: ["continuity"], definition: "Whether a complete, low-resistance path exists between two points. Meters often beep to indicate continuity." },
  { id: "measurement-category", term: "Measurement category (CAT)", aliases: ["measurement category", "CAT ratings"], definition: "IEC 61010 ratings (CAT II, III, IV) for the transient overvoltage a meter can safely withstand, from plug-in equipment (II) through building distribution (III) to the utility service entrance (IV)." },
  { id: "transient", term: "Transient", aliases: ["transient"], definition: "A brief voltage spike, for example from lightning or switching, that can reach thousands of volts." },
  { id: "shrouded-connector", term: "Shrouded connector", aliases: ["shrouded connectors", "shrouded connector"], definition: "A test-lead plug whose metal contact is surrounded by insulation so it cannot be touched while connected." },

  // Safety
  { id: "energized", term: "Energized", aliases: ["energized"], definition: "Connected to a source of electrical energy, or containing stored electrical energy — capable of causing shock or arc flash." },
  { id: "de-energize", term: "De-energize", aliases: ["de-energize", "de-energized", "de-energizing", "re-energize"], definition: "To disconnect equipment from all sources of energy so that no voltage is present. Re-energize means to restore power afterward." },
  { id: "electrically-safe-work-condition", term: "Electrically safe work condition", aliases: ["electrically safe work condition"], definition: "A state in which equipment has been disconnected, locked and tagged out, tested to verify the absence of voltage and, where required, temporarily grounded." },
  { id: "qualified-person", term: "Qualified person", aliases: ["qualified persons", "qualified person", "qualified-person"], definition: "Someone with the training and demonstrated skills to recognize and avoid the electrical hazards of the specific equipment and tasks involved, as defined by the applicable standard and the employer." },
  { id: "arc-flash", term: "Arc flash", aliases: ["arc flash", "arc-flash"], definition: "The intense heat and light released when current flows through air between conductors during a fault. It can cause severe burns at a distance." },
  { id: "arc-blast", term: "Arc blast", aliases: ["arc blast"], definition: "The pressure wave, molten metal and flying debris produced by an arc-flash event." },
  { id: "stored-energy", term: "Stored energy", aliases: ["stored energy"], definition: "Energy that remains after the supply is removed: charged capacitors, batteries, compressed springs, raised loads and pressurized fluids." },
  { id: "capacitor", term: "Capacitor", aliases: ["capacitor", "capacitors"], definition: "A component that stores energy in an electric field. Large capacitors can hold a dangerous charge long after power is removed." },
  { id: "pneumatic", term: "Pneumatic", aliases: ["pneumatic"], definition: "Powered by compressed air." },
  { id: "hydraulic", term: "Hydraulic", aliases: ["hydraulic"], definition: "Powered by pressurized liquid, usually oil." },
  { id: "bleed", term: "Bleed", aliases: ["bleed"], definition: "To release stored pressure from a pneumatic or hydraulic system in a controlled way." },
  { id: "ppe", term: "PPE", aliases: ["personal protective equipment", "PPE"], definition: "Personal protective equipment: gloves, clothing, face and eye protection worn to reduce injury if other controls fail." },
  { id: "voltage-rated-gloves", term: "Voltage-rated gloves", aliases: ["voltage-rated gloves"], definition: "Rubber insulating gloves certified for a maximum working voltage class. They are worn with leather protectors and must be inspected before each use and periodically tested." },
  { id: "arc-rated", term: "Arc-rated", aliases: ["arc-rated"], definition: "Clothing or equipment tested to show how much arc-flash heat it can withstand, stated as an arc rating in cal/cm²." },
  { id: "risk-assessment", term: "Risk assessment", aliases: ["risk assessment"], definition: "A documented review of what could go wrong, how likely and severe it would be, and which controls will be used to reduce the risk." },
  { id: "lockout-tagout", term: "Lockout/tagout (LOTO)", aliases: ["lockout/tagout", "LOTO"], definition: "A procedure for controlling hazardous energy: isolating equipment and applying personal locks and tags so it cannot be re-energized while someone is working on it." },
  { id: "energy-isolating-device", term: "Energy-isolating device", aliases: ["energy-isolating devices", "energy-isolating device", "isolating device"], definition: "A device that physically prevents energy from reaching equipment, such as a disconnect switch, circuit breaker or valve. Pushbuttons and control switches are not energy-isolating devices." },
  { id: "disconnect", term: "Disconnect", aliases: ["disconnect", "disconnects"], definition: "A switch designed to isolate equipment from its power supply, usually lockable in the off position." },
  { id: "breaker", term: "Circuit breaker", aliases: ["circuit breaker", "breakers", "breaker"], definition: "An automatic switch that opens on overcurrent and can be reset. It can also serve as a disconnecting means." },
  { id: "live-dead-live", term: "Live–dead–live test", aliases: ["live–dead–live", "live-dead-live"], definition: "Verifying a tester on a known live source, testing the isolated circuit, then re-verifying the tester on the live source, to prove a “dead” reading is genuine." },
  { id: "back-feed", term: "Back-feed", aliases: ["back-feed"], definition: "Voltage arriving from an unexpected direction — for example from a generator, a second supply, or a transformer energized from its secondary side." },
  { id: "osha", term: "OSHA", aliases: ["OSHA"], definition: "The U.S. Occupational Safety and Health Administration, which sets and enforces workplace safety regulations. Its general-industry rules are in 29 CFR 1910." },
  { id: "nfpa-70e", term: "NFPA 70E", aliases: ["NFPA 70E"], definition: "The National Fire Protection Association's Standard for Electrical Safety in the Workplace, widely used in the U.S. for safe work practices, PPE selection and arc-flash risk assessment." },
  { id: "csa-z462", term: "CSA Z462", aliases: ["CSA Z462"], definition: "Canada's workplace electrical safety standard, closely harmonized with NFPA 70E." },
];

export const GLOSSARY: readonly GlossaryEntry[] = raw.map((e) => GlossaryEntrySchema.parse(e));

export function getGlossaryEntry(id: string): GlossaryEntry | undefined {
  return GLOSSARY.find((e) => e.id === id);
}
