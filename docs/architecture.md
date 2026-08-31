# Developer Architecture

This document is for returning to the project after a long break. It explains
where the moving parts live, how the app starts, and how one frame flows through
input, physics, rendering, haptics, camera, and map progression.

## Project Shape

This is a static browser game. There is no build step for runtime code. The
browser loads `index.html`, which loads `boot.js`, which imports `app.js` and
the rest of the ES modules directly.

The important top-level folders are:

- `core/`: game state, map data processing, physics, lifecycle, haptics,
  progression, timing, and pure utilities.
- `input/`: browser input wiring plus camera, keyboard, and motion sensor
  controllers.
- `rendering/`: DOM/SVG/canvas renderers for the marble, map, surfaces,
  effects, trail, and UI.
- `settings/`: settings schema, persistence, UI binding, and runtime
  application of settings.
- `maps/`: authored map data used by `core/map-config.js`.
- `tests/`: Node-based unit and smoke tests.
- `docs/`: developer-facing notes.

`runtime-assets.js` is the source of truth for browser modules and precached
assets. Update it when adding or removing a runtime file. After changing
`index.html` or a listed runtime asset, run `npm run sync-cache` before
committing. Do not hand-edit the generated cache metadata in `index.html` or
`sw.js`.

## Startup Sequence

The entrypoint is intentionally small:

1. `boot.js` imports `createApp` from `app.js`.
2. `boot.js` calls `createApp()`.
3. `createApp()` gathers DOM references with `createDomElements()`.
4. `createMapRuntime()` derives the active map state from `resolvedMapConfig`.
   This produces filtered terrain arrays, obstacle arrays, bounds, spawn, goal,
   and active map metadata.
5. `createGameState()` creates the mutable runtime state object: marble,
   bounds, intro, input, camera, haptics, game phase, and physics tuning.
6. Settings are loaded from `localStorage` with `loadSettings()` into the
   mutable runtime settings object.
7. Controllers and renderers are composed in `app.js`:
   - camera controller
   - terrain/map/marble/trail/effects renderers
   - intro sequence
   - map progression and goal controller
   - sensor controller
   - game loop
   - lifecycle controller
   - keyboard controller and input manager
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

The user-facing start behavior lives in `core/game-lifecycle.js`.

When the start button is pressed:

1. `gameController.start()` begins the permission and startup flow.
2. The start button is hidden and disabled.
3. `gameController.reset()` restores the initial map, spawn, intro pen, input,
   camera, effects, and goal state. Reset briefly restores the Start control, so
   startup hides it again before yielding.
4. Fullscreen and wake lock are requested from `platform/platform.js` without
   blocking startup.
5. Motion listeners are enabled, `game.phase` becomes `calibrating`, sensor
   permission becomes `pending`, a frame is scheduled, and the sensor watchdog
   starts.
6. Motion permission is requested with a timeout. This supports iOS-like
   permission flows without blocking desktop keyboard fallback forever.
7. The permission result is recorded as `granted`, `denied`, or `timeout`. A
   denial or timeout changes the hint, while the watchdog remains responsible
   for switching to keyboard mode if no sensor input arrives.

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
   - advance kitchen dynamics and emit kitchen haptic feedback
   - redraw changed kitchen dynamic regions
6. Render the marble, trail, and active effects.
7. Update FPS and debug stats.
8. Mark the frame rendered.
9. Schedule the next frame if gameplay is still active.

The game loop intentionally mutates shared runtime state. Previous-position,
physics-contact, kitchen-event, kitchen-collision, and kitchen-render records
are reused across frames. Trail points and segments are pooled; effect particles
remain short-lived allocations. The runtime is not assumed to be
allocation-free. Profile before adding more pooling or scratch state. Pure
helpers are tested in isolation where practical.

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
   - precomputes frame-rate independent drag and soft speed-cap factors
   - runs `physicsStep()` one or more times

Inside one `physicsStep()`:

1. Check whether the marble starts the substep over ice.
2. Apply acceleration from smoothed tilt.
3. Apply ice or base drag.
4. Apply the soft speed cap if velocity exceeds max speed.
5. Zero tiny drift when both speed and tilt are below settle thresholds.
6. Record the pre-move marble position for terrain sweep checks.
7. Move the marble.
8. Sweep the marble segment against goo, rough, water, and hazard patches.
9. Resolve the current surface using priority:
   goo, rough, water, ice, floor.
