# Developer Architecture

This document is for returning to the project after a long break. It explains
where the moving parts live, how the app starts, and how one frame flows through
input, physics, rendering, haptics, camera, and map progression.

## Project Shape

This is a static browser game. There is no build step for runtime code. The
browser loads `index.html`, which loads `boot.js`, which imports `app.js` and
the rest of the ES modules directly.

The important top-level folders are:

- `core/`: game state, map data processing, physics, camera, lifecycle,
  haptics, progression, timing, and pure utilities.
- `input/`: browser input wiring plus keyboard and motion sensor controllers.
- `rendering/`: DOM/SVG/canvas renderers for the marble, map, surfaces,
  effects, trail, and UI.
- `settings/`: settings schema, persistence, UI binding, and runtime
  application of settings.
- `maps/`: authored map data used by `core/map-config.js`.
- `tests/`: Node-based unit and smoke tests.
- `docs/`: developer-facing notes.

Runtime files are cache-versioned manually. After changing runtime JavaScript,
CSS, or HTML, run `npm run sync-cache` before committing.

## Startup Sequence

The entrypoint is intentionally small:

1. `boot.js` imports `createApp` from `app.js`.
2. `boot.js` calls `createApp()`.
3. `createApp()` gathers DOM references with `createDomElements()`.
4. `createMapRuntime()` derives the active map state from `resolvedMapConfig`.
   This produces filtered terrain arrays, obstacle arrays, bounds, spatial
   indexes, spawn, goal, and active map metadata.
5. `createGameState()` creates the mutable runtime state object: marble,
   bounds, intro, input, camera, haptics, game phase, and physics tuning.
6. Settings are loaded from `localStorage` with `loadSettings()`, copied into a
   runtime settings object, and later persisted through
   `persistedSettingsFromRuntime()`.
7. Controllers and renderers are composed in `app.js`:
   - camera controller
   - terrain/map/marble/trail/effects renderers
   - settings applier
   - intro sequence
   - map progression and goal controller
   - sensor and keyboard controllers
   - lifecycle controller
   - input manager
   - game loop
8. Initial setup runs:
   - document copy is applied
   - map terrain and walls are rendered
   - settings are applied
   - marble radius is measured from the DOM
   - camera is centered on the marble
   - start button, keyboard, and gestures are bound
   - an initial render is requested

The app should avoid painting the marble in an invalid state. The marble starts
at the current map spawn, and `marbleView.syncRadius()` fills in its collision
radius from the rendered element before gameplay starts.

## Start Button Flow

The user-facing start behavior lives in `core/startup-flow.js` and
`core/game-lifecycle.js`.

When the start button is pressed:

1. `gameController.start()` calls `startGameWithPermissions()`.
2. The start button is hidden and disabled.
3. Motion permission is requested with a timeout. This is required for iOS-like
   permission flows but should not block desktop keyboard fallback forever.
4. If permission is denied, the start button comes back and the hint explains
   the failure.
5. Fullscreen and wake lock are requested from `platform/platform.js`.
6. `gameController.reset()` resets runtime state to the current spawn and intro
   pen.
7. Motion listeners are enabled.
8. `game.phase` becomes `calibrating`.
9. A frame is scheduled.
10. The sensor watchdog starts. If no sensor arrives, it switches to keyboard
    mode and starts the intro countdown path.

On mobile, sensor events normally auto-neutralize through
`input/sensor-controller.js`. On desktop, keyboard input is enabled immediately
and the watchdog supplies the fallback path.

Opening the settings modal pauses the game through `gameController.pause()`.
Closing it resumes only if opening the modal actually paused active gameplay.

## Runtime Update Loop

Frame scheduling is split between `core/frame-loop.js` and `core/game-loop.js`.

`createFrameLoop()` owns requestAnimationFrame-style scheduling state:

- whether a frame is already scheduled
- whether a render was requested while idle
- whether idle frames can be skipped

`createGameLoop()` owns what happens during a frame:

