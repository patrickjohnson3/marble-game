const assetVersion = new URL(import.meta.url).searchParams.get("v") || "dev";
const versioned = (path) => path + "?v=" + encodeURIComponent(assetVersion);
const [
  cameraModule,
  configModule,
  debugModule,
  domModule,
  effectsModule,
  frameLoopModule,
  gameControllerModule,
  geometryModule,
  hapticsModule,
  inputManagerModule,
  introSequenceModule,
  introTimersModule,
  mapModule,
  marbleViewModule,
  physicsModule,
  platformModule,
  renderingModule,
  sensorWatchdogModule,
  settingsPanelModule,
  settingsStoreModule,
  stateModule,
  trailModule,
  uiModule
] = await Promise.all([
  import(versioned("./camera.js")),
  import(versioned("./config.js")),
  import(versioned("./debug.js")),
  import(versioned("./dom.js")),
  import(versioned("./effects.js")),
  import(versioned("./frame-loop.js")),
  import(versioned("./game-controller.js")),
  import(versioned("./geometry.js")),
  import(versioned("./haptics.js")),
  import(versioned("./input-manager.js")),
  import(versioned("./intro-sequence.js")),
  import(versioned("./intro-timers.js")),
  import(versioned("./map.js")),
  import(versioned("./marble-view.js")),
  import(versioned("./physics.js")),
  import(versioned("./platform.js")),
  import(versioned("./rendering.js")),
  import(versioned("./sensor-watchdog.js")),
  import(versioned("./settings-panel.js")),
  import(versioned("./settings-store.js")),
  import(versioned("./state.js")),
  import(versioned("./trail.js")),
  import(versioned("./ui.js"))
]).catch((error) => {
  showBootError(error);
  throw error;
});

const {
  mapConfig,
  timing,
  tuning,
  hapticTuning,
  visualConfig,
  physicsConfig,
  settingsConfig,
  settingsControls
} = configModule;
const { createCameraController } = cameraModule;
const { debugLines } = debugModule;
const { els } = domModule;
const { createEffectsRenderer } = effectsModule;
const { createFrameLoop } = frameLoopModule;
const { createGameController } = gameControllerModule;
const { clamp, distance, angle, midpoint } = geometryModule;
const { createHapticsController } = hapticsModule;
const { createInputManager } = inputManagerModule;
const { createIntroSequence } = introSequenceModule;
const {
  resetIntroTimerState,
  shouldPauseGame
} = introTimersModule;
const {
  introPenWalls,
  mapEdgeWalls,
  setReleasedBounds: setReleasedMapBounds,
  updateIntroBounds: updateIntroMapBounds
} = mapModule;
const { createMarbleView } = marbleViewModule;
const { marbleOverRect, updatePhysicsInput, updatePhysics } = physicsModule;
const {
  requestFullscreenMode,
  exitFullscreenMode,
  requestWakeLock,
  requestMotionPermissionIfNeeded,
  screenAdjusted
} = platformModule;
const { renderMapElements, renderWalls } = renderingModule;
const { createSensorWatchdog } = sensorWatchdogModule;
const { bindSettingsPanel } = settingsPanelModule;
const {
  applyRangeConfig,
  loadSettings,
  saveSettings: persistSettings
} = settingsStoreModule;
const { createGameState } = stateModule;
const { createTrailRenderer } = trailModule;
const { createUi } = uiModule;

function showBootError(error) {
  const hintEl = document.getElementById("hint");
  if (hintEl) {
    hintEl.textContent = "game failed to load. refresh and try again.";
  }
  console.error(error);
}

const {
  game: gameEl,
  world: worldEl,
  introWalls: introWallsEl,
  mapWalls: mapWallsEl,
  roughPatches: roughPatchesEl,
  obstacles: obstaclesEl,
  trail: trailEl,
  trailSegments: trailSegmentsEl,
  effects: effectsEl,
  marble: marbleEl,
  messageOverlay,
  controls: controlsEl,
  startBtn,
  neutralBtn,
  settingsToggle,
  settingsOverlay,
  closeSettings,
  resumeGame: resumeBtn,
  speedSetting,
  sensitivitySetting,
  rotationSetting,
  hapticsSetting,
  trailSetting,
  fullscreenSetting,
  hint,
  debug
} = els;

