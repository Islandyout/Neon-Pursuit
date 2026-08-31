# Neon Pursuit Studio Execution Plan

This document is the active operating plan for the 20-agent Neon Pursuit studio.

## Studio rules

- Every feature has one owning agent and a reviewer.
- Shared contracts are defined centrally and must not be duplicated.
- Gameplay, UI, world and content changes must remain PWA/mobile compatible.
- A feature is not complete until TypeScript/build validation passes and the result is exercised in the playable build.
- Visual direction: grounded Tokyo-inspired night city, restrained neon accents, wet asphalt/urban lighting, not full-scene emissive styling.
- Runtime assets target glTF/GLB and should be streamable/reusable.

## Agents

| Agent | Role | Current assignment | Acceptance gate |
|---|---|---|---|
| A00 | Project Lead / Executive Producer | Coordinate vertical slice and scope | All milestones converge on one playable slice |
| A01 | Creative / Art Director | Tokyo-night visual bible and restraint rules | Scene reads without HUD and without heavy bloom |
| A02 | Vehicle Model Agent | Modular player, traffic and police vehicle families | 3 player archetypes, 3 traffic, 2 police archetypes data-ready |
| A03 | Environment Model Agent | Modular urban kit | Multiple blocks from reusable modules without obvious repetition |
| A04 | Road Network / World Generation | Shared road graph with arteries, loops, tunnel and shortcuts | 5-8 minute connected drive loop + 4 meaningful shortcuts |
| A05 | World Layout / Race Experience | Route drama, landmarks, risk/reward alternatives | Routes have multiple meaningful choices |
| A06 | Vehicle Physics / Driving Feel | Arcade handling, drift, nitrous, telemetry | Stable high-speed handling + intentional drift |
| A07 | Mobile Controls | Analog touch, tap steer, gyro, layout settings | Comfortable multi-touch racing in landscape |
| A08 | Traffic AI | Lightweight road-graph traffic | City feels occupied within mobile budget |
| A09 | Police Pursuit | Patrol->Investigate->Engage->Chase->Intercept->Search->Cooldown | Pursuit uses route knowledge, not raw spawn cheating |
| A10 | Race AI | Curvature-aware racing and route choice | 100 automated races <1% unrecoverable failure |
| A11 | Vehicle Customization | Slot-based garage and performance/cosmetic data | 10+ visible combinations from one base car |
| A12 | Lighting / Rendering | Restrained night lighting and scalable effects | Attractive with bloom disabled; mobile tiers respected |
| A13 | Audio | Engine/tire/wind/nitro/city/pursuit layers | Speed and danger readable by sound |
| A14 | UI / UX | Minimal race HUD and menus | Readable on small phone without blocking road |
| A15 | PWA / Asset Streaming | Asset manifests, GLB streaming, offline shell | Fast initial boot and no major chunk hitching |
| A16 | Performance | FPS/frame/memory budgets and dynamic scaling | 60fps strong phones, stable 30+ supported mid-range |
| A17 | QA / Automation | Driving, race, pursuit, PWA and mobile regression suite | Regressions block promotion |
| A18 | Build / Release | GitHub CI -> deploy validation | Known commit maps to known live build |
| A19 | Technical Director | Shared contracts and architecture | One representation for roads, vehicles, telemetry and states |

## Milestone order

1. Feel: A06 + A07 + A14
2. Visual identity: A01 + A12
3. Content families: A02 + A03
4. World: A04 + A05
5. Life: A08 + A09 + A10
6. Ownership/content depth: A11 + A13
7. Ship quality: A15 + A16 + A17 + A18

A19 reviews architecture throughout. A00 controls scope and final acceptance.