1. Begin the frame and compute `frameDelta`.
2. Convert elapsed milliseconds into a normalized frame delta using
   `timing.targetFrameMs`, clamped by min and max frame delta.
3. Decide whether gameplay is active:
   `game.phase !== "waiting" && !game.paused`.
4. If idle and no render is needed, update debug UI and return.
5. If active:
   - get the current physics context from `app.js`
   - update smoothed input with `updatePhysicsInput()`
   - update physics with `updatePhysics()`
   - advance marble roll and impact squash animation
   - update goal hold/progression
   - update camera follow
6. Render the marble.
7. Update the trail unless paused.
8. Update FPS and debug stats.
9. Mark the frame rendered.
10. Schedule the next frame if gameplay is still active.

The game loop intentionally mutates the shared runtime state. That keeps the
game simple and avoids object churn in the hot path. Pure helpers are tested in
isolation where practical.

## Physics Pipeline

Physics is centered in `core/physics.js` with collision helpers in
`core/physics-collisions.js`.

Each active frame does:

1. `updatePhysicsInput(context, dt)`
   - reads raw tilt and keyboard state
   - subtracts neutral calibration
   - applies dead zone and tilt curve
   - smooths toward the target tilt in a frame-rate independent way
2. `updatePhysics(context, dt, feedback)`
   - rejects invalid or non-positive `dt`
   - computes substeps from speed, `maxStepDistance`, and
     `maxPhysicsSubsteps`
   - precomputes frame-rate independent drag and max-speed easing factors
   - runs `physicsStep()` one or more times

Inside one `physicsStep()`:

1. Query ice candidates from the spatial index.
2. Apply acceleration from smoothed tilt.
3. Apply ice or base drag.
4. Ease velocity down if it exceeds max speed.
5. Zero tiny drift when both speed and tilt are below settle thresholds.
6. Query rough-patch candidates using a swept circle between old and predicted
   marble positions.
7. Check rough-patch contact before movement.
8. Move the marble.
9. Check rough-patch contact after movement.
10. Apply rough-patch drag if either check touched rough terrain.
11. Query obstacle candidates from the spatial index.
12. Resolve world bounds and obstacle collisions in `handleWallCollisions()`.
13. Emit surface feedback for rough patches.

Collision handling uses circle-rectangle contact from `core/geometry.js`.
Obstacle collision pushes the marble out along the contact normal, reflects
velocity when moving into the obstacle, and sends impact strength to the
feedback pipeline. Bounds are resolved before obstacles on each pass.

The physics context is reused across frames in `app.js`; only the map-dependent
arrays and spatial indexes are refreshed before each physics update. Scratch
arrays and sets are also reused to avoid hot-loop allocation.

## Render Pipeline

Rendering is DOM/CSS/SVG/canvas based. There is no WebGL layer.

Static or rarely changing map visuals:

- `createMapRenderer()` sizes the world, renders intro walls, renders outer map
  walls, sets released bounds, and opens/resets the intro pen.
- `createTerrainView()` owns the current terrain references and renders:
  - goal DOM position and size
  - ice patch canvas output
  - rough patch canvas output
  - obstacle wall canvas output
- `renderOuterWalls()` draws the outside boundary.
- `renderObstacleWalls()`, `renderRoughPatches()`, and `renderIcePatches()`
  draw their respective map layers.

Per-frame visuals:

- `createMarbleView().render()` positions the marble with a transform, updates
  impact squash, dynamic shadow values, glint position, and roll CSS variables.
- `createCameraController().updateFollow()` adjusts the world transform after
  the intro map opens, unless a recent gesture is cooling down.
- `createTrailRenderer().update()` updates the optional fading trail.
- `createEffectsRenderer()` manages short-lived impact/surface effects.
- `createUi()` updates hints, FPS, and debug stats.

Important rendering rule: terrain should be redrawn only when the active map
changes. The frame loop should mostly touch transforms, CSS variables, small
effect lists, and optional debug text.

## Map Pipeline

Map configuration starts in `maps/map-data.js` and is assembled in
`core/map-config.js`.