const world = mapConfig.world;
const mapElements = mapConfig.elements;
const obstacles = mapElements.filter((element) => element.type === "obstacle");
const roughPatches = mapElements.filter((element) => element.type === "roughPatch");

const state = createGameState({ world, mapConfig, timing, hapticTuning, physicsConfig });
const {
  marble,
  bounds,
  intro,
  tilt,
  keyboard,
  camera,
  haptics,
  calibration,
  sensor,
  game,
  physics
} = state;

let lastFrame = performance.now();
let settingsPausedGame = false;
let pendingStartFullscreenRequest = null;
const settingsStorageKey = "marbleGameSettings";

const settings = loadSettings({
  storage: localStorage,
  storageKey: settingsStorageKey,
  defaults: settingsConfig,
  controls: settingsControls,
  clamp
});
const ui = createUi({ hint, debug, settingsOverlay, debugLines, state });
const frameLoop = createFrameLoop();

function saveSettings() {
  persistSettings({ storage: localStorage, storageKey: settingsStorageKey, settings });
}

function scheduleFrame() {
  frameLoop.schedule();
}

function requestRender() {
  frameLoop.requestRender();
}

function applySettings() {
  physics.maxSpeed = settings.maxSpeed;
  physics.accel = settings.acceleration;
  camera.rotationEnabled = settings.rotationEnabled;
  haptics.enabled = settings.hapticsEnabled;
  trailRenderer.setEnabled(settings.trailEnabled);
}

function applyFullscreenSetting() {
  if (settings.fullscreenEnabled) {
    requestFullscreenMode({ fullscreenOnStart: true });
  } else {
    exitFullscreenMode();
  }
}

const hapticFeedback = createHapticsController(haptics, hapticTuning);
const cameraController = createCameraController({
  camera,
  cameraEl: worldEl,
  game,
  intro,
  marble,
  tuning,
  clamp,
  distance,
  angle,
  midpoint,
  viewport: {
    width: () => innerWidth,
    height: () => innerHeight
  }
});
const trailRenderer = createTrailRenderer({
  trailEl,
  trailSegmentsEl,
  marble,
  game,
  settings,
  config: visualConfig.trail,
  clamp
});
const effectsRenderer = createEffectsRenderer({
  effectsEl,
  marble,
  config: visualConfig.effects,
  clamp
});
const marbleView = createMarbleView({
  marbleEl,
  marble,
  world,
  mapConfig,
  visualConfig,
  clamp
});

function keepDisplayAwakeWhenVisible() {
  if (document.visibilityState === "visible" && game.phase !== "waiting") {
    requestWakeLock();
  }
}

function renderObstacles() {
  renderMapElements(obstaclesEl, "obstacle", obstacles);
}

function renderRoughPatches() {
  renderMapElements(roughPatchesEl, "roughPatch", roughPatches);
}

function updateRoughPatchFeedback() {
  const patchEls = roughPatchesEl.children;
  roughPatches.forEach((patch, index) => {
    patchEls[index]?.classList.toggle(
      "active",
      intro.released && marbleOverRect(marble, patch)
    );
  });
}

function updateIntroBounds() {
  updateIntroMapBounds({
    bounds,
    intro,
    marble,
    viewport: { width: innerWidth, height: innerHeight },
    world
  });
  renderWalls(introWallsEl, introPenWalls(bounds, intro));
}

function setReleasedBounds() {
  setReleasedMapBounds(bounds, world);
}

function setupMap() {
  worldEl.style.width = world.width + "px";
  worldEl.style.height = world.height + "px";
  trailEl.setAttribute("viewBox", "0 0 " + world.width + " " + world.height);
  setReleasedBounds();
  renderWalls(mapWallsEl, mapEdgeWalls(world, intro));
  renderRoughPatches();
  renderObstacles();
  updateIntroBounds();
}

