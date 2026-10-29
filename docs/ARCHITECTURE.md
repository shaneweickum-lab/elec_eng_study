# Architecture

## Goals that shaped it

1. Simulation accuracy over visual effects.
2. The renderer never owns electrical state; visuals are derived from simulation state.
3. Curriculum and challenges are data, validated at load.
4. Progression reflects demonstrated competence, not activity.
5. Vercel-compatible: static pages, client-side simulation, secrets server-only.

## Repository layout

```
packages/
  circuit-sim/       @iea/circuit-sim — framework-free electrical engine (TypeScript + Zod)
  voxel-engine/      @iea/voxel-engine — framework-free procedural voxel assets + rasterizer
src/
  app/               Next.js App Router (route groups: (app) with navigation, (lab) full-screen)
  content/curriculum Curriculum schema, module map, skills, authored lessons
  domain/            Pure domain logic (no React / PixiJS)
    bench/           Training-bench model, scenarios, session reducer, circuit translation
    challenges/      Challenge schema, definitions, evaluation, replay
    progress/        Progress schema, repository, mastery / XP / achievements
  game/              PixiJS isometric renderer and world layout
  features/          React feature components (bench workspace, lesson, dashboard)
  stores/            Zustand stores (bench session, progress, settings)
  components/        shadcn-style UI primitives and app shell
supabase/migrations  PostgreSQL schema with RLS
e2e/                 Playwright tests
```

### Package boundaries

| Layer | May import | Must not import |
| --- | --- | --- |
| `@iea/circuit-sim` | `zod` | React, Next.js, PixiJS, Supabase, Zustand |
| `@iea/voxel-engine` | nothing | anything above |
| `src/domain` | both packages, `src/content`, `src/lib` | React, PixiJS |
| `src/game` | `pixi.js`, voxel engine, domain types | stores (receives a view model) |
| `src/features`, `src/app` | everything | — |

`src/domain/__tests__/boundaries.test.ts` enforces the first three rows.

Packages are npm workspaces that export TypeScript source; Next.js compiles them via `transpilePackages`.

## Data flow in the simulator

```
learner input (canvas, side panel, keyboard)
        │  BenchAction
        ▼
session reducer (domain/bench/session.ts) ──► BenchState (authoritative)
        │                                        │
        │ readMeter / solvePhysical              │ toCircuit()
        ▼                                        ▼
MultimeterReading, safety events         @iea/circuit-sim solveDC()
        │
        ▼
Zustand bench store ──► BenchView (derived) ──► BenchRenderer.update()
                                                  │  only changed asset keys are re-baked
                                                  ▼
                                         PixiJS sprites + overlays
```

- The reducer is pure: `dispatch(session, action, t)` returns a new session. The UI store and the tests drive the same code, and a recorded attempt can be replayed to the same result (`domain/challenges/replay.ts`).
- PixiJS is loaded through `next/dynamic` with `ssr: false` inside a client component, so it never executes during server rendering.
- Hidden scenario faults live in `BenchState.fault` and are applied only when translating to a circuit; the renderer and schematic never reveal them.

## Simulation ↔ rendering contract

`BenchRenderer.update(view: BenchView)` receives parts with their solved currents, the supply set-point and output current, the meter's display text, selection and display options. The renderer turns each entity into an `AssetDefinition` (type + params); if the definition's key is unchanged nothing is regenerated. Switch states, dial positions and LED states are parameters, so a state change re-bakes exactly one small asset.

Picking happens in the renderer: posts are tested first (they are small), then sprites in reverse paint order using the baked alpha mask (pixel-exact), then sub-object hotspots (e.g. the supply's output button). Results are emitted as `SceneEvent`s; the renderer never mutates state.

## Challenge engine

A challenge definition (`domain/challenges/schema.ts`) names a seeded scenario generator, tasks, safety rules, hints, scoring and rewards. Task kinds:

| Kind | Judged against |
| --- | --- |
| `numeric-answer` | The solver's value for the circuit as designed (links installed, supply on) |
| `measurement` | A logged reading whose probe topology matches the target part (across for V/Ω; same current for A) and which carried no hazard |
| `circuit-target` | The solver's value against a scenario fact (e.g. target current) |
| `identify-fault` | The scenario's injected fault |
| `evidence` | Count of valid logged readings of the allowed kinds |

Safety is evaluated independently from correctness. A technically correct but unsafe attempt is recorded as “passed · unsafe” and contributes no competency evidence.

Each attempt stores challenge id, definition version, seed, mode, the full action log and the raw answers.

## Progress model

- **Engagement XP**: lessons, attempts, and passes with 50 % decay per repeated pass of the same challenge.
- **Skill mastery**: built only from passed, safe attempts; each distinct `challenge:seed` counts once; guided passes and knowledge checks can make a skill *developing* but never *proficient*. Proficient = two distinct independent/timed/mastery scenarios; mastered = proficient + a mastery-mode pass.
- Achievements and readiness are derived from stored records, never stored themselves.

## Persistence

`ProgressRepository` (`domain/progress/repository.ts`) is the boundary:

- **Local mode (current)** — `LocalProgressRepository` stores a Zod-validated JSON document under `iea.progress.v1` in `localStorage`. Corrupt data is preserved under a `.corrupt.<timestamp>` key and the learner starts fresh rather than crashing. Export/import is available in Settings.
- **Supabase mode (planned)** — `supabase/migrations/20261029000000_initial_schema.sql` defines profiles, curriculum reference tables, lesson progress, assessments, challenge definitions, attempts, skill mastery, achievements and saved circuits, with RLS on all learner tables. Attempts and assessments are append-only for learners; mastery and achievements are read-only (derived server-side).

Integration path:

1. Add `@supabase/supabase-js` and `@supabase/ssr`; create browser and server clients reading `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
2. Implement `SupabaseProgressRepository` (same interface, async variant) and select it with `NEXT_PUBLIC_PERSISTENCE_MODE=supabase`.
3. Add a server route that receives attempts, replays them with `replayAttempt()` and sets `verified_at` using the service-role key (server-only). This prevents forged client scores.
4. Seed reference tables from `src/content` and `src/domain/challenges/definitions.ts` with a script run under the service role.
5. Offer a one-time import of local progress after sign-in.

## Technical risks and mitigations

| Risk | Mitigation |
| --- | --- |
| WebGL unavailable / GPU-less clients | All bench actions are available in the side panel; the canvas reports failure without blocking. |
| Large voxel bakes on the main thread | Bakes are cached per (asset key, LOD); LOD capped by a 2048 px texture budget; worker baking is on the roadmap. |
| Client-reported scores | Deterministic replay enables server verification (Supabase phase). |
| Educational accuracy | Lessons carry `reviewStatus: pending-technical-review`; engine simplifications are documented; tests cover hand-derived values. |
| Scope creep into Tier 3 / robotics | Environments B–D and Tier 2 modules are explicitly *planned* and not presented as working. |
