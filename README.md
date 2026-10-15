# Driftline

**Driftline** is an open-source, tilt-controlled downhill game — the first playable
proof-of-concept for the **open balance-board fitness platform** idea: a wobble
board plus the phone in your pocket becomes a full-body game controller.

You are a rider carving down an endless slope. Tilt the board left and right to
steer, lean forward to tuck for speed, lean back to brake. Thread slalom gates
for points, dodge pines and rocks — and keep an eye uphill: after a while, a
shadow beast picks up your scent, and it *will* catch you. A run lasts about
60–120 seconds, which is exactly one good plank.

## Vision

Commercial "exercise games" lock the fun behind subscriptions and proprietary
hardware. Driftline proves the core loop — **phone IMU + balance board + short,
readable game sessions** — can be open, hackable, and genuinely fun. The game
is intentionally simple (Canvas 2D, no engine) so contributors can read the
whole thing in an afternoon and start tuning.

## Run it locally

Requirements: Node 20+.

```bash
npm install
npm run dev        # desktop: http://localhost:5173 (keyboard/mouse tilt sim)
npm test           # unit tests (Vitest)
npm run lint       # eslint
npm run typecheck  # tsc --noEmit
npm run build      # production build -> dist/
```

## Test it on iPhone

The game is a PWA: it runs in mobile Safari with no App Store involved.

1. On your Mac, run `npm run dev:host` (that's `vite --host`).
2. **HTTPS is required**: iOS only exposes `DeviceMotion` in a secure context.
   Put the dev server behind a
   [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/)
   (`brew install cloudflared`). Pick one:
   - **Quick tunnel** (no Cloudflare account): run
     `cloudflared tunnel --url http://localhost:5173` and use the random
     `https://*.trycloudflare.com` URL it prints. A new URL each run.
   - **Named tunnel** (stable URL on your own Cloudflare domain), one-time setup:

     ```bash
     cloudflared tunnel login                  # pick your domain in the browser
     cloudflared tunnel create driftline-dev
     cloudflared tunnel route dns driftline-dev dev.example.com
     echo "DEV_TUNNEL_HOST=dev.example.com" > .env.local   # gitignored
     ```

     Then each session: `cloudflared tunnel run --url http://localhost:5173 driftline-dev`.

   Vite rejects unknown hostnames, so `vite.config.ts` allow-lists
   `*.trycloudflare.com` and whatever `DEV_TUNNEL_HOST` is set to. If you see
   "Blocked request. This host is not allowed", check `.env.local` and
   restart the dev server.
3. On the iPhone (any network — the tunnel is public), open the HTTPS URL. Tap
   **"Enable motion & start"** — iOS 13+ requires motion permission to be
   granted from a user gesture, which is what that button does.
4. Mount the phone in **landscape, screen facing up** on the board. Hold the
   board level while the game calibrates neutral (~1 second), then ride.
5. If your neutral drifts mid-run, reload the page to re-calibrate.
6. **Wake lock**: the game requests a screen wake lock on start so the display
   doesn't sleep mid-run. If the tab goes to the background, the game pauses —
   bring it back to resume.

Tip: **Add to Home Screen** for a fullscreen, app-like experience (the manifest
and service worker make it installable and work offline after the first load).

## Testing pyramid (our SDLC)

```
        ┌─────────────────────────────┐
        │  On-board playtests (feel)   │  <- you, planking, weekly
        ├─────────────────────────────┤
        │  On-phone IMU tests         │  <- iPhone Safari, HTTPS, real tilt
        ├─────────────────────────────┤
        │  Desktop sim (keyboard)     │  <- 90% of dev: tune speed, gates, chaser
        ├─────────────────────────────┤
        │  Unit tests (Vitest)        │  <- CI: collisions, scoring, chaser, tilt math
        └─────────────────────────────┘
```

- **Unit** (`npm test`): collision detection, scoring, chaser catch-up logic,
  input dead-zone math. Run in CI on every push/PR.
- **Desktop sim**: `KeyboardTiltInput` maps arrows/WASD and pointer drag to the
  same `TiltInput` interface the phone uses — tune `src/config.ts` here.
- **On-phone**: verifies IMU calibration, dead zone feel, and performance on
  real hardware.
- **On-board**: the only true playtest. Short loop: change a constant, rebuild,
  ride.

All gameplay tuning lives in **`src/config.ts`** — no magic numbers elsewhere.

## Architecture

```
src/
  main.ts            # boot, menu UI, wake lock, PWA registration
  config.ts          # ALL tuning constants
  pwa.ts             # service worker registration
  input/
    TiltInput.ts           # the interface the game sees
    tiltMath.ts            # dead zone, low-pass, calibration (tested)
    KeyboardTiltInput.ts   # desktop dev/testing
    DeviceMotionTiltInput.ts # real phone IMU
  game/
    game.ts          # fixed-timestep loop, physics, scoring orchestration
    world.ts         # procedural course generation (seeded RNG)
    chaser.ts        # the shadow beast (run timer)
    collisions.ts    # pure collision helpers (tested)
    scoring.ts       # pure scoring helpers (tested)
    renderer.ts      # Canvas 2D, original art only
    rng.ts / types.ts
```

## Clean-room IP note

Driftline is a **clean-room** downhill-dodging game. It was written from
scratch for this project:

- No SkiFree source code, binaries, sprites, music, or sounds are used or
  referenced. (The original SkiFree source was never open-sourced; a
  community decompilation exists but is **not** a usable open-source base —
  its own README states the game and assets remain the property of the
  original author.)
- All art is drawn in code (geometric pines, rocks, gates, rider). The chaser
  is an original "shadow beast", not the SkiFree yeti.
- The name "SkiFree" (and the yeti character) are not used anywhere.
- Game *mechanics* (steer downhill, dodge obstacles, timed gates) are not
  copyrightable; only creative expression is — and ours is original.

If you contribute art, music, or names: **make it yours, don't homage theirs.**

## License

TBD — pick one before publishing (MIT or GPL-3.0 recommended for the
open-platform goal).