function resize() {
  marbleView.syncRadius();
  if (!intro.released) updateIntroBounds();
  marble.x = clamp(marble.x, bounds.left + marble.r, bounds.right - marble.r);
  marble.y = clamp(marble.y, bounds.top + marble.r, bounds.bottom - marble.r);
  if (!intro.released) cameraController.centerOnMarble();
  else cameraController.applyTransform();
  requestRender();
}
addEventListener("resize", resize);
document.addEventListener("visibilitychange", keepDisplayAwakeWhenVisible);

function releaseMap() {
  intro.released = true;
  intro.sequenceStage = "idle";
  introWallsEl.replaceChildren();
  worldEl.classList.add("map-open");
  setReleasedBounds();
  introSequence.hideMessage();
  ui.setHint("map open. pinch to zoom and explore.");
}

const introSequence = createIntroSequence({
  intro,
  game,
  timing,
  messageOverlay,
  onRelease: releaseMap
});
const sensorWatchdog = createSensorWatchdog({
  delayMs: timing.sensorFallbackMs,
  game,
  sensor,
  onFallback() {
    ui.setHint("no motion sensor yet. use arrows/WASD here, or try HTTPS on your phone.");
    sensor.using = "keyboard";
    game.phase = "keyboard";
    tilt.neutralX = 0;
    tilt.neutralY = 0;
    calibration.autoNeutralDone = true;
    introSequence.schedule();
    scheduleFrame();
  }
});

function maybeAutoNeutral() {
  if (game.paused) return;
  if (calibration.autoNeutralDone) return;

  calibration.sampleX += tilt.rawX;
  calibration.sampleY += tilt.rawY;
  calibration.sampleCount++;

  // first few frames become the user's normal holding posture.
  // not table-flat. not lab-instrument nonsense.
  if (calibration.sampleCount >= tuning.neutralSampleCount) {
    tilt.neutralX = calibration.sampleX / calibration.sampleCount;
    tilt.neutralY = calibration.sampleY / calibration.sampleCount;
    calibration.autoNeutralDone = true;
    game.phase = "running";
    marble.vx = 0; marble.vy = 0;
    ui.setHint("neutral set. tilt from your normal holding angle.");
    introSequence.schedule();
  }
}

function onOrientation(e) {
  if (e.beta == null || e.gamma == null) return;
  sensor.gotOrientation = true;
  sensor.using = "deviceorientation";
  const [tx, ty] = screenAdjusted(e.gamma, e.beta);
  tilt.rawX = tx;
  tilt.rawY = ty;
  maybeAutoNeutral();
}

function onMotion(e) {
  if (sensor.gotOrientation) return;
  const g = e.accelerationIncludingGravity;
  if (!g) return;
  sensor.gotMotion = true;
  sensor.using = "devicemotion fallback";
  tilt.rawX = -(g.x || 0) * tuning.motionGravityScale;
  tilt.rawY = (g.y || 0) * tuning.motionGravityScale;
  maybeAutoNeutral();
}

function resetCalibration() {
  calibration.sampleCount = 0;
  calibration.sampleX = 0;
  calibration.sampleY = 0;
  calibration.autoNeutralDone = false;
  tilt.neutralX = null;
  tilt.neutralY = null;
}

function pauseGame() {
  if (!shouldPauseGame(game)) return false;

  game.paused = true;
  keyboard.x = 0;
  keyboard.y = 0;
  cameraController.resetGesture();
  sensorWatchdog.pause();
  introSequence.pause();
  return true;
}

function resumeGame() {
  if (!game.paused) return;

  game.paused = false;
  lastFrame = performance.now();
  sensorWatchdog.resume(() => game.phase === "calibrating" && sensor.using === "none");
  introSequence.resume();
  scheduleFrame();
}

