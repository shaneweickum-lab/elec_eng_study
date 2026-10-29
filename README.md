# Industrial Engineering Academy

A web platform for learning industrial electrical maintenance through two connected experiences:

- **The Academy** — versioned lessons, interactive demonstrations and knowledge checks.
- **The Industrial Simulator** — a PixiJS isometric laboratory built from procedurally generated micro-voxel equipment, where every reading comes from a real circuit solver.

Core loop: **Learn → Observe → Practice → Diagnose → Demonstrate mastery.**

> Tier 1 / Tier 2 are provisional curriculum categories. They are not aligned with any employer's examination until official competency requirements are provided and mapped. Virtual training does not authorize work on energized equipment.

## What works today (first release)

Open the Academy → start the Ohm's law lesson → pass its knowledge check → enter the isometric training bench → change circuit values → measure with the virtual multimeter → complete a challenge → receive technical and safety feedback → progress is saved (browser `localStorage`).

- `@iea/circuit-sim` — Modified Nodal Analysis DC solver with short/invalid-circuit detection, current-limited (CV/CC) supplies, relay coil/contact settling, a multimeter model and SPICE netlist export.
- `@iea/voxel-engine` — procedural voxel asset generators and an exact isometric software rasterizer (hidden-face elimination, painter's order, LOD, edge shading, pixel-exact hit masks).
- Environment A, the Electrical Training Bench: bench supply, terminal board, resistors with correct color bands, knife switch, removable measurement links, digital multimeter and probes.
- Five seeded challenges on one engine, four attempt modes, simulator-based evaluation, separate safety scoring, deterministic replay of any attempt.
- Evidence-based skill mastery, engagement XP with diminishing returns, achievements, study history.
- Two authored lessons (Electrical Safety Fundamentals, Ohm's Law); the remaining 22 Tier 1/2 modules are listed as *planned*.

## Getting started

Requires Node.js 20+ (developed on 22).

```bash
npm install
npm run dev          # http://localhost:3000
```

No credentials are needed: without Supabase variables the app runs in local mode with seeded curriculum data and browser-local progress.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run typecheck` | Strict TypeScript check |
| `npm test` | Vitest unit, simulation and domain tests |
| `npm run test:e2e` | Playwright browser tests (builds must exist: run `npm run build` first) |
| `npm run check` | Typecheck + unit tests + production build |

Browser tests launch `next start` on port 3210. In environments without a GPU, Chromium renders WebGL via SwiftShader (configured in `playwright.config.ts`).

## Configuration

Copy `.env.example` to `.env.local`. Only variable names are committed. `SUPABASE_SERVICE_ROLE_KEY` is server-only and must never be imported by client components. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#persistence) for the Supabase integration path and `supabase/migrations/` for the schema with row-level security.

## Deployment

The app is Vercel-compatible with no extra configuration: every route is statically prerendered, and the simulator runs entirely client-side (no server invocation per frame, measurement or circuit update). Set the environment variables in the Vercel project when Supabase is enabled.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Simulation engine](docs/SIMULATION_ENGINE.md)
- [Voxel system](docs/VOXEL_SYSTEM.md)
- [Curriculum](docs/CURRICULUM.md)
- [Roadmap](docs/ROADMAP.md)
- [Development log](docs/DEVELOPMENT_LOG.md)

## Keyboard (simulator)

Drag / arrows pan · scroll / `+` `−` zoom · `0` frame bench · `O` room overview · `1–5` meter function · `R` / `B` place red / black probe on the selected terminal · `L` log reading · `P` supply output · `Esc` clear selection · `?` help.
