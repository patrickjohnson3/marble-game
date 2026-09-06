# Focused improvement pass: go-to-town

Inspected baseline `e669eca` before editing. The initial Node suite, ESLint,
Prettier, and local Chrome smoke suite all passed. Chrome needed permission to
bind a localhost server outside the workspace sandbox. No dependencies, runtime
modules, map layouts, or physics tuning values were added or replaced.

## Game model

`boot.js` loads the static ES-module app. `app.js` composes controllers around
shared game state, a mutable active map, and kitchen simulation state. Input
becomes smoothed virtual tilt; physics integrates acceleration, drag, a soft
speed cap, terrain and rectangle contacts in bounded substeps. There is no
height/slope simulation. Kitchen objects then respond to the marble's movement.
DOM/CSS and cached canvas layers render the result; the camera follows the
marble across large maps. Settings pause play and persist preferences.

Start calibrates input and opens a five-second practice pen. The shipped maps
form a cyclic sequence of 15 authored/frozen variants. Holding fully inside the
green goal advances the map; holding nearer its center fills it faster. Hazards
return the marble to spawn. There are no lives, score, global time limit, or
persistent level unlocks. The kitchen's pushable cereal, ants, sponge and water
best express the documented exploration-first direction. Haptics, fullscreen,
wake lock and offline installation are progressive browser capabilities.

## Ranked decisions

Costs and risks below are judgments from this inspection, not measured player
preferences. Findings are reproduced in code/tests unless marked for playtest.

| Rank | Problem and decision                                                                                                                                                                                                  | Player / correctness impact | Confidence                                                  | Cost / regression risk      |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | ----------------------------------------------------------- | --------------------------- |
| 1    | Fix delayed sensor and motion-to-orientation handoffs, invalid readings and motion screen axes. A phone held at beta 45 could inherit keyboard neutral 0 and immediately steer at maximum tilt.                       | High / high                 | High for state/math; physical feel unverified               | Moderate / moderate         |
| 2    | Anchor pinch at the finger midpoint and suspend following while fingers stay down. A 2× pinch at camera (-600,-600) moved the point under (250,250) to (1100,1100).                                                   | High / high                 | High                                                        | Low / low                   |
| 3    | Fix stale collision scratch. An earlier rotated query could leave zero/incorrect normals that prevented ejection from a later rectangular obstacle.                                                                   | Medium / high               | High                                                        | Low / low                   |
| 4    | Finish kitchen contacts before goal progression; terminate hazard physics at reset. Teleports could sweep across a new kitchen and shove cereal roughly 40 px, or accelerate away from respawn within the same frame. | Medium / high               | High                                                        | Low / low                   |
| 5    | Make Retry restore the entire current map, including water and kitchen objects. Previously it only moved the marble and cleared goal progress.                                                                        | Medium / medium             | High for behavior; reset semantics are a design choice      | Low / low                   |
| 6    | Explain controls/goal before Start and spawn completion particles after map activation. Previously instructions were hidden in Settings and map reset erased the completion burst before rendering.                   | Medium / low                | High for visibility; text/celebration preference unverified | Low / low                   |
| 7    | Defer combined acceleration/drag integration and terrain tuning until comparative playtests. The current integrator still varies with frame cadence.                                                                  | Potentially high / medium   | Measured numerical difference; perceptual impact unverified | Moderate / higher feel risk |

## Behavior and tradeoffs

- Sensors accept only complete finite samples. Changing source starts a fresh
  18-sample neutral calibration using the existing tuning and clears smoothed
  input. Calibration completion stops velocity, as before. This avoids mixed
  baselines at the cost of a brief interruption when sources change. Keyboard
  input can still start the intro if a partly initialized sensor stream stalls;
  it leaves the sensor's pending neutral intact. Late permission results remain
  recorded but cannot overwrite already running input status.
- Both sensor paths use the existing screen-axis transform. Rotation after
  calibration and sustained sensor dropout are still separate unresolved
  cases. Set neutral continues to use current paused readings.
- Camera zoom uses the actual clamped scale to preserve its anchor. World-edge
  clamping can necessarily shift that anchor. Existing automatic follow and
  cooldown remain; no extra camera mode or permanent control was introduced.
- Retry re-resolves the current variant in `core/map-progression.js` and uses
  normal map activation in `app.js`, restoring mutable content. It preserves
  calibration, preferences, zoom and any unfinished intro countdown. Players
  who used Retry merely to return to spawn will now lose their experiments.
