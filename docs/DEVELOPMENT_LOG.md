# Development log

## 2026-10-29 — Glossary tooltips in lessons

- Added a 64-term glossary and automatic term matching for lesson text, tables and knowledge checks.
- Tooltips open on hover, keyboard focus or tap; a "Key terms" list in the lesson sidebar provides the same definitions without hovering.
- Tests: matcher unit tests (word boundaries, longest match, acronym case, first-occurrence scoping) and a Playwright test for hover, keyboard and tap.

## 2026-10-29 — First release: Tier 1 electrical laboratory vertical slice

### Completed

- Repository bootstrapped (it contained only a README). Next.js 16 App Router, React 19, strict TypeScript, Tailwind CSS 4, shadcn-style components on Radix, Lucide, PixiJS 8, Zustand 5, Zod 4, Vitest, Playwright.
- `@iea/circuit-sim`: MNA DC solver, failure classification, CV/CC supplies, KCL link currents, relay settling, multimeter with hazards, SPICE export, analysis extension point.
- `@iea/voxel-engine`: grid primitives, stamp rasterizer with hidden-face elimination and LOD-aware edge shading, asset registry and caches, 12 generators.
- Environment A with pixel-exact picking, hotspots, leads, skewed instrument displays, current-flow animation (static arrows with reduced motion), camera pan/zoom/overview, keyboard shortcuts, performance overlay.
- Side-panel equivalents for every bench action (inspector, instruments, circuit list, schematic, readings log, safety log).
- Five seeded challenges, four modes, evaluation, separate safety scoring, attempt replay.
- Two lessons with an interactive solver-driven Ohm's law explorer and knowledge checks.
- Dashboard, academy, tier pages, simulator selection, challenge library, workshop with saved circuits, progress, settings (motion, labels, detail, export/import/reset).
- Local persistence with schema validation and corruption recovery; Supabase migration with RLS.

### Verification at this point

- `npm run typecheck` — clean.
- `npm test` — 132 tests passing (engine, voxel, bench, challenges, replay, progress, persistence, boundaries, units parsing).
- `npm run build` — succeeds; all routes prerendered.
- `npm run test:e2e` — 6 browser tests passing, including the full release loop and canvas picking (Chromium with SwiftShader WebGL).

### Decisions

- **Software rasterization instead of per-voxel display objects**: one texture per asset state; exact painter's order; pixel-perfect hit masks for free.
- **Physical bench model (posts + links)**: current measurement requires opening a link and inserting the meter, which is how the skill is actually performed.
- **Readings are logged deliberately** (`L`) rather than recorded continuously, so evidence reflects intent.
- **Calculated answers are checked against the circuit as designed** (links installed, supply on), so leaving a link open after measuring does not mark arithmetic wrong.
- **Local mode first** at the user's request; the repository boundary keeps Supabase a drop-in.

### Known issues / limitations

- Lessons are pending technical review.
- Bench wiring is limited to predefined links and parts per scenario.
- Voxel bakes run on the main thread (≈ 150 ms for the workbench at the highest LOD, once per LOD).
- Timed attempts auto-submit at the limit; there is no pause.
- Mobile layout is functional for content pages; the simulator targets desktop and tablet widths.
