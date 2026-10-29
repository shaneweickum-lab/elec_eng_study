# Curriculum

Curriculum content is data (`src/content/curriculum`), validated with Zod at load and covered by tests.

> Tier 1 and Tier 2 are provisional categories. No alignment with an employer's examination is claimed until official competency requirements are provided and mapped to the skill model below.

## Structure

```
Pathway (tier) → Module → Lesson → Sections → Blocks
                                 → Knowledge check
                                 → Linked challenges → Skills
```

Every lesson defines: learning objectives, required and recommended prerequisites, sections of content blocks (text, list, formula, table, callout, worked example, interactive demo), a knowledge check with a pass threshold, linked simulator challenges, mastery criteria, estimated study time, content version, technical review status and references.

A lesson is complete only when its knowledge check is passed. Unfinished modules are listed as **planned** and never marked complete.

## Glossary tooltips

`src/content/curriculum/glossary.ts` defines terminology that may not be common knowledge (units, instruments, safety terms, standards). Lesson text is matched automatically — whole words, case-insensitive, acronyms case-sensitive, longest alias first — and the first occurrence of each term in a section is underlined with a definition tooltip (hover, keyboard focus or tap). Knowledge-check prompts and explanations are annotated too, and each lesson's sidebar lists its key terms with definitions for screen-reader and print use.

To add a term, add an entry with its aliases; no lesson markup is needed. Definitions are curriculum content and go through the same technical review as lessons.

## Tier 1 — Electrical fundamentals

| # | Module | Status |
| --- | --- | --- |
| 1 | Electrical safety fundamentals | **Authored** (`electrical-safety-fundamentals`) |
| 2 | Electrical quantities and units | Planned |
| 3 | Voltage, current and resistance | Planned |
| 4 | Ohm's law | **Authored** (`ohms-law`) |
| 5 | Electrical power | Planned |
| 6 | Series circuits | Planned (practiced in challenge 3) |
| 7 | Parallel circuits | Planned (practiced in challenge 4) |
| 8 | Basic circuit components | Planned |
| 9 | Multimeter fundamentals | Planned |
| 10 | Introductory electrical troubleshooting | Planned (practiced in challenge 5) |
| 11 | AC fundamentals | Planned |
| 12 | Basic electrical schematics | Planned |

## Tier 2 — Industrial controls and troubleshooting

Industrial schematics · control circuit fundamentals · relays and contactors · pushbuttons and selector switches · motor control circuits · overload protection · three-phase fundamentals · industrial sensors · control transformers · electrical fault diagnosis · preventive maintenance concepts · introductory PLC concepts. All planned.

## Skills

| Skill | Evidence sources |
| --- | --- |
| Electrical hazard recognition | Safety lesson |
| De-energize before work | Challenges 1, 2, 4, 5 (safety rules enforced) |
| Ohm's law calculation | Ohm's law lesson; challenges 1, 3 |
| Ohm's law application | Challenge 2 |
| Voltage measurement | Challenges 3, 5 |
| Current measurement | Challenges 1, 2, 4 |
| Resistance measurement | Challenge 5 |
| Series circuit analysis | Challenge 3 |
| Parallel circuit analysis | Challenge 4 |
| Open-circuit diagnosis | Challenge 5 |

Mastery levels: *not started → developing → proficient → mastered* (rules in [ARCHITECTURE.md](ARCHITECTURE.md#progress-model)).

## Challenges (Environment A)

| # | Challenge | Generator | Tasks |
| --- | --- | --- | --- |
| 1 | Current in a basic DC circuit | `single-resistor` | calculate I; log a series current reading |
| 2 | Hit a target current | `target-current` | set R1 so I is within ±2 % of a seeded target; verify after the last change |
| 3 | Series resistor analysis | `series-three` | R_eq; loop current; log V across R2 |
| 4 | Parallel branch analysis | `parallel-branches` | log R1 branch current; total current; R_eq |
| 5 | Diagnose an open circuit | `series-open-fault` | ≥ 3 valid diagnostic readings; identify the seeded open part |

Modes: guided (free hints, live task status, no proficiency credit), independent (hint penalty), timed, mastery (fresh scenario, no hints, timed).

## Safety framework

Safety procedures are evaluated separately from fault diagnosis:

- changing components or wiring while energized,
- measuring resistance on an energized circuit,
- connecting the ammeter across a source,
- exceeding the meter's fuse rating.

Bypassing protection is never a valid repair, and a technically correct but unsafe attempt yields no competency evidence. The safety lesson references OSHA 29 CFR 1910.147 and Subpart S, NFPA 70E, CSA Z462 and IEC 61010-1 measurement categories.

## Review process

All authored lessons are `pending-technical-review`. Before marking a lesson `reviewed`, a qualified reviewer should check it against authoritative references, verify every numeric answer (most are computed in code from the stated values), and confirm safety statements against current editions of the cited standards. Bump `contentVersion` on any change; knowledge-check records store the version they were taken against.
