---
id: "20261125-driftline-juice-pass-v1"
title: "Driftline juice pass v1: snow spray, crash hit-stop/shake, near-miss whoosh, intensity setting"
base: "main"
model: ""
allowed_tools: "Read,Edit,Glob,Grep,Bash"
permission_mode: "acceptEdits"
max_turns: 40
max_budget_usd: 8
bare: false
resume: ""
timeout_secs: 2400
---

Work in the Driftline repo (testing-yen/driftline, live at https://driftline.chuangwangfu.com).

## Background

The game's core feel was just retuned (PR #23, merged): the chaser now catches on a 60–120 s curve by lean level, and `crash()` in `src/game/game.ts` always shows the "CRASH!" callout. This task adds **juice only**: audiovisual feedback that amplifies what the player is already doing. The design principle (from a game-feel lecture this task is based on): juice decorates solid feel, it never substitutes for it, and it must scale with the player's action rather than fire at constant intensity. Several of the lecture's viewers also complained that hit-stop and screen shake are the first effects they want to turn off, so restraint and a settings toggle are part of the scope, not extras.

Hard scope boundary: **do not change any gameplay tuning** — no changes to speed, chaser, penalty, slow, or scoring values. New constants for the effects themselves go in `src/config.ts`, following that file's existing convention (no hard-coded effect numbers scattered in game code).

## Phase 0 — Survey first (brief)

Read the render loop, `src/game/game.ts` (especially `crash()` and the rider/obstacle update), the obstacle rendering, and any existing audio code. In your final report, state in 3–5 lines where each effect hooks in and what you reused (existing callout system, existing settings persistence if any, existing audio context if any). If the game currently has no audio at all, say so and follow Phase 3's no-assets rule.

## Phase 1 — Snow spray while carving

- Emit snow spray particles from the board/skis while riding. Emission rate and particle size/velocity must scale with lean magnitude × current speed: coasting straight produces little to none; a hard carve at full lean produces a clear rooster tail.
- Particles are visual only: no collision, no gameplay effect.
- Performance: use a capped, pooled particle system (state the cap you chose in the report; a few hundred max). No per-frame allocations in the hot loop.

## Phase 2 — Crash impact: hit-stop + shake + burst

Layer these under the existing "CRASH!" callout inside the crash path:

- **Hit-stop**: freeze gameplay updates for ~90 ms on crash (rendering continues; the world just hangs for a beat). Duration is a config constant.
- **Screen shake**: small amplitude, fast decay (total visible shake well under 300 ms). Amplitude is a config constant.
- **Snow burst**: a one-shot burst of the Phase 1 particles at the impact point, larger than carve spray.
- Do NOT change stumble penalty/slow/invulnerability values. The crash must feel different; it must not punish differently.

## Phase 3 — Near-miss whoosh

- Detect a near miss: the rider passes an obstacle within a small lateral margin (a config constant, in px or meters — follow config's existing units) without crashing.
- Feedback: a short synthesized whoosh via WebAudio (no audio asset files; if the game has no audio context yet, create one lazily on first user gesture per browser autoplay rules) plus a small "CLOSE!" callout using the existing callout pattern.
- Anti-spam: a per-obstacle trigger (each obstacle can trigger at most once) plus a global cooldown (~1 s) so dense tree sections don't machine-gun the effect.
- Track a per-run near-miss count in game state and include it in the final report's description of where it lives; do not build new summary UI for it in this task.

## Phase 4 — Juice intensity setting

- Add a setting with three levels: `full`, `reduced`, `off`. Persist it the same way the game already persists its other settings (find that pattern in Phase 0; if there is none, use localStorage).
- `reduced`: hit-stop halved, shake amplitude halved, near-miss callout still shown but no flash-type emphasis.
- `off`: all effects from Phases 1–3 disabled (the pre-existing "CRASH!" callout stays — it predates this task).
- If the browser reports `prefers-reduced-motion`, default the setting to `reduced` on first run (an explicit user choice overrides this afterwards).
- Add tests: with the setting `off`, crashing produces no hit-stop/shake/burst; near-miss detection respects the cooldown; spray emission scales monotonically with lean × speed (assert via the emission function's inputs/outputs, not pixels).

## Rules

- Use Node 22 (the repo's `.nvmrc` pin; run `nvm use` first). Full suite before finishing: tests, lint, typecheck, build — all green.
- Keep changes scoped to the four phases. No refactors, no unrelated cleanup, no new dependencies, no audio/image asset files.
- Final report must include: the Phase 0 survey (3–5 lines), every new config constant with its value and what it controls, how each effect scales with player input, the particle cap, and the test evidence for Phase 4's gating.
