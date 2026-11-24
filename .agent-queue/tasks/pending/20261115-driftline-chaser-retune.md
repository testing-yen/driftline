---
id: "20261115-driftline-chaser-retune"
title: "Retune Driftline chaser to 60-120s curve, verify auto-pause, add crash feedback"
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

Work in the Driftline repo (testing-yen/driftline, live at https://driftline.chuangwangfu.com). I ran a 12+ run browser playtest before the public announcement. Three findings need work, in this order. Do NOT skip Phase 0 — I don't want blind tuning.

## Playtest data (all runs, desktop keyboard input)

- Every run ended "Caught!" at 0:36–0:38 and 509–535 m, regardless of play style: no-input 187 pts, hold-left 157 pts, hold-right 354 pts, gate-seeking 654 pts.
- Pause/resume, Ride again, session table and Session plank time accumulation, BEST retention, drag steering, edge clamping, gate pass/miss display all work correctly. Don't touch them.

## Phase 0 — Diagnose the chaser math first, in writing

Read `src/game/chaser.ts`, `src/config.ts` and `src/game/speedGauge.ts` and work out, with the production scale k = 3.5, why a coasting (no-lean) rider is caught at almost exactly 522 m / ~37 s every time. My own back-of-envelope, which you should verify or refute from the code:

- pxPerMeter = 35, flatSpeed = 500.5 px/s (≈14.3 m/s), fullLeanSpeed = 1638 px/s (≈46.8 m/s)
- chaserTriggerDistance = 4500·k px = 450 m — note the comment in config.ts says "~17s in", but at flatSpeed that is ~31.5 s. Explain the mismatch.
- chaserSpawnBehind = 850·k px = 85 m; chaserSpeed = 295·k = 1032.5 px/s; closing speed vs a coasting rider ≈ 532 px/s, so the catch follows ~5–6 s after spawn: 450 m spawn + ~72 m ≈ 522 m. This matches the playtest exactly, which suggests the catch is effectively deterministic for anyone who doesn't lean hard.

Then build a headless simulation (use the existing test setup and `KeyboardTiltInput.setSimulated`, or drive `Game`/`Chaser` directly) that reports survival time and distance for constant lean levels y = 0, 0.3, 0.5, 0.7, 1.0. Show me this table BEFORE changing any numbers.

## Phase 1 — Re-tune the chaser to its own stated design intent

`chaser.ts` documents the intent: the chaser "is slightly faster than coasting speed, so passive players get caught; tucking outruns it for a while, but its acceleration guarantees the run ends in roughly 60–120 seconds". Current tuning does not deliver that curve. Change tuning ONLY in `src/config.ts` (per that file's own convention — no hard-coded gameplay numbers elsewhere) so the simulated curve is approximately:

- y = 0 (coasting): caught in ~45–60 s
- y = 0.5 (moderate lean): survives ~75–90 s
- y = 1.0 (full lean): approaches but does not exceed the ~120 s cap

Levers available: chaserTriggerDistance, chaserSpawnBehind, chaserSpeed, chaserAccel. Also fix the stale "~17s in" comment to match the tuned reality. Re-run the simulation and show the before/after table. If the target curve is mathematically impossible with these levers alone, say so and propose the minimal code change instead of silently expanding scope.

## Phase 2 — Verify auto-pause on tab hide; don't assume it's missing

`src/main.ts` `boot()` already registers a `visibilitychange` handler that calls `pauseGame()`. But in the live playtest, a run started at 174 pts / 370 m was left in a background tab for ~10 s and was over ("Caught!") when we came back. Investigate the discrepancy:

- Reproduce with a real hidden tab (check `document.hidden` actually becomes true — an automated tab switch may not hide the page, in which case say so and close this as not-a-bug).
- If it does reproduce: find why (handler registration timing, `game` phase check, deployed build drift, etc.), fix it, and add a regression test that dispatches the hide path during play and asserts the phase becomes 'paused' and score/distance freeze.
- Consider `window` blur as a fallback only if you find a real case visibilitychange misses.

## Phase 3 — Make obstacle crashes perceivable (small scope)

Crashes exist in code (stumble: `stumbleSlowFactor`, `stumbleDuration`, `stumblePenalty`, `invulnDuration` in config; `crash()` in game.ts), but playtesters deliberately ramming pines/rocks could not tell a hit had happened — no visible feedback, runs just continued. Add ONE clear feedback channel using existing patterns (e.g. a callout like the jump/flip callouts, a brief screen shake, or a flash on the rider). Do NOT change penalty/slow values in this phase.

## Rules

- Node 22. Run the full suite before finishing: tests, lint, typecheck, build — all green.
- Keep changes scoped to the three phases. No refactors, no unrelated cleanup.
- Final report must include: the Phase 0 diagnosis (was my math right?), the before/after simulation table, the Phase 2 verdict (bug or test artifact, with evidence), and a list of every config value changed with old → new.
