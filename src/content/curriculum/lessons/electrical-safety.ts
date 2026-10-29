import type { Lesson } from "../schema";

export const electricalSafetyLesson: Lesson = {
  slug: "electrical-safety-fundamentals",
  moduleId: "t1-safety",
  title: "Electrical Safety Fundamentals",
  subtitle: "Hazards, safe isolation and verifying the absence of voltage",
  contentVersion: "1.0.0",
  reviewStatus: "pending-technical-review",
  estimatedMinutes: 30,
  objectives: [
    "Describe the main electrical hazards: shock, arc flash, arc blast and stored energy.",
    "Explain why establishing an electrically safe work condition is the primary protective strategy.",
    "List the principles of a lockout/tagout procedure in order.",
    "Describe a live–dead–live test for verifying the absence of voltage.",
    "Select an appropriate meter function and avoid instrument misuse.",
  ],
  prerequisites: { required: [], recommended: [] },
  skills: ["safety.hazard-recognition", "safety.de-energize"],
  sections: [
    {
      id: "scope",
      title: "Before you begin",
      blocks: [
        {
          type: "callout",
          tone: "safety",
          title: "Virtual training is not authorization",
          body: "This platform teaches concepts in a simulated, low-voltage environment. It does not qualify you or authorize you to work on energized equipment. Real work must follow applicable regulations and standards (for example OSHA 29 CFR 1910 Subpart S and 1910.147 and NFPA 70E in the United States, or CSA Z462 in Canada), your employer's written procedures, the equipment manufacturer's documentation, and qualified-person requirements.",
        },
      ],
    },
    {
      id: "hazards",
      title: "How electricity injures",
      blocks: [
        {
          type: "list",
          ordered: false,
          items: [
            "**Shock** — current passing through the body. Severity depends on the amount of current, its path and how long it flows. Currents of only tens of milliamperes across the chest can disrupt the heart's rhythm.",
            "**Arc flash** — an electrical fault through air releases intense heat and light, capable of severe burns at a distance from the arc.",
            "**Arc blast** — the same event produces a pressure wave, molten metal and flying debris.",
            "**Secondary injuries** — falls from ladders, involuntary movement into machinery, and fires.",
            "**Stored energy** — capacitors, batteries, springs, raised loads, and pneumatic or hydraulic pressure can remain dangerous after a supply is switched off.",
          ],
        },
      ],
    },
    {
      id: "strategy",
      title: "The primary strategy: de-energize",
      blocks: [
        {
          type: "text",
          body: "The most effective control is to remove the hazard: put the equipment into an **electrically safe work condition** before work begins. Energized work is the exception — permitted only where de-energizing would create a greater hazard or is infeasible, and then only by qualified persons using a documented procedure, a risk assessment and appropriate protective equipment.",
        },
        {
          type: "callout",
          tone: "note",
          title: "PPE is the last line of defense",
          body: "Personal protective equipment — voltage-rated gloves with leather protectors, arc-rated clothing, face and eye protection — reduces injury when other controls fail. It is selected from a shock and arc-flash risk assessment and inspected before each use. It never replaces de-energizing.",
        },
      ],
    },
    {
      id: "loto",
      title: "Lockout/tagout principles",
      blocks: [
        { type: "text", body: "Lockout/tagout (control of hazardous energy) follows a written, equipment-specific procedure. The general sequence is:" },
        {
          type: "list",
          ordered: true,
          items: [
            "**Prepare** — identify every energy source, including stored energy, from drawings and the procedure.",
            "**Notify** affected people that the equipment is being shut down.",
            "**Shut down** the equipment using its normal stopping controls.",
            "**Isolate** every source with the energy-isolating devices (disconnects, breakers, valves).",
            "**Apply** your personal lock and tag to each isolating device.",
            "**Release or restrain stored energy** — discharge capacitors, block or bleed mechanical, pneumatic and hydraulic energy.",
            "**Verify** — attempt to start the equipment, then test for the absence of voltage before touching anything.",
            "**Restore** with the procedure's steps: tools removed, guards replaced, people clear, locks removed by those who applied them.",
          ],
        },
      ],
    },
    {
      id: "verify",
      title: "Verifying the absence of voltage",
      blocks: [
        {
          type: "text",
          body: "Switching off is not proof. A wrong disconnect, a back-feed or a failed device can leave a circuit live. Absence of voltage is verified with a properly rated test instrument using a **live–dead–live** test:",
        },
        {
          type: "list",
          ordered: true,
          items: [
            "Test the instrument on a known live source to prove it works.",
            "Test the isolated circuit — every conductor to every other conductor, and each to ground.",
            "Re-test the instrument on the known live source to prove it did not fail during the test.",
          ],
        },
      ],
    },
    {
      id: "instruments",
      title: "Instrument selection and misuse",
      blocks: [
        {
          type: "list",
          ordered: false,
          items: [
            "Use a meter and leads rated for the voltage and the **measurement category** (CAT II, III, IV) of the location: CAT ratings describe the transient energy a meter can withstand.",
            "Inspect leads for damage; use shrouded connectors and probes with finger guards.",
            "**Never** measure resistance or continuity on an energized circuit.",
            "**Never** connect a meter in current mode across a voltage source; current inputs are near short circuits.",
            "Select the function before connecting the probes, and check the leads are in the correct jacks.",
          ],
        },
        {
          type: "callout",
          tone: "tip",
          title: "In this simulator",
          body: "The training bench records unsafe actions separately from your technical results: changing components or wiring while the supply output is on, measuring resistance on a live circuit, and connecting the ammeter across a source. A technically correct answer reached unsafely does not count as demonstrated competency.",
        },
      ],
    },
  ],
  knowledgeCheck: {
    passThreshold: 0.8,
    questions: [
      {
        kind: "single-choice",
        id: "s1",
        prompt: "What is the primary protective strategy for electrical work?",
        options: [
          { id: "a", text: "Wear the highest-rated PPE available" },
          { id: "b", text: "Establish an electrically safe work condition (de-energize, isolate, verify)" },
          { id: "c", text: "Work quickly to minimize exposure time" },
          { id: "d", text: "Use insulated tools" },
        ],
        correct: "b",
        explanation: "Removing the hazard comes first. PPE and insulated tools reduce risk but do not remove it.",
      },
      {
        kind: "single-choice",
        id: "s2",
        prompt: "In a live–dead–live test, why is the meter tested on a known live source a second time?",
        options: [
          { id: "a", text: "To calibrate it" },
          { id: "b", text: "To prove the meter did not fail during the test, so the \"dead\" reading is trustworthy" },
          { id: "c", text: "To discharge the circuit" },
          { id: "d", text: "It is optional" },
        ],
        correct: "b",
        explanation: "A meter that failed mid-test would also read zero. The final live check confirms the dead reading was real.",
      },
      {
        kind: "single-choice",
        id: "s3",
        prompt: "Which of these can remain hazardous after the supply disconnect is opened?",
        options: [
          { id: "a", text: "Charged capacitors" },
          { id: "b", text: "A raised load held by a hydraulic cylinder" },
          { id: "c", text: "A compressed spring" },
          { id: "d", text: "All of the above" },
        ],
        correct: "d",
        explanation: "Stored energy must be released or restrained as part of lockout/tagout.",
      },
      {
        kind: "single-choice",
        id: "s4",
        prompt: "A technician connects a meter set to measure current directly across a supply's terminals. What happens?",
        options: [
          { id: "a", text: "The meter reads the supply voltage" },
          { id: "b", text: "The meter's low resistance short-circuits the supply" },
          { id: "c", text: "Nothing — meters protect themselves" },
          { id: "d", text: "The meter reads the load current" },
        ],
        correct: "b",
        explanation: "A current input is close to zero ohms. Across a source it is a short circuit: the fuse may open, or on high-energy circuits an arc flash can result.",
      },
      {
        kind: "single-choice",
        id: "s5",
        prompt: "When is it acceptable to measure resistance on a circuit?",
        options: [
          { id: "a", text: "Whenever the meter is on the Ω range" },
          { id: "b", text: "Only when the circuit is isolated, de-energized and verified" },
          { id: "c", text: "When the voltage is below 50 V" },
          { id: "d", text: "When wearing gloves" },
        ],
        correct: "b",
        explanation: "An ohmmeter supplies its own test current; external voltage makes the reading invalid and can damage the meter.",
      },
    ],
  },
  challenges: ["open-circuit-diagnosis"],
  masteryCriteria: ["Score at least 80 % on the knowledge check.", "Complete simulator challenges with no safety violations."],
  references: [
    "OSHA 29 CFR 1910.147 — The control of hazardous energy (lockout/tagout).",
    "OSHA 29 CFR 1910 Subpart S — Electrical.",
    "NFPA 70E — Standard for Electrical Safety in the Workplace.",
    "CSA Z462 — Workplace electrical safety (Canada).",
    "IEC 61010-1 — Measurement categories for test equipment.",
  ],
};