- Goal completion uses the existing burst at the destination spawn. This keeps
  the immediate transition and gives visible arrival feedback; it does not add
  a victory pause, timer, or transition state machine.

Rejected broad physics rewrites, extra levels, forced navigation arrows and a
renderer overhaul. Existing bounded particles, low-resolution terrain canvases
and kitchen dirty-region rendering should be profiled on hardware before
changing their allocation strategy. Inspection of the sponge PNG's transparent
padding disproved an apparent large width mismatch: the visible width is about
265 world pixels for a 264-pixel collider. Height/contact feel still needs work.

## Validation

Focused regression coverage lives beside the affected systems:

- Sensor/keyboard/lifecycle tests: invalid readings, fresh source calibration,
  mixed-source samples, four screen angles, paused manual neutral, pre-start
  gating, keyboard during stalled calibration, and late permission results.
- Camera tests: moving midpoint, zoom direction and limits, stationary fingers,
  cancellation/replacement, reset, and release of the intro during a pinch.
- Physics/game-loop tests: reused rotated-contact scratch, exact hazard spawn
  under held input and multiple substeps, no stale terrain feedback, and no
  cross-map or hazard-to-spawn kitchen sweeps.
- Goal/progression tests: completion particles survive reset at the arrival
  position; Retry restores water, sponge, cereal, ants, marble and goal state
  without mutating authored map data.

Local Chrome checks exercise actual DOM/canvas startup, keyboard movement,
settings pause/resume, synthetic orientation, synthetic install-prompt wiring,
short-viewport settings reachability, and the new synthetic sensor/pinch
regressions. Screenshots were inspected at 390×844. A fake-DOM lifecycle probe
also verified Retry during the intro preserves the paused countdown remainder.
These checks establish browser wiring and deterministic behavior, not device
sensor quality or physical touch behavior.

Final validation passed: `npm run sync-cache`, `npm test` (all 27 Node/cache
tasks), `npm run test:browser` (expanded local Chrome workflows),
`npm run lint`, `npm run format:check`, and `git diff --check`. No browser
console errors were observed. Use `npm run sync-cache` before the final suite
whenever a runtime asset changes.

## Remaining playtests and next work

1. On **Android Chrome, Android Brave, iPhone Safari and iPhone Chrome**, use
   HTTPS and test normal holding-angle calibration, delayed permission,
   motion fallback where available, all steering directions in portrait and
   landscape, Set neutral while paused, and keyboard fallback where available.
   Check a pinch held motionless longer than 1.5 seconds, cancellation, zoom
   limits, map edges and intro release. **None of these physical-device checks
   were available in this environment.** Haptics, wake lock, fullscreen,
   installed-app behavior and offline updates also remain unverified on those
   devices; this pass does not claim new validation of those APIs.
2. Address keyboard held-key bookkeeping/focus loss and sensor rotation/dropout.
   Multiple synonymous/opposite keys can lose the still-held direction; losing
   focus can leave a key logically held. Changing screen orientation after
   calibration retains the old screen-space neutral.
3. Compare braking, neutral drift, terrain crossings, wall slides and object
   pushing on real 30/60/120 Hz devices before retuning. A deterministic
   two-second rough-terrain run at constant 5-degree raw tilt produced
   distances 218.82 / 208.82 / 203.55 world pixels at 30 / 60 / 120 Hz; final
   speeds were 1.436 / 1.607 / 1.697 per target frame. Drag exponentiation alone
   does not make combined acceleration and position integration invariant.
   A subsequent integration correction preserves this 60 Hz result and yields
   distances of 209.65 / 208.82 / 208.09, with final speed 1.607 at every
   cadence. The remaining 0.75% distance spread includes frame-sampled input
   smoothing and settling; constant smoothed-input motion agrees across frame
   partitions. See the physics pipeline in [architecture.md](architecture.md).
   After preserving capped-step movement, a two-second 60 Hz keyboard floor
   run travels 1666.80 pixels versus 1668.45 before the integration correction
   (-0.099%), instead of the reviewed 1694.07 (+1.535%).
   Also check sponge height/contact and overlap with other fixtures before
   extending the object interactions.

Goal/terrain textual hints still live in Settings; the goal fill, particles and
optional arrow supply in-play feedback. Further discoverability work should
preserve the sparse play surface and relaxed exploration.
