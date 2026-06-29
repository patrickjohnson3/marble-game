(() => {
  const marbleEl = document.getElementById("marble");
  const startBtn = document.getElementById("start");
  const neutralBtn = document.getElementById("neutral");
  const settingsToggle = document.getElementById("settingsToggle");
  const settingsOverlay = document.getElementById("settingsOverlay");
  const closeSettings = document.getElementById("closeSettings");
  const speedSetting = document.getElementById("speedSetting");
  const sensitivitySetting = document.getElementById("sensitivitySetting");
  const hint = document.getElementById("hint");
  const debug = document.getElementById("debug");

  const marble = {
    x: innerWidth / 2,
    y: innerHeight / 2,
    vx: 0,
    vy: 0,
    r: 0
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

  let lastFrame = performance.now();
  let sensorWatchdog = 0;

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

  const physics = {
    accel: 0.115,
    maxTilt: 26,
    smoothing: 0.2,
    friction: 0.94,
    bounce: 0.38,
    deadZone: 0.65,
    maxSpeed: 14,
    keyboardTilt: 18
  };

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function dz(v) { return Math.abs(v) < physics.deadZone ? 0 : v; }
  function setHint(message) { hint.textContent = message; }
  function isSettingsOpen() { return settingsOverlay.classList.contains("open"); }

  function updateDebugPanel() {
    if (!isSettingsOpen()) return;

    debug.textContent =
      "phase: " + game.phase +
      "\nsensor: " + sensor.using +
      "\norientation seen: " + sensor.gotOrientation +
      " | motion seen: " + sensor.gotMotion +
      "\nauto neutral: " + calibration.autoNeutralDone +
      "\nraw x/y: " + tilt.rawX.toFixed(2) + " / " + tilt.rawY.toFixed(2) +
      "\nneutral x/y: " + (tilt.neutralX ?? 0).toFixed(2) + " / " + (tilt.neutralY ?? 0).toFixed(2) +
      "\ntilt x/y: " + tilt.smoothX.toFixed(2) + " / " + tilt.smoothY.toFixed(2) +
      "\nvel x/y: " + marble.vx.toFixed(2) + " / " + marble.vy.toFixed(2);
  }

  function syncMarbleRadius() {
    const rect = marbleEl.getBoundingClientRect();
    marble.r = Math.max(rect.width, rect.height) / 2;
  }

  function resize() {
    syncMarbleRadius();
    marble.x = clamp(marble.x, marble.r, innerWidth - marble.r);
    marble.y = clamp(marble.y, marble.r, innerHeight - marble.r);
  }
  addEventListener("resize", resize);

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
    if (calibration.sampleCount >= 18) {
      tilt.neutralX = calibration.sampleX / calibration.sampleCount;
      tilt.neutralY = calibration.sampleY / calibration.sampleCount;
      calibration.autoNeutralDone = true;
      game.phase = "running";
      marble.vx = 0; marble.vy = 0;
      setHint("neutral set. tilt from your normal holding angle.");
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
    tilt.rawX = -(g.x || 0) * 3;
    tilt.rawY = (g.y || 0) * 3;
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

  function enableMotionInput() {
    addEventListener("deviceorientation", onOrientation, true);
    addEventListener("devicemotion", onMotion, true);
  }

  function enableKeyboardInput() {
    addEventListener("keydown", onKeyDown, { passive:false });
    addEventListener("keyup", onKeyUp);
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
      if (game.phase === "waiting" || game.phase === "calibrating") game.phase = "keyboard";
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

  async function start() {
    const ok = await requestPermissionIfNeeded();
    if (!ok) {
      setHint("motion permission denied. check chrome site settings.");
      return;
    }

    resetCalibration();
    enableMotionInput();
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
      }
    }, 1400);
  }

  function setNeutralNow() {
    tilt.neutralX = tilt.rawX;
    tilt.neutralY = tilt.rawY;
    calibration.autoNeutralDone = true;
    if (game.phase === "calibrating") game.phase = "running";
    calibration.sampleCount = 18;
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
    physics.maxSpeed = Number(speedSetting.value);
  });
  sensitivitySetting.addEventListener("input", () => {
    physics.accel = Number(sensitivitySetting.value);
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

    tilt.smoothX += (targetX - tilt.smoothX) * (1 - Math.pow(1 - physics.smoothing, dt));
    tilt.smoothY += (targetY - tilt.smoothY) * (1 - Math.pow(1 - physics.smoothing, dt));
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

  function handleWallCollisions() {
    if (marble.x < marble.r) { marble.x = marble.r; marble.vx = -marble.vx * physics.bounce; }
    if (marble.x > innerWidth - marble.r) { marble.x = innerWidth - marble.r; marble.vx = -marble.vx * physics.bounce; }
    if (marble.y < marble.r) { marble.y = marble.r; marble.vy = -marble.vy * physics.bounce; }
    if (marble.y > innerHeight - marble.r) { marble.y = innerHeight - marble.r; marble.vy = -marble.vy * physics.bounce; }
  }

  function loop() {
    const now = performance.now();
    const dt = clamp((now - lastFrame) / 16.67, 0.25, 2);
    lastFrame = now;

    updateTilt(dt);
    updateVelocity(dt);
    updatePosition(dt);
    handleWallCollisions();

    marbleEl.style.left = marble.x + "px";
    marbleEl.style.top = marble.y + "px";
    updateDebugPanel();

    requestAnimationFrame(loop);
  }

  syncMarbleRadius();
  enableKeyboardInput();
  loop();
})();
