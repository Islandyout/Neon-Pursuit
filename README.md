# Neon Pursuit

**Neon Pursuit** is an original, installable open-world arcade racing game inspired by the intensity and progression loops of modern street-racing games without copying protected Need for Speed assets, branding, maps, story, UI, music, or vehicles.

## Current vertical slice

- Browser-native 3D client built with Babylon.js.
- WebGPU renderer with automatic WebGL fallback.
- Installable Progressive Web App (PWA).
- Offline app-shell caching through Workbox / `vite-plugin-pwa`.
- Keyboard, gamepad, and touch driving controls.
- Arcade acceleration, braking, speed-sensitive steering, handbrake yaw, nitrous, basic heat buildup, gear and speed telemetry.
- Responsive chase camera and neon city blockout.
- Mobile-safe landscape/fullscreen presentation.

## Controls

| Action | Keyboard | Gamepad |
| --- | --- | --- |
| Accelerate | W / Up | RT / A |
| Brake / Reverse | S / Down | LT / B |
| Steer | A/D / Left/Right | Left stick |
| Handbrake | Space | X |
| Nitrous | Shift | RB |

Touch controls appear automatically on coarse-pointer/mobile devices.

## Local development

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
npm run preview
```

PWA installation requires HTTPS in production (localhost is allowed during development).

## Architecture direction

The browser client is deliberately split from future authoritative simulation services. Planned production layers:

1. **Render/client:** Babylon.js 9, WebGPU-first with WebGL fallback.
2. **Vehicle simulation:** deterministic fixed-timestep physics; Rapier 3D is the current candidate for the production physics layer.
3. **Networking:** authoritative Colyseus 0.18 rooms with prediction/reconciliation for multiplayer races and pursuits.
4. **World streaming:** district/chunk asset manifests, geometry LODs, compressed glTF/KTX2 assets, pooled traffic and pursuit entities.
5. **Persistence:** profile, garage, progression, settings and local offline save queue synchronized when connectivity returns.
6. **PWA:** installability, versioned service-worker cache, offline single-player shell and staged asset downloads.

## Production rule

Every system must be usable offline in single player unless it inherently requires a server. Multiplayer, leaderboards and cloud persistence must degrade gracefully rather than prevent the game from launching.
