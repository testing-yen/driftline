# Result: Driftline juice pass v1: snow spray, crash hit-stop/shake, near-miss whoosh, intensity setting

- task: `20261125-driftline-juice-pass-v1`
- status: **done** (claude exit code 0)
- branch: `agent/20261125-driftline-juice-pass-v1`
- worktree: `/Users/yen/repo/driftline-queue-worktrees/20261125-driftline-juice-pass-v1`
- session_id: `1213392f-ef00-4ab0-a5cd-6a0271277e00`
- total_cost_usd: `2.5829478000000003`
- num_turns: `45`

## Files changed

```
2dc72f5 agent: Driftline juice pass v1: snow spray, crash hit-stop/shake, near-miss whoosh, intensity setting [20261125-driftline-juice-pass-v1]

 src/audio/sfx.ts            |  52 +++++++++
 src/config.ts               |  24 +++++
 src/game/collisions.ts      |  10 ++
 src/game/game.ts            |  43 ++++++--
 src/game/juice.ts           | 188 +++++++++++++++++++++++++++++++++
 src/game/particles.ts       |  67 ++++++++++++
 src/game/renderer.ts        |  50 +++++++--
 src/game/types.ts           |   6 +-
 src/main.ts                 |  24 ++++-
 src/style.css               |  32 ++++++
 src/ui/juicePicker.ts       |  26 +++++
 tests/chaserCurve.test.ts   |   2 +-
 tests/crashFeedback.test.ts |   2 +-
 tests/juice.test.ts         | 249 ++++++++++++++++++++++++++++++++++++++++++++
 14 files changed, 749 insertions(+), 26 deletions(-)

```

## Agent result

All four phases are in and every check passes on Node 22.23.4: 285 tests (1 skipped, as before), lint, typecheck and build. Nothing is committed, pushed or opened as a PR.

**Branch note.** This worktree's branch didn't include PR #23, so I moved it to `origin/main` (9aad9c2) before starting. It had no commits of its own, so nothing was lost. Opening a PR under our branch-naming rule needs a Jira ticket ID, so send me one when you want the PR.

## Phase 0 survey

- **Hit-stop** goes at the top of `Game.update()`. The world freezes, including the chaser and game time, but drawing continues.
- **Crash shake and burst** go in `crash()`. The game already had a crash shake (`addShake(8)`, there since the first scaffold commit). It lasted about 480 ms and didn't depend on the frame rate being steady. I replaced it with a configured, time-based shake that can be turned off. The "CRASH!" callout is untouched.
- **Spray** is emitted in the ground-steering branch of `update()`. **Near misses** are checked in the same place as obstacle collisions, only on steps with no crash.
- **Reused:** the existing callout system (new `'close'` kind, drawn by `drawCallout`), the existing shake hook, and the `localStorage` load/save pattern from `playMode.ts`.
- **Audio:** the game had none. `src/audio/sfx.ts` builds the whoosh from noise with WebAudio. The audio context is created on the first tap or key press, and not at all while the setting is `off`. There are no asset files.

## New config constants (`src/config.ts`, "Juice" block)

| Constant | Value | Controls |
|---|---|---|
| `particleCap` | 256 | Most snow particles alive at once. The oldest gets reused past this. |
| `sprayMinIntensity` | 0.08 | Below this carve intensity there is no spray. |
| `sprayMaxRate` | 240 | Spray particles per second at full carve. |
| `sprayKick` | 340 | px/s sideways throw at full carve, out of the turn. |
| `spraySizeMin` / `spraySizeMax` | 2 / 7 | Particle size in px, from a light carve to a full one. |
| `sprayLifeS` | 0.45 | Seconds a spray particle lives while fading. |
| `sprayCarry` | 0.85 | Share of the rider's downhill speed a particle starts with, so the tail trails behind. |
| `particleDrag` | 5 | 1/s slowdown of particles. |
| `particleJitter` | 0.3 | ±30% random spread on throw, size and life. |
| `crashHitStopS` | 0.09 | Seconds gameplay freezes on a crash. |
| `crashShakePx` | 6 | Peak shake in px, for a crash at full-lean speed. |
| `crashShakeS` | 0.22 | Seconds the shake lasts while easing out. |
| `crashBurstCount` | 48 | Burst particles for a crash at full-lean speed. |
| `crashBurstKick` | 420 | px/s throw of burst particles, in all directions. |
| `nearMissMarginPx` | 22 | Edge-to-edge sideways gap under which a pass counts as a near miss. |
| `nearMissCooldownS` | 1.0 | Silence after a whoosh and callout. |
| `whooshVolume` | 0.3 | Peak volume of the whoosh. |
| `whooshS` | 0.28 | Length of the whoosh in seconds. |
| `whooshLowHz` / `whooshHighHz` | 500 / 2600 | Range of the whoosh's pitch sweep. |

