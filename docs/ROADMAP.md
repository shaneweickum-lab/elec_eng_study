# Roadmap

## Phase status

| Phase | Scope | Status |
| --- | --- | --- |
| A | Next.js foundation, layouts, navigation, design system | Done |
| B | Electrical simulation package and mathematical tests | Done (DC, relay settling, multimeter) |
| C | Procedural voxel geometry and isometric renderer | Done |
| D | Interactive training bench and instrument framework | Done (Environment A) |
| E | Academy lessons and challenge integration | Done for the first slice (2 lessons, 5 challenges) |
| F | Persistence, progress tracking, testing, deployment validation | Done for local mode; Supabase pending |

## Next (in order)

1. **Technical review** of both lessons; author Tier 1 modules 2, 3, 5–7 and 9 (each with knowledge checks and links to existing challenges).
2. **Supabase mode**: auth, `SupabaseProgressRepository`, server-side attempt replay and verification, local-to-cloud import.
3. **Instrument framework**: extract a common `Instrument` interface from the multimeter (clamp meter next — non-contact current measurement suits industrial practice).
4. **Bench wiring editor**: let learners add and remove leads between posts, not only toggle predefined links.
5. **Web Worker baking** and chunked re-bakes for large assets.
6. **Environment B — control cabinet**: AC control power (phasor or RMS-equivalent model), contactors and pilot lights using the existing relay settling, cabinet door and component interactions.
7. **Environment C — motor control station**: three-phase source, motor and overload models, starter logic; "motor will not start" scenarios.
8. **Environment D — conveyor**: sensors, timers, interlocks.

## Later

AC and transient analysis (complex MNA, companion models) · PLC ladder logic · VFDs · industrial networking · instrumentation · digital twins · robotics and ROS 2 · microcontrollers · control theory · AI-assisted troubleshooting hints · learner-authored challenges (the schema already supports it) · employer competency mapping once requirements are supplied.

Tier 3, robotics and advanced automation are intentionally not started.