The map system supports:

- authored variants
- procedural variants
- variant selection by id or seed
- validation before advancing maps
- derived runtime arrays and spatial indexes

Key modules:

- `core/map-config.js`: combines map data, base config, defaults, and generated
  variants.
- `core/procedural-generator.js`: creates deterministic generated variants from
  templates and seed values.
- `core/map-variants.js`: resolves/selects active variants.
- `core/map-validation.js`: validates map shape and required fields.
- `core/map-runtime.js`: owns derived active-map state used by rendering,
  physics, and goal progression.
- `core/map-elements.js`: filters elements by type.
- `core/map-obstacles.js`: snaps and normalizes obstacle rectangles.
- `core/map-bounds.js`: computes intro pen and released-map walls/bounds.
- `core/spatial-index.js`: accelerates collision and terrain candidate lookup.

When a goal completes, `core/map-progression.js` selects the next variant,
resolves it into a full map, validates it, applies it through
`createAppMapController()`, resets the marble to the new spawn, and requests a
render.

## Input Responsibilities

`input/input-manager.js` only binds and unbinds browser events. It does not
interpret gameplay.

`input/keyboard-controller.js` owns desktop fallback input:

- arrow keys and WASD update `keyboard.x` and `keyboard.y`
- keyboard input can close settings through the lifecycle controller
- keyboard activity can start the intro sequence when appropriate

`input/sensor-controller.js` owns device orientation/motion:

- updates raw tilt
- tracks whether orientation or motion events arrived
- handles neutral calibration
- schedules frames when sensor input changes

`input/sensor-watchdog.js` owns fallback timing when motion sensors do not
arrive. It switches the game into keyboard mode and starts the intro countdown.

Camera gestures are handled in `core/camera-gestures.js` through the camera
controller. Pinch zoom is a camera concern, not a physics concern.

## Settings Responsibilities

Settings are split deliberately:

- `settings/settings-config.js`: defaults, persisted keys, and control ranges.
- `settings/settings-store.js`: load, migration, clamping, persistence, and
  filtering runtime-only keys out of saved settings.
- `settings/settings-applier.js`: applies settings to runtime systems such as
  haptics, physics tuning, fullscreen preference, and trail behavior.
- `settings/settings-panel.js`: binds modal controls to settings changes.

The runtime settings object is mutable. Persisted settings should always flow
through `persistedSettingsFromRuntime()` before saving so transient debugging or
runtime-only fields do not leak into localStorage.

## Haptics And Feedback

`core/haptics.js` translates gameplay events into vibration pulses when the
platform supports `navigator.vibrate` and haptics are enabled.

Feedback sources:

- obstacle and wall impacts from `createGameLoop().onImpact()`
- rough-patch surface contact from `createGameLoop().onSurface()`
- goal enter/hold/complete events from `createGoalController()`

Haptics are intentionally best-effort. Lack of support or blocked vibration
must never prevent gameplay.

## State Ownership

The main mutable state is created by `createGameState()` and composed in
`app.js`.

Ownership model:

- `state.marble`: updated by lifecycle reset, physics, camera-dependent reset,
  and marble rendering reads.
- `state.input`: updated by sensor and keyboard controllers; read by physics.
- `state.camera`: updated by camera controller and lifecycle reset.
- `state.intro`: updated by lifecycle, intro sequence, and map controller.
- `state.game`: updated by lifecycle/startup and read by most controllers.
- `state.physics`: updated by settings applier and read by physics.
- `mapRuntime.state`: active map, derived element arrays, spatial indexes,
  spawn, goal, and goal hold progress.
- `settings`: runtime settings loaded from persisted settings and mutated by
  the settings panel.

For more detail, see `docs/state-ownership.md`.

## Module Responsibility Index

Use this section when deciding where a change belongs.

- `app.js`: composition root. Wires modules together. Avoid putting gameplay
  rules here unless they are orchestration rules.
- `boot.js`: browser entrypoint only.
- `core/app-map-controller.js`: applies active maps to renderers and resets map
  play state.