No speed, chaser, penalty, slow-down or scoring value changed.

## How each effect follows the player

- **Carve intensity** is sideways lean (0 to 1) times speed as a share of full-lean speed. Spray rate, particle size and sideways throw all grow with it. Riding straight gives zero spray. In the built game, a hard carve leaves a visible trail and riding straight leaves none.
- **Crash:** shake strength and burst size grow with speed at impact. A crash on a level board gets about 1.8 px of shake and 14 particles. A crash at full lean gets 6 px and 48.
- **Hit-stop** doesn't scale with speed. The game runs in fixed 60 Hz steps, so 90 ms rounds up to 6 steps, about 100 ms. `reduced` gets 3 steps, about 50 ms.
- **Near miss:** the whoosh is louder and sweeps higher for a closer, faster pass. Its strength is the average of closeness and speed share.
- **Gameplay is unaffected:** hit-stop pauses everything together, so it costs the rider nothing.

**Particle cap:** 256 in a fixed pool of typed arrays, so emitting and updating allocate nothing per frame. A full carve keeps about 108 alive, and a crash burst adds up to 48.

## Setting and near-miss count

- **Setting:** an "Effects: Full / Reduced / Off" row on the start menu, saved as `driftline.juice.v1`. On first run it starts at `reduced` if the browser asks for reduced motion. In headless Chromium with reduced motion it showed Reduced; after picking Off and reloading it stayed Off.
- **What each level does:** `reduced` halves hit-stop and shake, and shows "CLOSE!" with no pop or white flash. `off` turns off spray, burst, shake, hit-stop, whoosh and the CLOSE! callout. "CRASH!" stays at every level.
- **Near-miss count:** it lives in `Game.nearMisses` (read through the `nearMissCount` getter) and resets each run. It counts every near miss, whatever the setting. The 1 s cooldown only limits the whoosh and callout. Each obstacle can trigger at most once, because the check fires on the single step where the rider passes the obstacle's line.

## Test evidence for the setting (`tests/juice.test.ts`, 13 tests)

- **Off:** a real headless `Game` crashes into a tree. Game time keeps moving the next step (no hit-stop), the renderer gets no shake calls, no particles are drawn, and "CRASH!" still shows.
- **Full and reduced:** game time stands still for the full hit-stop, then one shake and a burst play. `reduced` has exactly half of full's hit-stop and shake.
- **Same run either way:** the same course at `full` and `off`, with crashes, ends in an identical result (score, distance, duration, crash count).
- **Cooldown:** the second near miss within 1 s gets nothing back and no whoosh; the next one after 1 s plays. In a real run, four trees in a row each count once, but only two "CLOSE!" callouts show.
- **Spray:** rate never drops as lean or speed rises, is 0 riding straight, and is the most at a full carve. It depends only on lean × speed.
- **Each test catches its bug.** I broke the code six ways, and each time at least one test failed:
  - `off` keeping hit-stop, shake or particles
  - the cooldown removed
  - hit-stop not hooked into the game loop
  - spray ignoring speed

## Not verified

- I haven't heard the whoosh, because the browser check ran headless.
- I haven't seen the crash burst or shake on screen. The tests cover them, but my screenshots only caught the carve trail and a real near-miss "CLOSE!".

A quick check on a phone would cover both.

## Runner policy

secret scan: clean

## Continue this session

New task file with frontmatter `resume: "1213392f-ef00-4ab0-a5cd-6a0271277e00"` continues the same Claude session instead of starting fresh.
