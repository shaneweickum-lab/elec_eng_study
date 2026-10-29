import type { Lesson } from "../schema";

const round = (v: number, digits = 4) => Number(v.toPrecision(digits));

export const ohmsLawLesson: Lesson = {
  slug: "ohms-law",
  moduleId: "t1-ohms-law",
  title: "Ohm's Law",
  subtitle: "The relationship between voltage, current and resistance",
  contentVersion: "1.0.0",
  reviewStatus: "pending-technical-review",
  estimatedMinutes: 35,
  objectives: [
    "State Ohm's law and rearrange it to find voltage, current or resistance.",
    "Convert between unit prefixes (m, µ, k, M) without losing a factor of 1000.",
    "Predict how current changes when voltage or resistance changes.",
    "Explain why voltage is measured across a component and current is measured in series.",
    "Recognise where Ohm's law does not describe a device's behaviour.",
  ],
  prerequisites: { required: [], recommended: ["electrical-safety-fundamentals"] },
  skills: ["ohms-law.calculate", "ohms-law.apply", "meter.current"],
  sections: [
    {
      id: "quantities",
      title: "Three quantities",
      blocks: [
        {
          type: "text",
          body: "Every circuit you will maintain is described by three quantities. **Voltage** (V, measured in volts) is the electrical potential difference between two points — the push that drives charge. **Current** (I, measured in amperes) is the rate at which charge flows past a point; one ampere is one coulomb per second. **Resistance** (R, measured in ohms, Ω) is how strongly a component opposes that flow.",
        },
        {
          type: "table",
          headers: ["Quantity", "Symbol", "Unit", "Measured"],
          rows: [
            ["Voltage", "V (or E)", "volt, V", "Across a component — between two points"],
            ["Current", "I", "ampere, A", "Through a component — in series with it"],
            ["Resistance", "R", "ohm, Ω", "Across a de-energized, isolated component"],
          ],
        },
        {
          type: "text",
          body: "Voltage always exists **between** two points. A single wire does not \"have\" a voltage on its own; it has a voltage relative to something else, usually the circuit's common or ground reference.",
        },
      ],
    },
    {
      id: "law",
      title: "The law",
      blocks: [
        {
          type: "text",
          body: "For a resistor at a steady temperature, the current through it is directly proportional to the voltage across it. The constant of proportionality is its resistance:",
        },
        { type: "formula", expressions: ["V = I × R", "I = V ÷ R", "R = V ÷ I"], caption: "Three arrangements of the same relationship." },
        {
          type: "text",
          body: "Read the formula as cause and effect: for a fixed resistance, double the voltage and the current doubles. For a fixed voltage, double the resistance and the current halves.",
        },
        {
          type: "callout",
          tone: "note",
          title: "Where Ohm's law stops",
          body: "Ohm's law describes linear (\"ohmic\") conductors. Many real devices are not linear: a lamp filament's resistance rises sharply as it heats, and diodes and transistors conduct very differently depending on voltage and polarity. V = I × R still gives the resistance at one operating point, but that value changes as conditions change.",
        },
      ],
    },
    {
      id: "units",
      title: "Units and prefixes",
      blocks: [
        {
          type: "text",
          body: "Industrial values span many orders of magnitude: microamps of sensor leakage, kilohm pull-up resistors, megohm insulation readings. Most calculation errors on the shop floor are prefix errors, not arithmetic errors. Convert to base units (V, A, Ω) before calculating, then convert the answer back.",
        },
        {
          type: "table",
          headers: ["Prefix", "Symbol", "Factor", "Example"],
          rows: [
            ["mega", "M", "× 1 000 000", "2.2 MΩ = 2 200 000 Ω"],
            ["kilo", "k", "× 1 000", "4.7 kΩ = 4 700 Ω"],
            ["milli", "m", "÷ 1 000", "15 mA = 0.015 A"],
            ["micro", "µ", "÷ 1 000 000", "250 µA = 0.000 25 A"],
          ],
        },
        { type: "callout", tone: "tip", title: "A quick check", body: "Volts ÷ kilohms gives milliamps directly: 12 V ÷ 4.7 kΩ ≈ 2.55 mA. Use it to sanity-check your answers." },
      ],
    },
    {
      id: "examples",
      title: "Worked examples",
      blocks: [
        {
          type: "worked-example",
          title: "Finding current",
          given: ["V = 12 V", "R = 240 Ω"],
          steps: ["I = V ÷ R", "I = 12 V ÷ 240 Ω", `I = ${12 / 240} A`],
          result: "I = 0.05 A = 50 mA",
        },
        {
          type: "worked-example",
          title: "Choosing a resistance",
          given: ["V = 9 V", "Required current I = 15 mA = 0.015 A"],
          steps: [
            "R = V ÷ I = 9 V ÷ 0.015 A = 600 Ω",
            "600 Ω is not a standard E12 value; the nearest are 560 Ω and 680 Ω.",
            `With 560 Ω: I = 9 ÷ 560 = ${round(9 / 560 * 1000)} mA. With 680 Ω: I = 9 ÷ 680 = ${round(9 / 680 * 1000)} mA.`,
          ],
          result: "Choose the value that meets the requirement — if 15 mA is a maximum, 680 Ω keeps the current below it.",
        },
        {
          type: "worked-example",
          title: "Finding voltage",
          given: ["I = 2 mA = 0.002 A", "R = 4.7 kΩ = 4 700 Ω"],
          steps: ["V = I × R", "V = 0.002 A × 4 700 Ω"],
          result: `V = ${round(0.002 * 4700)} V`,
        },
      ],
    },
    {
      id: "explore",
      title: "Explore the relationship",
      blocks: [
        {
          type: "text",
          body: "The explorer below runs the same circuit solver used in the simulator. Change the source voltage and the resistance and watch the current respond. Notice which changes are proportional and which are inverse.",
        },
        { type: "demo", demo: "ohms-law-explorer" },
      ],
    },
    {
      id: "measuring",
      title: "Measuring what you calculated",
      blocks: [
        {
          type: "text",
          body: "A calculation is a prediction; a measurement confirms it. The two measurements behave very differently:",
        },
        {
          type: "list",
          ordered: false,
          items: [
            "**Voltage** is measured **across** a component: one probe on each side, with the circuit running. A voltmeter has a very high input resistance (typically about 10 MΩ), so it draws almost no current and barely disturbs the circuit.",
            "**Current** is measured **in series**: the circuit is opened and the meter becomes part of the path, so all the current flows through it. An ammeter has a very low resistance so it does not change the current much.",
            "Because an ammeter is nearly a short circuit, connecting it **across** a voltage source or a load creates a short. At best the meter's fuse opens; at worst, on a high-energy circuit, it can cause an arc flash.",
          ],
        },
        {
          type: "callout",
          tone: "safety",
          title: "Breaking a circuit to measure current",
          body: "Opening a circuit and inserting a meter is work on the circuit. De-energize it first, make the connection, then re-energize to read. On industrial circuits, a clamp meter is often used instead so the conductor never has to be disconnected. The training bench is a low-voltage virtual exercise; real equipment requires your workplace's procedures and qualified-person rules.",
        },
      ],
    },
    {
      id: "mistakes",
      title: "Common mistakes",
      blocks: [
        {
          type: "list",
          ordered: false,
          items: [
            "Dividing by kilohms but reporting amps (an error of 1000).",
            "Using the supply voltage for one resistor in a series string — each part only drops its own share.",
            "Measuring resistance on a powered circuit — the reading is meaningless and the meter can be damaged.",
            "Leaving the meter probes in the current jack after a current reading, then trying to measure voltage.",
          ],
        },
      ],
    },
  ],
  knowledgeCheck: {
    passThreshold: 0.8,
    questions: [
      {
        kind: "single-choice",
        id: "q1",
        prompt: "A 24 V supply is connected across a 1.2 kΩ resistor. What current flows?",
        options: [
          { id: "a", text: "20 mA" },
          { id: "b", text: "2 A" },
          { id: "c", text: "28.8 mA" },
          { id: "d", text: "50 mA" },
        ],
        correct: "a",
        explanation: "I = V ÷ R = 24 V ÷ 1 200 Ω = 0.02 A = 20 mA. Answer (b) forgets the kilo prefix.",
      },
      {
        kind: "numeric",
        id: "q2",
        prompt: "A resistor drops 6 V while carrying 30 mA. What is its resistance?",
        answer: 6 / 0.03,
        unit: "Ω",
        tolerance: 0.01,
        explanation: "R = V ÷ I = 6 V ÷ 0.03 A = 200 Ω.",
      },
      {
        kind: "single-choice",
        id: "q3",
        prompt: "The voltage across a fixed resistor is doubled. What happens to the current?",
        options: [
          { id: "a", text: "It halves" },
          { id: "b", text: "It stays the same" },
          { id: "c", text: "It doubles" },
          { id: "d", text: "It quadruples" },
        ],
        correct: "c",
        explanation: "For a fixed resistance, current is directly proportional to voltage.",
      },
      {
        kind: "single-choice",
        id: "q4",
        prompt: "To measure the current through a resistor with a multimeter, the meter must be connected…",
        options: [
          { id: "a", text: "Across the resistor, in parallel" },
          { id: "b", text: "In series, so the current flows through the meter" },
          { id: "c", text: "Across the power supply terminals" },
          { id: "d", text: "Either way — the meter adapts" },
        ],
        correct: "b",
        explanation: "Current is measured in series. In parallel, the meter's low resistance bypasses the resistor; across a supply it is a short circuit.",
      },
      {
        kind: "numeric",
        id: "q5",
        prompt: "What voltage is needed to drive 15 mA through an 820 Ω resistor?",
        answer: round(0.015 * 820),
        unit: "V",
        tolerance: 0.01,
        explanation: "V = I × R = 0.015 A × 820 Ω = 12.3 V.",
      },
      {
        kind: "single-choice",
        id: "q6",
        prompt: "Which statement about Ohm's law is correct?",
        options: [
          { id: "a", text: "It applies equally to every component, including lamps and diodes." },
          { id: "b", text: "It describes linear conductors; a lamp filament's resistance changes as it heats." },
          { id: "c", text: "It only applies to AC circuits." },
          { id: "d", text: "Resistance increases when current increases in every resistor." },
        ],
        correct: "b",
        explanation: "Ohm's law describes ohmic (linear) conductors. Non-linear devices still have a V/I ratio at each operating point, but it is not constant.",
      },
    ],
  },
  challenges: ["dc-current-basic", "target-current"],
  masteryCriteria: [
    "Score at least 80 % on the knowledge check.",
    "Complete the \"Current in a Basic DC Circuit\" challenge with no safety violations.",
    "Demonstrate the skill on at least two different scenarios outside guided mode for proficiency.",
  ],
  references: [
    "Content pending technical review against authoritative electrical-fundamentals texts.",
  ],
};
