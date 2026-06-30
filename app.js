const assetVersion = new URL(import.meta.url).searchParams.get("v") || "dev";
const versioned = (path) => path + "?v=" + encodeURIComponent(assetVersion);
const [
  configModule,
  domModule,
  geometryModule,
  hapticsModule,
  renderingModule
] = await Promise.all([
  import(versioned("./config.js")),
  import(versioned("./dom.js")),
  import(versioned("./geometry.js")),
  import(versioned("./haptics.js")),
  import(versioned("./rendering.js"))
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
const { els } = domModule;
const { clamp, distance, angle, midpoint, circleRectContact } = geometryModule;
const { createHapticsController } = hapticsModule;
const { renderMapElements, renderWalls } = renderingModule;

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
  marble: marbleEl,
  messageOverlay,
  startBtn,
  neutralBtn,
  settingsToggle,
  settingsOverlay,
  closeSettings,
  speedSetting,
  sensitivitySetting,
  rotationSetting,
  hapticsSetting,
  hint,
  debug
} = els;

const world = mapConfig.world;
const mapElements = mapConfig.elements;
const obstacles = mapElements.filter((element) => element.type === "obstacle");
const roughPatches = mapElements.filter((element) => element.type === "roughPatch");

const marble = {
  x: world.width / 2,
  y: world.height / 2,
  vx: 0,
  vy: 0,
  r: 0
};

const bounds = {
  left: 0,
  right: world.width,
  top: 0,
  bottom: world.height
};

const intro = {
  started: false,
  released: false,
  wallThickness: mapConfig.intro.wallThickness,
  viewportMargin: mapConfig.intro.viewportMargin,
  messageTimer: 0,
  countdownTimer: 0,
  countdownValue: timing.countdownStart
};

const tilt = {
  rawX: 0,
  rawY: 0,
  smoothX: 0,
  smoothY: 0,
  neutralX: null,
  neutralY: null
};

const keyboard = {
  x: 0,
  y: 0
};

const camera = {
  x: 0,
  y: 0,
  scale: 1,
  rotation: 0,
  rotationEnabled: false,
  minScale: mapConfig.camera.minScale,
  maxScale: mapConfig.camera.maxScale,
  followLag: mapConfig.camera.followLag,
  gestureCooldown: 0
};

const pointers = new Map();
let gesture = null;
let lastFrame = performance.now();
let sensorWatchdog = 0;

const haptics = {
  enabled: true,
  impact: {
    cooldownMs: hapticTuning.impactCooldownMs,
    lastPulse: 0,
    minImpact: hapticTuning.impactMin
  },
  surface: {
    cooldownMs: hapticTuning.surfaceCooldownMs,
    lastPulse: 0,
    minSpeed: hapticTuning.surfaceMinSpeed
  }
};

const calibration = {
  sampleCount: 0,
  sampleX: 0,
  sampleY: 0,
  autoNeutralDone: false
};

const sensor = {
  gotOrientation: false,
  gotMotion: false,
  using: "none"
};

const game = {
  phase: "waiting"
};

const physics = { ...physicsConfig };

function applyRangeConfig(input, range) {
  input.min = range.min;
  input.max = range.max;
  input.step = range.step;
}

applyRangeConfig(speedSetting, settingsControls.maxSpeed);
applyRangeConfig(sensitivitySetting, settingsControls.acceleration);
speedSetting.value = settingsConfig.maxSpeed;
sensitivitySetting.value = settingsConfig.acceleration;
rotationSetting.checked = settingsConfig.rotationEnabled;
hapticsSetting.checked = settingsConfig.hapticsEnabled;

const settings = { ...settingsConfig };

function dz(v) { return Math.abs(v) < physics.deadZone ? 0 : v; }
function setHint(message) { hint.textContent = message; }
function isSettingsOpen() { return settingsOverlay.classList.contains("open"); }

function applySettings() {
  physics.maxSpeed = settings.maxSpeed;
  physics.accel = settings.acceleration;
  camera.rotationEnabled = settings.rotationEnabled;
  haptics.enabled = settings.hapticsEnabled;
}

const hapticFeedback = createHapticsController(haptics, hapticTuning);

function getDebugLines() {
  return [
    "phase: " + game.phase,
    "sensor: " + sensor.using,
    "orientation seen: " + sensor.gotOrientation + " | motion seen: " + sensor.gotMotion,
    "auto neutral: " + calibration.autoNeutralDone,
    "raw x/y: " + tilt.rawX.toFixed(2) + " / " + tilt.rawY.toFixed(2),
    "neutral x/y: " + (tilt.neutralX ?? 0).toFixed(2) + " / " + (tilt.neutralY ?? 0).toFixed(2),
    "tilt x/y: " + tilt.smoothX.toFixed(2) + " / " + tilt.smoothY.toFixed(2),
    "vel x/y: " + marble.vx.toFixed(2) + " / " + marble.vy.toFixed(2),
    "zoom: " + camera.scale.toFixed(2) +
      " | rotation: " + (camera.rotation * 180 / Math.PI).toFixed(0) + "deg" +
      " | enabled: " + camera.rotationEnabled,
    "haptics: " + (haptics.enabled ? "on" : "off"),
    "follow cooldown: " + camera.gestureCooldown.toFixed(1),
    "map released: " + intro.released
  ];
}

function updateDebugPanel() {
  if (!isSettingsOpen()) return;

  debug.textContent = getDebugLines().join("\n");
}

function renderObstacles() {
  renderMapElements(obstaclesEl, "obstacle", obstacles);
}

function renderRoughPatches() {
  renderMapElements(roughPatchesEl, "roughPatch", roughPatches);
}

function mapEdgeWalls() {
  const t = intro.wallThickness;
  return [
    { x: -t, y: -t, w: world.width + t * 2, h: t },
    { x: -t, y: world.height, w: world.width + t * 2, h: t },
    { x: -t, y: 0, w: t, h: world.height },
    { x: world.width, y: 0, w: t, h: world.height }
  ];
}

function introPenWalls() {
  const t = intro.wallThickness;
  return [
    { x: bounds.left - t, y: bounds.top - t, w: bounds.right - bounds.left + t * 2, h: t },
    { x: bounds.left - t, y: bounds.bottom, w: bounds.right - bounds.left + t * 2, h: t },
    { x: bounds.left - t, y: bounds.top, w: t, h: bounds.bottom - bounds.top },
    { x: bounds.right, y: bounds.top, w: t, h: bounds.bottom - bounds.top }
  ];
}

function showMessage(html) {
  messageOverlay.innerHTML = html;
  messageOverlay.classList.add("show");
}

function hideMessage() {
  messageOverlay.classList.remove("show");
}

function syncMarbleRadius() {
  marble.r = Math.max(marbleEl.offsetWidth, marbleEl.offsetHeight) / 2;
}

function centerCameraOnMarble() {
  const transformed = transformedWorldPoint(marble.x, marble.y);
  camera.x = innerWidth / 2 - transformed.x;
  camera.y = innerHeight / 2 - transformed.y;
  applyCameraTransform();
}

function updateIntroBounds() {
  const halfW = innerWidth / 2 + intro.viewportMargin;
  const halfH = innerHeight / 2 + intro.viewportMargin;
  bounds.left = clamp(marble.x - halfW, 0, world.width);
  bounds.right = clamp(marble.x + halfW, 0, world.width);
  bounds.top = clamp(marble.y - halfH, 0, world.height);
  bounds.bottom = clamp(marble.y + halfH, 0, world.height);
  renderWalls(introWallsEl, introPenWalls());
}

function setReleasedBounds() {
  bounds.left = 0;
  bounds.right = world.width;
  bounds.top = 0;
  bounds.bottom = world.height;
}

function setupMap() {
  worldEl.style.width = world.width + "px";
  worldEl.style.height = world.height + "px";
  setReleasedBounds();
  renderWalls(mapWallsEl, mapEdgeWalls());
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
  if (!pointers.has(e.pointerId)) return;

  pointers.set(e.pointerId, pointerPoint(e));
  updateGesture();
}

function onPointerEnd(e) {
  pointers.delete(e.pointerId);
  gesture = null;
  if (pointers.size === 2) startGesture();
}

function scheduleIntroSequence() {
  if (intro.started) return;

  intro.started = true;
  intro.messageTimer = setTimeout(() => {
    showMessage("Pinch to zoom out. Reverse pinch to zoom in. Rotation is available in settings.");
    intro.countdownTimer = setTimeout(startReleaseCountdown, timing.countdownDelayMs);
  }, timing.introPromptDelayMs);
}

function startReleaseCountdown() {
  intro.countdownValue = timing.countdownStart;
  showCountdown();

  intro.countdownTimer = setInterval(() => {
    intro.countdownValue--;
    if (intro.countdownValue <= 0) {
      clearInterval(intro.countdownTimer);
      releaseMap();
      return;
    }

    showCountdown();
  }, timing.countdownTickMs);
}

function showCountdown() {
  showMessage('Ready?<span class="countdown">' + intro.countdownValue + '</span>');
}

function releaseMap() {
  intro.released = true;
  introWallsEl.innerHTML = "";
  worldEl.classList.add("map-open");
  setReleasedBounds();
  hideMessage();
  setHint("map open. zoom, rotate, and explore.");
}

function screenAdjusted(gamma, beta) {
  const angle = screen.orientation && typeof screen.orientation.angle === "number"
    ? screen.orientation.angle
    : (window.orientation || 0);

  let tx = gamma || 0;
  let ty = beta || 0;

  if (angle === 90) {
    [tx, ty] = [ty, -tx];
  } else if (angle === -90 || angle === 270) {
    [tx, ty] = [-ty, tx];
  } else if (angle === 180) {
    tx = -tx;
    ty = -ty;
  }

  return [tx, ty];
}

function maybeAutoNeutral() {
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

async function requestPermissionIfNeeded() {
  try {
    if (typeof DeviceOrientationEvent !== "undefined" &&
        typeof DeviceOrientationEvent.requestPermission === "function") {
      const p = await DeviceOrientationEvent.requestPermission();
      if (p !== "granted") return false;
    }
    if (typeof DeviceMotionEvent !== "undefined" &&
        typeof DeviceMotionEvent.requestPermission === "function") {
      const p = await DeviceMotionEvent.requestPermission();
      if (p !== "granted") return false;
    }
  } catch {
    return false;
  }
  return true;
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
  clearInterval(intro.countdownTimer);
  intro.messageTimer = 0;
  intro.countdownTimer = 0;
}

function resetGameState() {
  clearTimeout(sensorWatchdog);
  sensorWatchdog = 0;
  clearIntroTimers();
  resetCalibration();

  game.phase = "waiting";
  sensor.gotOrientation = false;
  sensor.gotMotion = false;
  sensor.using = "none";

  intro.started = false;
  intro.released = false;
  intro.countdownValue = timing.countdownStart;

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

  camera.x = 0;
  camera.y = 0;
  camera.scale = 1;
  camera.rotation = 0;
  camera.gestureCooldown = 0;
  gesture = null;
  pointers.clear();

  haptics.impact.lastPulse = 0;
  haptics.surface.lastPulse = 0;

  worldEl.classList.remove("map-open");
  hideMessage();
  setReleasedBounds();
  updateIntroBounds();
  centerCameraOnMarble();
}

function onKeyDown(e) {
  const k = e.key.toLowerCase();
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
  const ok = await requestPermissionIfNeeded();
  if (!ok) {
    setHint("motion permission denied. check chrome site settings.");
    return;
  }

  resetGameState();
  inputSystems.motion.enable();
  game.phase = "calibrating";

  startBtn.textContent = "running";
  startBtn.disabled = true;
  setHint("keep holding normally for half a sec...");

  clearTimeout(sensorWatchdog);
  sensorWatchdog = setTimeout(() => {
    if (sensor.using === "none") {
      setHint("no motion sensor yet. use arrows/WASD here, or try HTTPS on your phone.");
      sensor.using = "keyboard";
      game.phase = "keyboard";
      tilt.neutralX = 0;
      tilt.neutralY = 0;
      calibration.autoNeutralDone = true;
      scheduleIntroSequence();
    }
  }, timing.sensorFallbackMs);
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

startBtn.addEventListener("click", start);
neutralBtn.addEventListener("click", setNeutralNow);

function openSettings() {
  settingsOverlay.classList.add("open");
  settingsOverlay.setAttribute("aria-hidden", "false");
  updateDebugPanel();
}

function closeSettingsModal() {
  settingsOverlay.classList.remove("open");
  settingsOverlay.setAttribute("aria-hidden", "true");
}

settingsToggle.addEventListener("click", openSettings);
closeSettings.addEventListener("click", closeSettingsModal);
speedSetting.addEventListener("input", () => {
  settings.maxSpeed = Number(speedSetting.value);
  applySettings();
});
sensitivitySetting.addEventListener("input", () => {
  settings.acceleration = Number(sensitivitySetting.value);
  applySettings();
});
rotationSetting.addEventListener("change", () => {
  settings.rotationEnabled = rotationSetting.checked;
  applySettings();
  if (!settings.rotationEnabled) {
    camera.rotation = 0;
    centerCameraOnMarble();
  }
});
hapticsSetting.addEventListener("change", () => {
  settings.hapticsEnabled = hapticsSetting.checked;
  applySettings();
});
settingsOverlay.addEventListener("click", (e) => {
  if (e.target === settingsOverlay) closeSettingsModal();
});

function updateTilt(dt) {
  const nx = tilt.neutralX ?? tilt.rawX;
  const ny = tilt.neutralY ?? tilt.rawY;

  const sensorX = clamp(dz(tilt.rawX - nx), -physics.maxTilt, physics.maxTilt);
  const sensorY = clamp(dz(tilt.rawY - ny), -physics.maxTilt, physics.maxTilt);
  const targetX = keyboard.x ? keyboard.x * physics.keyboardTilt : sensorX;
  const targetY = keyboard.y ? keyboard.y * physics.keyboardTilt : sensorY;
  const c = Math.cos(-camera.rotation);
  const s = Math.sin(-camera.rotation);
  const worldTargetX = targetX * c - targetY * s;
  const worldTargetY = targetX * s + targetY * c;

  tilt.smoothX += (worldTargetX - tilt.smoothX) * (1 - Math.pow(1 - physics.smoothing, dt));
  tilt.smoothY += (worldTargetY - tilt.smoothY) * (1 - Math.pow(1 - physics.smoothing, dt));
}

function updateVelocity(dt) {
  marble.vx += tilt.smoothX * physics.accel * dt;
  marble.vy += tilt.smoothY * physics.accel * dt;

  const drag = Math.pow(physics.friction, dt);
  marble.vx = clamp(marble.vx * drag, -physics.maxSpeed, physics.maxSpeed);
  marble.vy = clamp(marble.vy * drag, -physics.maxSpeed, physics.maxSpeed);
}

function updatePosition(dt) {
  marble.x += marble.vx * dt;
  marble.y += marble.vy * dt;
}

function marbleOverRect(rect) {
  return circleRectContact(marble, rect).intersects;
}

function handleSurfaceFeedback() {
  if (!intro.released) return;
  if (!roughPatches.some(marbleOverRect)) return;

  hapticFeedback.pulseSurface(Math.hypot(marble.vx, marble.vy));
}

function resolveObstacleCollision(obstacle) {
  const contact = circleRectContact(marble, obstacle);

  if (!contact.intersects) return;

  let distance = Math.sqrt(contact.distanceSq);
  let nx = contact.dx / (distance || 1);
  let ny = contact.dy / (distance || 1);

  if (distance === 0) {
    const left = Math.abs(marble.x - obstacle.x);
    const right = Math.abs(obstacle.x + obstacle.w - marble.x);
    const top = Math.abs(marble.y - obstacle.y);
    const bottom = Math.abs(obstacle.y + obstacle.h - marble.y);
    const min = Math.min(left, right, top, bottom);
    nx = min === left ? -1 : min === right ? 1 : 0;
    ny = min === top ? -1 : min === bottom ? 1 : 0;
    distance = 0;
  }

  const overlap = marble.r - distance;
  marble.x += nx * overlap;
  marble.y += ny * overlap;

  const impact = marble.vx * nx + marble.vy * ny;
  if (impact < 0) {
    hapticFeedback.pulseImpact(-impact);
    marble.vx -= (1 + physics.bounce) * impact * nx;
    marble.vy -= (1 + physics.bounce) * impact * ny;
  }
}

function handleWallCollisions() {
  if (marble.x < bounds.left + marble.r) {
    hapticFeedback.pulseImpact(Math.abs(marble.vx));
    marble.x = bounds.left + marble.r;
    marble.vx = -marble.vx * physics.bounce;
  }
  if (marble.x > bounds.right - marble.r) {
    hapticFeedback.pulseImpact(Math.abs(marble.vx));
    marble.x = bounds.right - marble.r;
    marble.vx = -marble.vx * physics.bounce;
  }
  if (marble.y < bounds.top + marble.r) {
    hapticFeedback.pulseImpact(Math.abs(marble.vy));
    marble.y = bounds.top + marble.r;
    marble.vy = -marble.vy * physics.bounce;
  }
  if (marble.y > bounds.bottom - marble.r) {
    hapticFeedback.pulseImpact(Math.abs(marble.vy));
    marble.y = bounds.bottom - marble.r;
    marble.vy = -marble.vy * physics.bounce;
  }

  if (intro.released) {
    obstacles.forEach(resolveObstacleCollision);
  }
}

function loop() {
  const now = performance.now();
  const dt = clamp(
    (now - lastFrame) / timing.targetFrameMs,
    timing.minFrameStep,
    timing.maxFrameStep
  );
  lastFrame = now;

  if (game.phase !== "waiting") {
    updateTilt(dt);
    updateVelocity(dt);
    updatePosition(dt);
    handleWallCollisions();
    handleSurfaceFeedback();
    updateCameraFollow(dt);
  }

  marbleEl.style.left = marble.x + "px";
  marbleEl.style.top = marble.y + "px";
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
