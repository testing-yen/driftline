# Driftline

**Driftline** is an open-source, tilt-controlled downhill game — the first playable
proof-of-concept for the **open balance-board fitness platform** idea: a wobble
board plus the phone in your pocket becomes a full-body game controller.

You are a rider carving down an endless slope. Tilt the board left and right to
steer, lean forward for speed, level out to slow down. Thread slalom gates
for points, dodge pines and rocks — and keep an eye uphill: after a while, an
avalanche golem picks up your scent, and it *will* catch you. A run lasts about
60–120 seconds, which is exactly one good plank.

Snow kickers on the slope launch you into the air for about 1.6 seconds. In the
air you fly over trees and rocks at 1.3× your takeoff speed, which buys
distance from the golem, and you can't steer. Leaning sideways
`trickLeanFraction` of full lean further than you were at takeoff, either
way, throws a front flip for a bonus: you tuck, go upside down and open out
again, and the flip always finishes by touchdown. A meter under the rider
shows your lean against both flip thresholds while airborne, "FLIP!" pops
when one starts, and "EDGE DOWN" shows when a side edge on the floor blocks
it (only the side edges void a trick). Land level: leaning hard at
touchdown crashes you. All jump tuning (`rampEveryGates`, `airSpeedBoost`,
`trickLeanFraction`, `landingCrashLean` and more) is in `src/config.ts`. The
lean thresholds depend on your board, so re-tune them on the board.

## Vision

Commercial "exercise games" lock the fun behind subscriptions and proprietary
hardware. Driftline proves the core loop — **phone IMU + balance board + short,
readable game sessions** — can be open, hackable, and genuinely fun. The game
is intentionally simple (Canvas 2D, no engine) so contributors can read the
whole thing in an afternoon and start tuning.

## Run it locally

Requirements: Node 22 (pinned in `.nvmrc`, which CI also reads; with nvm, run
`nvm use`).

```bash
npm install
npm run dev        # desktop: http://localhost:5173 (keyboard/mouse tilt sim)
npm test           # unit tests (Vitest)
npm run lint       # eslint
npm run typecheck  # tsc --noEmit
npm run build      # production build -> dist/
npm run icons      # regenerate public/icons/*.png after editing scripts/make-icons.mjs
```

## Test it on iPhone

The game is a PWA: it runs in mobile Safari with no App Store involved.

1. On your Mac, run `npm run dev`. The tunnel connects to `localhost`, so there
   is no need for `npm run dev:host`, which also exposes the dev server to
   everything on your LAN.
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

   **A tunnel makes your dev server public.** Anyone with the URL can load it,
   and Vite serves every file in the project folder that isn't on its deny
   list (`.env*`, `*.pem`, `.git/` are blocked; anything else is not). The
   Vite dev server isn't hardened for the internet, so:
   - Stop `cloudflared` when you're not testing.
   - Keep private files out of the project folder while the tunnel runs.
   - For a named tunnel, put
     [Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/applications/configure-apps/self-hosted-public-app/)
     in front of the hostname (free plan; one-time email PIN login), so only you
     can reach it.
3. On the iPhone (any network), open the HTTPS URL. Tap
   **"Enable motion & start"** — iOS 13+ requires motion permission to be
   granted from a user gesture, which is what that button does.
4. Pick a play mode on the start screen. The phone remembers it
   (localStorage key `driftline.playMode.v1`); the desktop keyboard has no
   modes.
   - **Board** (default): mount the phone in **portrait, screen facing up, top
     edge pointing forward** on the board. Hold the board level while the game
     calibrates neutral (~1 second), then ride.
   - **Handheld**: hold the phone in portrait however is comfortable, keep it
     still while the game calibrates neutral, then ride. Tilt the top edge
     **toward you** to go faster (tilting it away does nothing), and tilt left
     or right to steer and flip. Full lean is `handheldFullLeanDeg` (20°) from
     your neutral in every direction. There is no floor, so no **Lift the
     edge!** and no board calibration.

   Lean is measured from the gravity direction at neutral, not from flat, so
   a phone held at 45° or 60° steers as evenly as one lying flat. Each mode
   keeps its own session scoreboard and best; **Change mode** on the
   game-over panel returns to the start screen without wiping either.
