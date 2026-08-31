# Neon Pursuit

**Neon Pursuit** is an original, installable open-world arcade racing game inspired by the intensity and progression loops of modern street-racing games without copying protected Need for Speed assets, branding, maps, story, UI, music, or vehicles.

## Current vertical slice

- Browser-native 3D client built with Babylon.js.
- WebGPU renderer with automatic WebGL fallback.
- Installable Progressive Web App (PWA).
- Offline app-shell caching through Workbox / `vite-plugin-pwa`.
- Keyboard, gamepad, and mobile multi-touch driving controls.
- Arcade acceleration, braking, speed-sensitive steering, handbrake/drift yaw, nitrous, basic heat buildup, gear and speed telemetry.
- Responsive chase camera and neon city blockout.
- Phone safe-area support for notches and gesture bars.
- Best-effort fullscreen and landscape orientation when mobile driving begins.
- Portrait rotate prompt with automatic gameplay pause/resume.
- Adaptive mobile-high/mobile-low graphics tiers based on device capability.
- Reduced render pixel density, world density and post-processing on lower-powered phones.

## Controls

| Action | Keyboard | Gamepad | Mobile |
| --- | --- | --- | --- |
| Accelerate | W / Up | RT / A | GO |
| Brake / Reverse | S / Down | LT / B | BRAKE |
| Steer | A/D / Left/Right | Left stick | Left / Right |
| Handbrake / Drift | Space | X | DRIFT |
| Nitrous | Shift | RB | N₂O |

Mobile inputs support simultaneous touches, progressive throttle/steering ramps and haptic feedback where the browser/device exposes vibration.

## Mobile target

The playable PWA is designed for current Android and iOS browsers with a landscape-first HUD. WebGPU is preferred where supported; WebGL remains the compatibility renderer. Fullscreen and orientation locking are best-effort because browser policies differ, so the UI always has a safe fallback.

The mobile renderer caps effective pixel density and scales city/detail/post-processing according to a device tier. This is the first layer of the performance strategy; later world streaming, compressed textures and pooled traffic will further reduce memory and GPU pressure.

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
