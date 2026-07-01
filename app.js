const assetVersion = new URL(import.meta.url).searchParams.get("v") || "dev";
const versioned = (path) => path + "?v=" + encodeURIComponent(assetVersion);
const [
  configModule,
  debugModule,
  domModule,
  geometryModule,
  hapticsModule,
  introTimersModule,
  mapModule,
  physicsModule,
  platformModule,
  renderingModule,
  settingsStoreModule,
  stateModule
] = await Promise.all([
  import(versioned("./config.js")),
  import(versioned("./debug.js")),
  import(versioned("./dom.js")),
  import(versioned("./geometry.js")),
  import(versioned("./haptics.js")),
  import(versioned("./intro-timers.js")),
  import(versioned("./map.js")),
  import(versioned("./physics.js")),
  import(versioned("./platform.js")),
  import(versioned("./rendering.js")),
  import(versioned("./settings-store.js")),
  import(versioned("./state.js"))
]).catch((error) => {
  showBootError(error);
  throw error;
});

const {
  mapConfig,
  timing,
  tuning,
  hapticTuning,
  physicsConfig,
  settingsConfig,
  settingsControls
} = configModule;
const { debugLines } = debugModule;
const { els } = domModule;
const { clamp, distance, angle, midpoint } = geometryModule;
const { createHapticsController } = hapticsModule;
const {
  pauseIntroTimerState,
  resetIntroTimerState,
  resumeIntroTimerAction,
  shouldPauseGame,
  trackIntroTimer
} = introTimersModule;
const {
  introPenWalls,
  mapEdgeWalls,
  setReleasedBounds: setReleasedMapBounds,
  updateIntroBounds: updateIntroMapBounds
} = mapModule;
const { updatePhysicsInput, updatePhysics } = physicsModule;
const {
  requestFullscreenMode,
  exitFullscreenMode,
  requestWakeLock,
  requestMotionPermissionIfNeeded,
  screenAdjusted
} = platformModule;
const { renderMapElements, renderWalls } = renderingModule;
const {
  applyRangeConfig,
  loadSettings,
  saveSettings: persistSettings
} = settingsStoreModule;
const { createGameState } = stateModule;

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
  marble: marbleEl,
  messageOverlay,
  controls: controlsEl,
  startBtn,
  neutralBtn,
  settingsToggle,
  settingsOverlay,
  closeSettings,
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

const pointers = new Map();
let gesture = null;
let lastFrame = performance.now();
let sensorWatchdog = 0;
let sensorWatchdogStartedAt = 0;
let sensorWatchdogDelayMs = 0;
const trailPoints = [];
const trailDurationMs = 2500;
const trailMinDistance = 3;
const trailMinIntervalMs = 50;
const svgNamespace = "http://www.w3.org/2000/svg";
const settingsStorageKey = "marbleGameSettings";

const settings = loadSettings({
  storage: localStorage,
  storageKey: settingsStorageKey,
  defaults: settingsConfig,
  controls: settingsControls,
  clamp
});

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

function setHint(message) { hint.textContent = message; }
function isSettingsOpen() { return settingsOverlay.classList.contains("open"); }

function applySettings() {
  physics.maxSpeed = settings.maxSpeed;
  physics.accel = settings.acceleration;
  camera.rotationEnabled = settings.rotationEnabled;
  haptics.enabled = settings.hapticsEnabled;
  trailEl.hidden = !settings.trailEnabled;
  if (!settings.trailEnabled) clearTrail();
}

function applyFullscreenSetting() {
  if (settings.fullscreenEnabled) {
    requestFullscreenMode({ fullscreenOnStart: true });
  } else {
    exitFullscreenMode();
  }
}

const hapticFeedback = createHapticsController(haptics, hapticTuning);

function keepDisplayAwakeWhenVisible() {
  if (document.visibilityState === "visible" && game.phase !== "waiting") {
    requestWakeLock();
  }
}

function runSensorWatchdog() {
  sensorWatchdog = 0;
  sensorWatchdogStartedAt = 0;
  sensorWatchdogDelayMs = 0;
  if (game.paused) return;

  if (sensor.using === "none") {
    setHint("no motion sensor yet. use arrows/WASD here, or try HTTPS on your phone.");
    sensor.using = "keyboard";
    game.phase = "keyboard";
    tilt.neutralX = 0;
    tilt.neutralY = 0;
    calibration.autoNeutralDone = true;
    scheduleIntroSequence();
  }
}

function scheduleSensorWatchdog(delay = timing.sensorFallbackMs) {
  clearTimeout(sensorWatchdog);
  sensorWatchdogStartedAt = performance.now();
  sensorWatchdogDelayMs = delay;
  sensorWatchdog = setTimeout(runSensorWatchdog, delay);
}