- `core/camera.js`: camera transform, follow behavior, and gesture delegation.
- `core/camera-gestures.js`: pointer gesture math for camera zoom/pan behavior.
- `core/copy.js`: user-facing strings.
- `core/debug.js`: debug/stat display formatting.
- `core/dom.js` and `core/dom-ids.js`: DOM lookup and element ids.
- `core/frame-loop.js`: frame scheduling state.
- `core/game-config.js`: numeric tuning for timing, physics, visuals, haptics,
  and general behavior.
- `core/game-lifecycle.js`: start, reset, pause, resume, settings-modal pause.
- `core/game-loop.js`: per-frame orchestration.
- `core/geometry.js`: pure geometry utilities.
- `core/goal-controller.js`: goal hold progress, goal haptics, and map advance.
- `core/haptics.js`: vibration throttling and platform-safe haptic calls.
- `core/intro-sequence.js` and `core/intro-timers.js`: intro countdown state
  and pause/resume handling.
- `core/map-bounds.js`: intro pen and released-map bounds/walls.
- `core/map-config.js`: resolved map config and combined variants.
- `core/map-elements.js`: element type filters.
- `core/map-obstacles.js`: obstacle snapping and joining.
- `core/map-progression.js`: next-map selection and validation on completion.
- `core/map-reachability.js`: map playability/reachability helpers.
- `core/map-runtime.js`: active-map derived state and goal progress state.
- `core/map-validation.js` and `core/map-validation-messages.js`: map schema
  and validation errors.
- `core/map-variants.js`: variant hashing, selection, and resolution.
- `core/physics.js`: input smoothing, velocity, drag, substeps, surfaces.
- `core/physics-collisions.js`: wall and obstacle collision resolution.
- `core/procedural-generator.js`: deterministic procedural variant generation.
- `core/rect-bounds.js`: rectangle collection bounds.
- `core/spatial-index.js`: broad-phase lookup for terrain and collisions.
- `core/startup-flow.js`: permission/fullscreen/wake-lock startup path.
- `core/state.js`: initial mutable state shape.
- `core/timer-utils.js`: timer helpers.
- `input/*`: browser input binding and input-specific controllers.
- `platform/platform.js`: browser/platform APIs isolated for testing.
- `rendering/*`: visual output only.
- `settings/*`: settings schema, persistence, application, and modal binding.

## Common Change Paths

Add or tune a surface:

1. Add or adjust map element data.
2. Update `core/map-elements.js` if the type is new.
3. Update `core/map-runtime.js` to derive arrays, bounds, and indexes.
4. Update `core/physics.js` if the surface affects motion.
5. Add a renderer under `rendering/`.
6. Add validation in `core/map-validation.js`.
7. Add tests in `tests/map-test.js`, `tests/physics-test.js`, and rendering
   tests as needed.

Change marble feel:

1. Prefer tuning values in `core/game-config.js`.
2. If behavior changes, update `core/physics.js` or
   `core/physics-collisions.js`.
3. Add or update frame-rate independence tests in `tests/physics-test.js`.

Change startup or fullscreen behavior:

1. Start in `core/startup-flow.js`.
2. Check lifecycle reset/pause behavior in `core/game-lifecycle.js`.
3. Keep direct browser API calls in `platform/platform.js`.
4. Cover behavior with lifecycle/startup/platform tests.

Change map progression:

1. Start in `core/goal-controller.js` for hold behavior.
2. Use `core/map-progression.js` for selecting and applying the next map.
3. Use `core/map-runtime.js` for active-map derived state.

## Testing And Verification

Run the full gate before pushing:

```sh
npm test
npm run lint
npm run format:check
```

Useful focused tests:

- `node tests/physics-test.js`
- `node tests/map-test.js`
- `node tests/settings-store-test.js`
- `node tests/rendering-test.js`
- `node tests/lifecycle-test.js`

If runtime JS, CSS, or HTML changed, run:

```sh
npm run sync-cache
```

Then rerun the full gate. The pre-push hook runs the same checks.
