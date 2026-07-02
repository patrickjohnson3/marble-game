const assetVersion = new URL(import.meta.url).searchParams.get("v") || "dev";
const versioned = (path) => path + "?v=" + encodeURIComponent(assetVersion);
const [
  cameraModule,
  configModule,
  debugModule,
  domModule,
  effectsModule,
  geometryModule,
  hapticsModule,
  introSequenceModule,
  introTimersModule,
  mapModule,
  physicsModule,
  platformModule,
  renderingModule,
  sensorWatchdogModule,
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
  import(versioned("./geometry.js")),
  import(versioned("./haptics.js")),
  import(versioned("./intro-sequence.js")),
  import(versioned("./intro-timers.js")),
  import(versioned("./map.js")),
  import(versioned("./physics.js")),
  import(versioned("./platform.js")),
  import(versioned("./rendering.js")),
  import(versioned("./sensor-watchdog.js")),
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
const { clamp, distance, angle, midpoint } = geometryModule;
const { createHapticsController } = hapticsModule;
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
let frameRendered = false;
const settingsStorageKey = "marbleGameSettings";

const settings = loadSettings({
  storage: localStorage,
  storageKey: settingsStorageKey,
  defaults: settingsConfig,
  controls: settingsControls,
  clamp
});
const ui = createUi({ hint, debug, settingsOverlay, debugLines, state });

function saveSettings() {
  persistSettings({ storage: localStorage, storageKey: settingsStorageKey, settings });
}

applyRangeConfig(speedSetting, settingsControls.maxSpeed);
applyRangeConfig(sensitivitySetting, settingsControls.acceleration);
speedSetting.value = settings.maxSpeed;
sensitivitySetting.value = settings.acceleration;
rotationSetting.checked = settings.rotationEnabled;
hapticsSetting.checked = settings.hapticsEnabled;
trailSetting.checked = settings.trailEnabled;
fullscreenSetting.checked = settings.fullscreenEnabled;

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

function syncMarbleRadius() {
  marble.r = Math.max(marbleEl.offsetWidth, marbleEl.offsetHeight) / 2;
}

function updateMarbleLighting() {
  const light = mapConfig.light;
  const dx = marble.x - light.x;
  const dy = marble.y - light.y;
  const distance = Math.hypot(dx, dy) || 1;
  const worldDiagonal = Math.hypot(world.width, world.height);
  const reach = clamp(distance / worldDiagonal, 0, 1);
  const shadowDistance = light.shadowMinDistance +
    (light.shadowMaxDistance - light.shadowMinDistance) * reach;
  const shadowBlur = light.shadowMinBlur +
    (light.shadowMaxBlur - light.shadowMinBlur) * reach;

  marbleEl.style.setProperty("--marble-shadow-x", (dx / distance * shadowDistance).toFixed(1) + "px");
  marbleEl.style.setProperty("--marble-shadow-y", (dy / distance * shadowDistance).toFixed(1) + "px");
  marbleEl.style.setProperty("--marble-shadow-blur", shadowBlur.toFixed(1) + "px");
  marbleEl.style.setProperty("--marble-contact-shadow-y", light.contactShadowY.toFixed(1) + "px");
  marbleEl.style.setProperty("--marble-contact-shadow-blur", light.contactShadowBlur.toFixed(1) + "px");

  const marbleVisual = visualConfig.marble;
  const glintX = marbleVisual.glintCenter +
    (-dx / distance) * marbleVisual.glintLightOffset +
    clamp(marble.vx * marbleVisual.glintVelocityScale, -marbleVisual.glintVelocityLimit, marbleVisual.glintVelocityLimit);
  const glintY = marbleVisual.glintCenter +
    (-dy / distance) * marbleVisual.glintLightOffset +
    clamp(marble.vy * marbleVisual.glintVelocityScale, -marbleVisual.glintVelocityLimit, marbleVisual.glintVelocityLimit);
  marbleEl.style.setProperty("--marble-glint-x", glintX.toFixed(1) + "px");
  marbleEl.style.setProperty("--marble-glint-y", glintY.toFixed(1) + "px");
  marbleEl.style.setProperty("--marble-roll", marble.roll.toFixed(3) + "rad");
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
  syncMarbleRadius();
  if (!intro.released) updateIntroBounds();
  marble.x = clamp(marble.x, bounds.left + marble.r, bounds.right - marble.r);
  marble.y = clamp(marble.y, bounds.top + marble.r, bounds.bottom - marble.r);
  if (!intro.released) cameraController.centerOnMarble();
  else cameraController.applyTransform();
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
  if (!shouldPauseGame(game)) return;

  game.paused = true;
  keyboard.x = 0;
  keyboard.y = 0;
  cameraController.resetGesture();
  sensorWatchdog.pause();
  introSequence.pause();
}

function resumeGame() {
  if (!game.paused) return;

  game.paused = false;
  lastFrame = performance.now();
  sensorWatchdog.resume(() => game.phase === "calibrating" && sensor.using === "none");
  introSequence.resume();
}

function resetGameState() {
  sensorWatchdog.reset();
  introSequence.clearTimers();
  resetCalibration();

  game.phase = "waiting";
  game.paused = false;
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
  frameRendered = false;

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

const inputSystems = {
  motion: {
    enabled: false,
    enable() {
      if (this.enabled) return;
      this.enabled = true;
      addEventListener("deviceorientation", onOrientation, true);
      addEventListener("devicemotion", onMotion, true);
    }
  },
  keyboard: {
    enable() {
      addEventListener("keydown", onKeyDown, { passive:false });
      addEventListener("keyup", onKeyUp);
    }
  },
  gestures: {
    enable() {
      gameEl.addEventListener("pointerdown", cameraController.onPointerDown);
      gameEl.addEventListener("pointermove", cameraController.onPointerMove);
      gameEl.addEventListener("pointerup", cameraController.onPointerEnd);
      gameEl.addEventListener("pointercancel", cameraController.onPointerEnd);
    }
  }
};

async function start() {
  startBtn.disabled = true;
  controlsEl.hidden = true;

  const fullscreenRequest = requestFullscreenMode({ fullscreenOnStart: settings.fullscreenEnabled });

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
  inputSystems.motion.enable();
  game.phase = "calibrating";

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

  requestFullscreenMode({ fullscreenOnStart: settings.fullscreenEnabled });
}

function openSettings() {
  gameController.pause();
  ui.openSettingsModal();
}

function closeSettingsModal() {
  ui.closeSettingsModal();
  gameController.resume();
}

const gameController = {
  start,
  reset: resetGameState,
  pause: pauseGame,
  resume: resumeGame,
  openSettings,
  closeSettings: closeSettingsModal,
  tick: loop
};

startBtn.addEventListener("pointerdown", requestStartFullscreen);
startBtn.addEventListener("click", gameController.start);
neutralBtn.addEventListener("click", setNeutralNow);
settingsToggle.addEventListener("click", gameController.openSettings);
closeSettings.addEventListener("click", gameController.closeSettings);
resumeBtn.addEventListener("click", gameController.closeSettings);
speedSetting.addEventListener("input", () => {
  settings.maxSpeed = Number(speedSetting.value);
  applySettings();
  saveSettings();
});
sensitivitySetting.addEventListener("input", () => {
  settings.acceleration = Number(sensitivitySetting.value);
  applySettings();
  saveSettings();
});
rotationSetting.addEventListener("change", () => {
  settings.rotationEnabled = rotationSetting.checked;
  applySettings();
  saveSettings();
  if (!settings.rotationEnabled) {
    camera.rotation = 0;
    cameraController.centerOnMarble();
  }
});
hapticsSetting.addEventListener("change", () => {
  settings.hapticsEnabled = hapticsSetting.checked;
  applySettings();
  saveSettings();
});
trailSetting.addEventListener("change", () => {
  settings.trailEnabled = trailSetting.checked;
  applySettings();
  saveSettings();
});
fullscreenSetting.addEventListener("change", () => {
  settings.fullscreenEnabled = fullscreenSetting.checked;
  saveSettings();
  applyFullscreenSetting();
});
settingsOverlay.addEventListener("click", (e) => {
  if (e.target === settingsOverlay) gameController.closeSettings();
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
  const now = performance.now();
  const dt = clamp(
    (now - lastFrame) / timing.targetFrameMs,
    timing.minFrameStep,
    timing.maxFrameStep
  );
  lastFrame = now;
  const active = game.phase !== "waiting" && !game.paused;

  if (!active && frameRendered) {
    ui.updateDebugPanel();
    requestAnimationFrame(gameController.tick);
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

  marbleEl.style.left = marble.x + "px";
  marbleEl.style.top = marble.y + "px";
  marbleEl.style.setProperty("--marble-scale-x", (1 + marble.impactSquash * visualConfig.marble.impactScaleX).toFixed(3));
  marbleEl.style.setProperty("--marble-scale-y", (1 - marble.impactSquash * visualConfig.marble.impactScaleY).toFixed(3));
  updateMarbleLighting();
  updateRoughPatchFeedback();
  if (!game.paused) trailRenderer.update(now);
  ui.updateDebugPanel();
  frameRendered = true;

  requestAnimationFrame(gameController.tick);
}

try {
  setupMap();
  applySettings();
  syncMarbleRadius();
  cameraController.centerOnMarble();
  inputSystems.keyboard.enable();
  inputSystems.gestures.enable();
  gameController.tick();
} catch (error) {
  showBootError(error);
  throw error;
}