function pauseSensorWatchdog() {
  if (!sensorWatchdog) return;

  const elapsed = performance.now() - sensorWatchdogStartedAt;
  sensorWatchdogDelayMs = Math.max(0, sensorWatchdogDelayMs - elapsed);
  clearTimeout(sensorWatchdog);
  sensorWatchdog = 0;
}

function resumeSensorWatchdog() {
  if (game.phase !== "calibrating" || sensor.using !== "none" || sensorWatchdog) return;

  scheduleSensorWatchdog(Math.max(0, sensorWatchdogDelayMs));
}

function updateDebugPanel() {
  if (!isSettingsOpen()) return;

  debug.textContent = debugLines(state).join("\n");
}

function renderObstacles() {
  renderMapElements(obstaclesEl, "obstacle", obstacles);
}

function renderRoughPatches() {
  renderMapElements(roughPatchesEl, "roughPatch", roughPatches);
}

function clearTrail() {
  trailPoints.length = 0;
  if (trailSegmentsEl.childNodes.length > 0) trailSegmentsEl.replaceChildren();
}

function updateTrail(now) {
  if (!settings.trailEnabled || game.phase === "waiting") {
    clearTrail();
    return;
  }

  const last = trailPoints[trailPoints.length - 1];
  const movedEnough = !last || Math.hypot(marble.x - last.x, marble.y - last.y) >= trailMinDistance;
  const waitedEnough = !last || now - last.t >= trailMinIntervalMs;

  if (movedEnough && waitedEnough) {
    trailPoints.push({ x: marble.x, y: marble.y, t: now });
  }

  const oldest = now - trailDurationMs;
  while (trailPoints.length > 0 && trailPoints[0].t < oldest) {
    trailPoints.shift();
  }

  if (trailPoints.length < 2) {
    trailSegmentsEl.replaceChildren();
    return;
  }

  const segments = [];
  for (let i = 1; i < trailPoints.length; i++) {
    const a = trailPoints[i - 1];
    const b = trailPoints[i];
    const opacity = clamp(1 - (now - b.t) / trailDurationMs, 0, 1) * 0.5;
    const segment = document.createElementNS(svgNamespace, "line");
    segment.setAttribute("x1", a.x.toFixed(1));
    segment.setAttribute("y1", a.y.toFixed(1));
    segment.setAttribute("x2", b.x.toFixed(1));
    segment.setAttribute("y2", b.y.toFixed(1));
    segment.setAttribute("opacity", opacity.toFixed(3));
    segments.push(segment);
  }
  trailSegmentsEl.replaceChildren(...segments);
}

function showMessage(message) {
  messageOverlay.textContent = message;
  messageOverlay.classList.add("show");
}

function hideMessage() {
  messageOverlay.classList.remove("show");
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

  const glintX = 29 + (-dx / distance) * 11 + clamp(marble.vx * 0.08, -1.5, 1.5);
  const glintY = 29 + (-dy / distance) * 11 + clamp(marble.vy * 0.08, -1.5, 1.5);
  marbleEl.style.setProperty("--marble-glint-x", glintX.toFixed(1) + "px");
  marbleEl.style.setProperty("--marble-glint-y", glintY.toFixed(1) + "px");
  marbleEl.style.setProperty("--marble-roll", marble.roll.toFixed(3) + "rad");
}

function centerCameraOnMarble() {
  const transformed = transformedWorldPoint(marble.x, marble.y);
  camera.x = innerWidth / 2 - transformed.x;
  camera.y = innerHeight / 2 - transformed.y;
  applyCameraTransform();
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
  if (!intro.released) centerCameraOnMarble();
  else applyCameraTransform();
}
addEventListener("resize", resize);
document.addEventListener("visibilitychange", keepDisplayAwakeWhenVisible);

function applyCameraTransform() {
  worldEl.style.transform =
    "translate(" + camera.x + "px, " + camera.y + "px) " +
    "scale(" + camera.scale + ") " +
    "rotate(" + camera.rotation + "rad)";
}

function transformedWorldPoint(x, y) {
  const c = Math.cos(camera.rotation);
  const s = Math.sin(camera.rotation);

  return {
    x: (x * c - y * s) * camera.scale,
    y: (x * s + y * c) * camera.scale
  };
}

function updateCameraFollow(dt) {
  if (!intro.released) return;

  camera.gestureCooldown = Math.max(0, camera.gestureCooldown - dt);
  if (camera.gestureCooldown > 0) return;

  const transformed = transformedWorldPoint(marble.x, marble.y);
  const targetX = innerWidth / 2 - transformed.x;
  const targetY = innerHeight / 2 - transformed.y;
  const followStep = 1 - Math.pow(1 - camera.followLag, dt);

  camera.x += (targetX - camera.x) * followStep;
  camera.y += (targetY - camera.y) * followStep;
  applyCameraTransform();
}