10. Apply post-move drag for goo, rough, and water patches.
11. Resolve world bounds and obstacle collisions in `handleWallCollisions()`.
12. Emit hazard, terrain-change, surface, haptic, and visual feedback.

Collision handling uses circle-rectangle contact from `core/geometry.js`.
Obstacle collision pushes the marble out along the contact normal, reflects
velocity when moving into the obstacle, and sends impact strength to the
feedback pipeline. Bounds are resolved before obstacles on each pass.

The physics context is reused across frames in `app.js`; only the map-dependent
arrays are refreshed before each physics update. Small scratch objects are also
reused to avoid hot-loop allocation.

## Render Pipeline

Rendering is DOM/CSS/SVG/canvas based. There is no WebGL layer.

Static or rarely changing map visuals:

- `createMapRenderer()` sizes the world, renders intro walls, renders outer map
  walls, sets released bounds, and opens/resets the intro pen.
- `createTerrainView()` reads the current map and derived terrain from
  `mapRuntime.state` and renders:
  - goal DOM position and size
  - map theme underlay and overlay
  - goo patch canvas output
  - hazard patch canvas output
  - ice patch canvas output
  - rough patch canvas output
  - water patch canvas output
  - obstacle wall canvas output
- Kitchen floor and terrain construction is synchronous, while the initial
  Cheerios-and-ants canvas draw is scheduled for the next animation frame so a
  map transition does not perform both heavy visual passes in one frame.
- `renderOuterWalls()` draws the outside boundary.
- Terrain-specific canvas renderers draw their respective map layers:
  goo, hazard, ice, rough, and water.

Per-frame visuals:

- `createMarbleView().render()` positions the marble with a transform, updates
  impact squash, dynamic shadow values, glint position, and roll CSS variables.
- `createCameraController().updateFollow()` adjusts the world transform after
  the intro map opens, unless a recent gesture is cooling down.
- `createTrailRenderer().update()` updates the optional fading trail.
- `createEffectsRenderer()` manages short-lived impact/surface effects on a
  bounded canvas that follows the active particle cluster instead of allocating
  a backing store for the entire map.
- `createUi()` updates hints, FPS, and debug stats.

Important rendering rule: terrain should be redrawn only when the active map
changes. The frame loop should mostly touch transforms, CSS variables, small
effect lists, and optional debug text.

## Map Pipeline

Map configuration starts in `maps/map-data.js` and is assembled in
`core/map-config.js`.

The map system supports:

- authored variants
- frozen generated variants
- variant selection by id
- validation in tests/development checks
- derived runtime arrays

Map and dynamic-object starting positions are content details, not stable API.
They may change between releases or generated variants. Tests should assert
that starts are valid and safe unless an exact coordinate is the behavior under
test.

Goal reachability validation is intentionally a grid-sampled estimate. It
rejects clearly blocked layouts and accounts for marble radius, but it is not a
geometric proof that every accepted map is playable. New or substantially
changed layouts still require playtesting.

Key modules:

- `core/map-config.js`: combines map data, base config, defaults, and frozen
  generated variants.
- `core/map-variants.js`: resolves/selects active variants.
- `core/map-validation.js`: validates map shape and required fields.
- `core/map-runtime.js`: owns derived active-map state used by rendering,
  physics, and goal progression.
- `core/map-elements.js`: filters elements by type.
- `core/map-obstacles.js`: snaps and normalizes obstacle rectangles.
- `core/map-bounds.js`: computes intro pen and released-map walls/bounds.

When a goal completes, `core/map-progression.js` selects the next variant,
resolves it into a full map, applies it, resets the marble to the new spawn,
and requests a render. Map validation is kept in tests and development checks,
outside the player-facing progression path.

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

Camera transforms and gestures are handled in `input/camera-controller.js` and
`input/camera-gestures.js`. Pinch zoom is an input/camera concern, not a physics
concern.

## Settings Responsibilities

Settings are split deliberately:

- `settings/settings-config.js`: defaults, persisted keys, and control ranges.
- `settings/settings-store.js`: load, migration, clamping, persistence, and
  filtering runtime-only keys out of saved settings.
- `settings/settings-panel.js`: binds modal controls to settings changes.

The runtime settings object is mutable. `settings/settings-store.js` writes only
schema-owned keys so transient fields cannot leak into localStorage.