function resetGameState() {
  sensorWatchdog.reset();
  introSequence.clearTimers();
  resetCalibration();

  game.phase = "waiting";
  game.paused = false;
  settingsPausedGame = false;
  pendingStartFullscreenRequest = null;
  sensor.gotOrientation = false;
  sensor.gotMotion = false;
  sensor.using = "none";

  intro.started = false;
  intro.released = false;
  intro.countdownValue = timing.countdownStart;
  resetIntroTimerState(intro);

  keyboard.x = 0;
  keyboard.y = 0;
  tilt.rawX = 0;
  tilt.rawY = 0;
  tilt.smoothX = 0;
  tilt.smoothY = 0;

  marble.x = world.width / 2;
  marble.y = world.height / 2;
  marble.vx = 0;
  marble.vy = 0;
  marble.roll = 0;
  marble.impactSquash = 0;

  camera.x = 0;
  camera.y = 0;
  camera.scale = 1;
  camera.rotation = 0;
  camera.gestureCooldown = 0;
  cameraController.resetGesture();

  haptics.impact.lastPulse = 0;
  haptics.surface.lastPulse = 0;
  trailRenderer.clear();
  effectsRenderer.clear();
  frameLoop.requestRender();

  worldEl.classList.remove("map-open");
  controlsEl.hidden = false;
  startBtn.textContent = "start";
  startBtn.disabled = false;
  introSequence.hideMessage();
  setReleasedBounds();
  updateIntroBounds();
  cameraController.centerOnMarble();
}

function onKeyDown(e) {
  const k = e.key.toLowerCase();
  if (game.paused) return;

  if (k === "arrowleft" || k === "a") keyboard.x = -1;
  if (k === "arrowright" || k === "d") keyboard.x = 1;
  if (k === "arrowup" || k === "w") keyboard.y = -1;
  if (k === "arrowdown" || k === "s") keyboard.y = 1;
  if (["arrowleft","arrowright","arrowup","arrowdown","a","d","w","s"].includes(k)) {
    e.preventDefault();
    sensor.using = sensor.using === "none" ? "keyboard" : sensor.using;
    if (game.phase === "waiting" || game.phase === "calibrating") {
      game.phase = "keyboard";
      tilt.neutralX = 0;
      tilt.neutralY = 0;
      calibration.autoNeutralDone = true;
      introSequence.schedule();
      scheduleFrame();
    }
  }
}

function onKeyUp(e) {
  const k = e.key.toLowerCase();
  if (k === "escape") gameController.closeSettings();
  if (game.paused) return;

  if ((k === "arrowleft" || k === "a") && keyboard.x < 0) keyboard.x = 0;
  if ((k === "arrowright" || k === "d") && keyboard.x > 0) keyboard.x = 0;
  if ((k === "arrowup" || k === "w") && keyboard.y < 0) keyboard.y = 0;
  if ((k === "arrowdown" || k === "s") && keyboard.y > 0) keyboard.y = 0;
}

async function start() {
  startBtn.disabled = true;
  controlsEl.hidden = true;

  const fullscreenRequest = pendingStartFullscreenRequest ||
    requestFullscreenMode({ fullscreenOnStart: settings.fullscreenEnabled });
  pendingStartFullscreenRequest = null;

  const ok = await requestMotionPermissionIfNeeded();
  if (!ok) {
    await fullscreenRequest;
    if (settings.fullscreenEnabled) exitFullscreenMode();
    controlsEl.hidden = false;
    startBtn.disabled = false;
    ui.setHint("motion permission denied. check chrome site settings.");
    return;
  }

  requestWakeLock();
  gameController.reset();
  controlsEl.hidden = true;
  startBtn.disabled = true;
  inputManager.enableMotion();
  game.phase = "calibrating";
  scheduleFrame();

  ui.setHint("keep holding normally for half a sec...");

  sensorWatchdog.schedule();
}