function pointerPoint(e) {
  return { x: e.clientX, y: e.clientY };
}

function getGesturePoints() {
  return Array.from(pointers.values()).slice(0, 2);
}

function startGesture() {
  const [a, b] = getGesturePoints();
  if (!a || !b) return;

  gesture = {
    distance: Math.max(distance(a, b), 1),
    angle: angle(a, b),
    midpoint: midpoint(a, b),
    x: camera.x,
    y: camera.y,
    scale: camera.scale,
    rotation: camera.rotation
  };
}

function updateGesture() {
  if (!gesture || pointers.size < 2) return;

  const [a, b] = getGesturePoints();
  const nextMidpoint = midpoint(a, b);
  camera.scale = clamp(
    gesture.scale * (distance(a, b) / gesture.distance),
    camera.minScale,
    camera.maxScale
  );
  camera.rotation = camera.rotationEnabled
    ? gesture.rotation + angle(a, b) - gesture.angle
    : 0;
  if (!intro.released) {
    centerCameraOnMarble();
    return;
  }

  camera.x = gesture.x + nextMidpoint.x - gesture.midpoint.x;
  camera.y = gesture.y + nextMidpoint.y - gesture.midpoint.y;
  camera.gestureCooldown = tuning.gestureCooldownFrames;
  applyCameraTransform();
}

function onPointerDown(e) {
  if (game.paused) return;

  pointers.set(e.pointerId, pointerPoint(e));
  if (gameEl.setPointerCapture) {
    try {
      gameEl.setPointerCapture(e.pointerId);
    } catch {
      // Losing capture is acceptable; pointercancel/up will still clear state.
    }
  }
  if (pointers.size === 2) startGesture();
}

function onPointerMove(e) {
  if (game.paused) return;
  if (!pointers.has(e.pointerId)) return;

  pointers.set(e.pointerId, pointerPoint(e));
  updateGesture();
}

function onPointerEnd(e) {
  pointers.delete(e.pointerId);
  gesture = null;
  if (pointers.size === 2) startGesture();
}

function setIntroTimer(stage, delay, callback) {
  clearIntroTimers();
  trackIntroTimer(intro, stage, delay, performance.now());
  intro.messageTimer = setTimeout(callback, delay);
}

function scheduleCountdownTick(delay = timing.countdownTickMs) {
  clearIntroTimers();
  trackIntroTimer(intro, "countdown", delay, performance.now());
  intro.countdownTimer = setTimeout(() => {
    if (game.paused) return;

    intro.countdownValue--;
    if (intro.countdownValue <= 0) {
      intro.countdownTimer = 0;
      intro.sequenceStage = "idle";
      releaseMap();
      return;
    }

    showCountdown();
    scheduleCountdownTick();
  }, delay);
}

function showIntroPrompt() {
  showMessage("Pinch to zoom out. Reverse pinch to zoom in. Rotation is available in settings.");
  setIntroTimer("countdownWait", timing.countdownDelayMs, startReleaseCountdown);
}

function scheduleIntroSequence() {
  if (intro.started) return;

  intro.started = true;
  setIntroTimer("promptWait", timing.introPromptDelayMs, showIntroPrompt);
}

function startReleaseCountdown() {
  clearIntroTimers();
  intro.sequenceStage = "countdown";
  intro.countdownValue = timing.countdownStart;
  showCountdown();
  scheduleCountdownTick();
}

function showCountdown() {
  const countdown = document.createElement("span");
  countdown.className = "countdown";
  countdown.textContent = intro.countdownValue;
  messageOverlay.replaceChildren("Ready?", countdown);
  messageOverlay.classList.add("show");
}

function releaseMap() {
  intro.released = true;
  intro.sequenceStage = "idle";
  introWallsEl.innerHTML = "";
  worldEl.classList.add("map-open");
  setReleasedBounds();
  hideMessage();
  setHint("map open. pinch to zoom and explore.");
}

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
    setHint("neutral set. tilt from your normal holding angle.");
    scheduleIntroSequence();
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

function clearIntroTimers() {
  clearTimeout(intro.messageTimer);
  clearTimeout(intro.countdownTimer);
  intro.messageTimer = 0;
  intro.countdownTimer = 0;
}

function pauseIntroTimers() {
  const hadActiveTimer = pauseIntroTimerState(intro, performance.now());
  if (!hadActiveTimer) return;

  clearIntroTimers();
}

function resumeIntroTimers() {
  const delay = Math.max(0, intro.timerDelayMs);
  const action = resumeIntroTimerAction(intro);
  if (action === "prompt") {
    setIntroTimer("promptWait", delay, showIntroPrompt);
  } else if (action === "countdownStart") {
    setIntroTimer("countdownWait", delay, startReleaseCountdown);
  } else if (action === "countdownTick") {
    scheduleCountdownTick(delay);
  }
}