5. **Calibrate your board** (Board mode) once, and again whenever the hardware changes. Tap
   **Calibrate board** on the start screen or the Paused panel:
   1. Hold the board level while it measures neutral.
   2. Push the forward edge to the floor and hold still until the bar fills
      (about 1 second). Return the board to level.
   3. Repeat for the back, left, and right edges.
   4. Check the summary, which lists each edge's floor angle and the angle for
      full speed, then tap **Save**. **Redo** starts over; **Cancel** keeps
      the previous measurement.

   The phone remembers the result (localStorage key `driftline.boardReach.v1`).
   Until you calibrate, the game uses angles measured on one wobble board
   (`DEFAULT_REACH` in `src/input/boardReach.ts`).

   Speed comes from leaning **forward** only (leaning back is nearly
   impossible in a plank): a level board is the slowest, and full speed
   arrives at 70% of the forward edge's floor angle, so you reach it while
   planking, not while resting on the edge. Steering uses the same 70% of the
   left and right edges. Past 90% of any edge the board is effectively on the
   floor: the game shows **Lift the edge!** and gives no lean bonus, and if the
   edge stays down for more than half a second the rider slows to half the
   level-board speed. All of these depend on the hardware; tune
   `fullLeanFraction`, `groundedFraction`, `groundedGraceS` and
   `restingSpeedFactor` in `src/config.ts` for another board or a plank rig.
6. If your neutral drifts mid-run, tap the **⏸** button in the top-right corner,
   hold the board level, and tap **Re-center**. Reloading would wipe the
   session board.
7. **Wake lock**: the game requests a screen wake lock on start so the display
   doesn't sleep mid-run. If you lock the phone or switch apps mid-run, the run
   pauses and keeps its score. When you come back, the Paused panel waits until
   you are on the board again and tap **Resume**.

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
  jump rules and ramp placement, a ramp-hitting run against the chaser,
  input dead-zone math, per-board lean normalization, and the calibration steps. Run in CI on every push/PR.
- **Desktop sim**: `KeyboardTiltInput` maps arrows/WASD and pointer drag to the
  same `TiltInput` interface the phone uses — tune `src/config.ts` here.
- **On-phone**: verifies IMU calibration, dead zone feel, and performance on
  real hardware.
- **On-board**: the only true playtest. Short loop: change a constant, rebuild,
  ride.

All gameplay tuning lives in **`src/config.ts`** — no magic numbers elsewhere.

**Downhill scale.** `DEFAULT_DOWNHILL_SCALE` (K, 2.5) sets how fast the snow
scrolls past. Every downhill speed and distance in `makeConfig` is a base value
× K; lateral sizes and all times are not. So gates, trees and ramps come by at
the same rate per second, steering between them is just as hard, jumps last as
long, the golem catches you just as soon, and score and metres keep their pace
(they count px ÷ K). Only the on-screen speed changes. To compare on the phone,
open the dev server with `?speedx=1`, `2`, `2.5` or `3`; production builds
ignore the parameter.

## Architecture

```
src/
  main.ts            # boot, menu UI, wake lock, PWA registration
  config.ts          # ALL tuning constants
  pwa.ts             # service worker registration
  dev/spriteSheet.ts # dev-only sprite sheet: open the dev server with ?sprites
  input/
    TiltInput.ts           # the interface the game sees
    tiltMath.ts            # dead zone, low-pass, neutral gravity frame, calibration (tested)
    playMode.ts            # board / handheld lean profiles, stored mode (tested)
    boardReach.ts          # per-board reach: lean normalization, grounded, storage (tested)
    reachCalibration.ts    # Calibrate board step machine (tested)
    KeyboardTiltInput.ts   # desktop dev/testing
    DeviceMotionTiltInput.ts # real phone IMU, mapped by the play mode's profile (tested)
  game/
    game.ts          # fixed-timestep loop, physics, scoring orchestration
    world.ts         # procedural course generation: obstacles, gates, ramps (seeded RNG, tested)
    chaser.ts        # the avalanche golem (run timer)
    jump.ts          # pure jump rules: takeoff, air tricks, landing (tested)
    collisions.ts    # pure collision helpers (tested)
    scoring.ts       # pure scoring helpers (tested)
    renderer.ts      # Canvas 2D, original art only
    sprites.ts       # pixel-art rider, beast and ramp frames + frame rules (tested)
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
- All art is drawn in code: geometric pines, rocks and gates, plus our own
  pixel-art rider (including the front-flip frames: pitch, tuck, inverted,
  tuck, open) and chaser written as character maps in `sprites.ts`. The flip
  frames are drawn from our own rider, not from SkiFree's trick sprites. The
  chaser is an original "avalanche golem" (a squat heap of packed snow and
  ice shards), not the SkiFree yeti. It uses a plain early-90s palette of
  white, grey, black and red. Only the colours are period style; the creature
  is not a yeti or any other white ape.
- The jump ramp is our own pixel-art snow kicker (a pale run-in between
  growing side walls, orange chevrons, a white lip and a dark take-off edge),
  also a character map in `sprites.ts`. It is not modelled on SkiFree's ramp.
- The name "SkiFree" (and the yeti character) are not used anywhere.
- Game *mechanics* (steer downhill, dodge obstacles, timed gates, jump
  ramps) are not copyrightable; only creative expression is — and ours is
  original.

If you contribute art, music, or names: **make it yours, don't homage theirs.**

## License

TBD — pick one before publishing (MIT or GPL-3.0 recommended for the
open-platform goal).