function setNeutralNow() {
  tilt.neutralX = tilt.rawX;
  tilt.neutralY = tilt.rawY;
  calibration.autoNeutralDone = true;
  if (game.phase === "calibrating") game.phase = "running";
  calibration.sampleCount = tuning.neutralSampleCount;
  marble.vx = 0; marble.vy = 0;
  tilt.smoothX = 0; tilt.smoothY = 0;
  ui.setHint("neutral reset to current hand position.");
}

function requestStartFullscreen() {
  if (startBtn.disabled || game.phase !== "waiting") return;

  pendingStartFullscreenRequest = requestFullscreenMode({ fullscreenOnStart: settings.fullscreenEnabled });
}

function openSettings() {
  if (ui.isSettingsOpen()) return;

  settingsPausedGame = gameController.pause();
  ui.openSettingsModal();
}

function closeSettingsModal() {
  ui.closeSettingsModal();
  if (settingsPausedGame) {
    settingsPausedGame = false;
    gameController.resume();
  }
}

const gameController = createGameController({
  start,
  reset: resetGameState,
  pause: pauseGame,
  resume: resumeGame,
  openSettings,
  closeSettings: closeSettingsModal,
  tick: loop
});
frameLoop.setTick(gameController.tick);
const inputManager = createInputManager({
  gameEl,
  startBtn,
  onOrientation,
  onMotion,
  onKeyDown,
  onKeyUp,
  onPointerDown: cameraController.onPointerDown,
  onPointerMove: cameraController.onPointerMove,
  onPointerEnd: cameraController.onPointerEnd,
  onStartPointerDown: requestStartFullscreen,
  onStartClick: gameController.start
});

bindSettingsPanel({
  els,
  settings,
  controls: settingsControls,
  applyRangeConfig,
  applySettings,
  applyFullscreenSetting,
  saveSettings,
  onOpenSettings: gameController.openSettings,
  onCloseSettings: gameController.closeSettings,
  onSetNeutral: setNeutralNow,
  onRotationDisabled() {
    camera.rotation = 0;
    cameraController.centerOnMarble();
  },
  requestRender
});

function physicsContext() {
  return {
    marble,
    bounds,
    intro,
    tilt,
    keyboard,
    camera,
    physics,
    obstacles,
    roughPatches
  };
}

function loop() {
  frameLoop.beginFrame();
  const now = performance.now();
  const dt = clamp(
    (now - lastFrame) / timing.targetFrameMs,
    timing.minFrameStep,
    timing.maxFrameStep
  );
  lastFrame = now;
  const active = game.phase !== "waiting" && !game.paused;

  if (frameLoop.shouldSkipIdle(active)) {
    ui.updateDebugPanel();
    return;
  }

  if (active) {
    const context = physicsContext();
    updatePhysicsInput(context, dt);
    updatePhysics(context, dt, {
      onImpact: (impact) => {
        marble.impactSquash = Math.max(
          marble.impactSquash,
          clamp(impact / visualConfig.marble.impactSquashDivisor, 0, 1)
        );
        effectsRenderer.spawnImpact(impact);
        hapticFeedback.pulseImpact(impact);
      },
      onSurface: (speed) => {
        effectsRenderer.spawnSurface(speed, now);
        hapticFeedback.pulseSurface(speed);
      }
    });
    marble.roll += Math.hypot(marble.vx, marble.vy) * dt / Math.max(marble.r, 1);
    marble.impactSquash = Math.max(0, marble.impactSquash - visualConfig.marble.impactSquashDecay * dt);
    cameraController.updateFollow(dt);
  }

  marbleView.render();
  updateRoughPatchFeedback();
  if (!game.paused) trailRenderer.update(now);
  ui.updateDebugPanel();
  frameLoop.markRendered();

  if (active) scheduleFrame();
}

try {
  setupMap();
  applySettings();
  marbleView.syncRadius();
  cameraController.centerOnMarble();
  inputManager.bindStartButton();
  inputManager.enableKeyboard();
  inputManager.enableGestures();
  requestRender();
} catch (error) {
  showBootError(error);
  throw error;
}