function pauseGame() {
  if (!shouldPauseGame(game)) return;

  game.paused = true;
  keyboard.x = 0;
  keyboard.y = 0;
  gesture = null;
  pointers.clear();
  pauseSensorWatchdog();
  pauseIntroTimers();
}

function resumeGame() {
  if (!game.paused) return;

  game.paused = false;
  lastFrame = performance.now();
  resumeSensorWatchdog();
  resumeIntroTimers();
}

function resetGameState() {
  clearTimeout(sensorWatchdog);
  sensorWatchdog = 0;
  sensorWatchdogStartedAt = 0;
  sensorWatchdogDelayMs = 0;
  clearIntroTimers();
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
  gesture = null;
  pointers.clear();

  haptics.impact.lastPulse = 0;
  haptics.surface.lastPulse = 0;
  clearTrail();

  worldEl.classList.remove("map-open");
  controlsEl.hidden = false;
  startBtn.textContent = "start";
  startBtn.disabled = false;
  hideMessage();
  setReleasedBounds();
  updateIntroBounds();
  centerCameraOnMarble();
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
      scheduleIntroSequence();
    }
  }
}

function onKeyUp(e) {
  const k = e.key.toLowerCase();
  if (k === "escape") closeSettingsModal();
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
      gameEl.addEventListener("pointerdown", onPointerDown);
      gameEl.addEventListener("pointermove", onPointerMove);
      gameEl.addEventListener("pointerup", onPointerEnd);
      gameEl.addEventListener("pointercancel", onPointerEnd);
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
    setHint("motion permission denied. check chrome site settings.");
    return;
  }

  requestWakeLock();
  resetGameState();
  controlsEl.hidden = true;
  startBtn.disabled = true;
  inputSystems.motion.enable();
  game.phase = "calibrating";

  setHint("keep holding normally for half a sec...");

  scheduleSensorWatchdog();
}

function setNeutralNow() {
  tilt.neutralX = tilt.rawX;
  tilt.neutralY = tilt.rawY;
  calibration.autoNeutralDone = true;
  if (game.phase === "calibrating") game.phase = "running";
  calibration.sampleCount = tuning.neutralSampleCount;
  marble.vx = 0; marble.vy = 0;
  tilt.smoothX = 0; tilt.smoothY = 0;
  setHint("neutral reset to current hand position.");
}

function requestStartFullscreen() {
  if (startBtn.disabled || game.phase !== "waiting") return;

  requestFullscreenMode({ fullscreenOnStart: settings.fullscreenEnabled });
}

startBtn.addEventListener("pointerdown", requestStartFullscreen);
startBtn.addEventListener("click", start);
neutralBtn.addEventListener("click", setNeutralNow);

function openSettings() {
  pauseGame();
  settingsOverlay.classList.add("open");
  settingsOverlay.setAttribute("aria-hidden", "false");
  updateDebugPanel();
}

function closeSettingsModal() {
  settingsOverlay.classList.remove("open");
  settingsOverlay.setAttribute("aria-hidden", "true");
  resumeGame();
}

settingsToggle.addEventListener("click", openSettings);
closeSettings.addEventListener("click", closeSettingsModal);
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
    centerCameraOnMarble();
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
  if (e.target === settingsOverlay) closeSettingsModal();
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

  if (game.phase !== "waiting" && !game.paused) {
    const context = physicsContext();
    updatePhysicsInput(context, dt);
    updatePhysics(context, dt, {
      onImpact: (impact) => {
        marble.impactSquash = Math.max(marble.impactSquash, clamp(impact / 12, 0, 1));
        hapticFeedback.pulseImpact(impact);
      },
      onSurface: (speed) => hapticFeedback.pulseSurface(speed)
    });
    marble.roll += Math.hypot(marble.vx, marble.vy) * dt / Math.max(marble.r, 1);
    marble.impactSquash = Math.max(0, marble.impactSquash - 0.12 * dt);
    updateCameraFollow(dt);
  }

  marbleEl.style.left = marble.x + "px";
  marbleEl.style.top = marble.y + "px";
  marbleEl.style.setProperty("--marble-scale-x", (1 + marble.impactSquash * 0.08).toFixed(3));
  marbleEl.style.setProperty("--marble-scale-y", (1 - marble.impactSquash * 0.06).toFixed(3));
  updateMarbleLighting();
  if (!game.paused) updateTrail(now);
  updateDebugPanel();

  requestAnimationFrame(loop);
}

try {
  setupMap();
  applySettings();
  syncMarbleRadius();
  centerCameraOnMarble();
  inputSystems.keyboard.enable();
  inputSystems.gestures.enable();
  loop();
} catch (error) {
  showBootError(error);
  throw error;
}