## PWA Updates

`sw.js` installs new runtime assets into a versioned cache, calls
`skipWaiting()`, and claims clients after activation. If an existing service
worker already controls the page, `platform/platform.js` reloads once on
`controllerchange` so the new version takes effect immediately. A first-time
installation does not trigger that reload. Update status remains visible in the
settings panel during the handoff. Installations still pending after 30 seconds
report that the update is delayed, and failed installations leave the current
version available instead of displaying a permanent downloading state.

`createPwaInstallController()` captures Chromium's `beforeinstallprompt` event.
The settings install command is visible only while that one-use browser prompt
is available, and it is hidden after prompting or receiving `appinstalled`.

Platform changes require HTTPS device checks in Android Chrome, Android Brave,
iPhone Safari, and iPhone Chrome. The Playwright smoke test covers local desktop
Chrome behavior only.

## Haptics And Feedback

`core/haptics.js` translates gameplay events into vibration requests when
haptics are enabled. `app.js` supplies the platform vibration capability from
`navigator.vibrate`; unsupported browsers supply no capability.

Feedback sources:

- obstacle and wall impacts from `createGameLoop().onImpact()`
- goo, rough, and water surface contact from `createGameLoop().onSurface()`
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
- `mapRuntime.state`: active map, derived terrain and obstacle arrays, and goal
  hold progress. World, spawn, and goal remain properties of the active map.
- `kitchenDynamics.state`: Cheerios, crumbs, ants, collision scratch, and
  per-frame kitchen events. Rendering reads this state but does not advance it.
- `settings`: runtime settings loaded from persisted settings and mutated by
  the settings panel.

For more detail, see `docs/state-ownership.md`.

## Module Responsibility Index

Use this section when deciding where a change belongs.

- `app.js`: composition root. Wires modules together. Avoid putting gameplay
  rules here unless they are orchestration rules.
- `boot.js`: browser entrypoint only.
- `core/copy.js`: user-facing strings.
- `core/debug.js`: debug/stat display formatting.
- `core/dom.js`: required DOM ids and lookup.
- `core/frame-loop.js`: frame scheduling state.
- `core/game-config.js`: numeric tuning for timing, physics, visuals, haptics,
  and general behavior.
- `core/game-lifecycle.js`: start, reset, pause, resume, settings-modal pause.
- `core/game-loop.js`: per-frame orchestration.
- `core/geometry.js`: pure geometry utilities.
- `core/goal-controller.js`: goal hold progress, goal haptics, and map advance.
- `core/haptics.js`: haptic request throttling and gameplay feedback patterns.
- `core/intro-sequence.js`: intro countdown state and pause/resume handling.
- `core/map-bounds.js`: intro pen and released-map bounds/walls.
- `core/map-config.js`: resolved map config and combined variants.
- `core/map-elements.js`: element type filters.
- `core/map-obstacles.js`: obstacle snapping and joining.
- `core/map-progression.js`: next-map selection on completion.
- `core/map-reachability.js`: map playability/reachability helpers.
- `core/map-runtime.js`: active-map derived state and goal progress state.
- `core/map-validation.js`: map schema and validation errors.
- `core/map-variants.js`: variant selection and resolution.
- `core/physics.js`: input smoothing, velocity, drag, substeps, surfaces.
- `core/physics-collisions.js`: wall and obstacle collision resolution.
- `core/rect-bounds.js`: rectangle collection bounds.
- `core/state.js`: initial mutable state shape.
- `input/camera-controller.js` and `input/camera-gestures.js`: camera transform,
  follow behavior, and pinch/pan input.
- `input/*`: browser input binding and input-specific controllers.
- `platform/platform.js`: browser/platform APIs isolated for testing.
- `rendering/*`: visual output only.
- `settings/*`: settings schema, persistence, application, and modal binding.

## Common Change Paths

Add or tune a surface:

1. Add or adjust map element data.
2. Update `core/map-elements.js` if the type is new.
3. Update `core/map-runtime.js` to derive arrays and bounds.
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

1. Start in `core/game-lifecycle.js`.
2. Keep direct browser API calls in `platform/platform.js`.
3. Cover behavior with lifecycle and platform tests.

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

If `index.html` or an asset listed in `runtime-assets.js` changed, run:

```sh
npm run sync-cache
```

Then rerun the full gate. The pre-push hook runs the same checks.
