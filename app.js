(() => {
  const marbleEl = document.getElementById("marble");
  const startBtn = document.getElementById("start");
  const neutralBtn = document.getElementById("neutral");
  const settingsToggle = document.getElementById("settingsToggle");
  const settingsOverlay = document.getElementById("settingsOverlay");
  const closeSettings = document.getElementById("closeSettings");
  const hint = document.getElementById("hint");
  const debug = document.getElementById("debug");

  const marble = {
    x: innerWidth / 2,
    y: innerHeight / 2,
    vx: 0,
    vy: 0,
    r: 29
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

  // feel knobs
  const accel = 0.115;
  const maxTilt = 26;
  const smoothing = 0.2;
  const friction = 0.94;
  const bounce = 0.38;
  const deadZone = 0.65;
  const maxSpeed = 14;

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function dz(v) { return Math.abs(v) < deadZone ? 0 : v; }

  function resize() {
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
      marble.vx = 0; marble.vy = 0;
      hint.textContent = "neutral set. tilt from your normal holding angle.";
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
    return true;
  }

  async function start() {
    const ok = await requestPermissionIfNeeded();
    if (!ok) {
      hint.textContent = "motion permission denied. check chrome site settings.";
      return;
    }

    calibration.sampleCount = 0;
    calibration.sampleX = 0;
    calibration.sampleY = 0;
    calibration.autoNeutralDone = false;
    tilt.neutralX = null;
    tilt.neutralY = null;

    addEventListener("deviceorientation", onOrientation, true);
    addEventListener("devicemotion", onMotion, true);

    startBtn.textContent = "running";
    startBtn.disabled = true;
    hint.textContent = "keep holding normally for half a sec...";

    clearTimeout(sensorWatchdog);
    sensorWatchdog = setTimeout(() => {
      if (sensor.using === "none") {
        hint.textContent = "no motion sensor yet. use arrows/WASD here, or try HTTPS on your phone.";
        sensor.using = "keyboard";
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
    calibration.sampleCount = 18;
    marble.vx = 0; marble.vy = 0;
    tilt.smoothX = 0; tilt.smoothY = 0;
    hint.textContent = "neutral reset to current hand position.";
  }

  startBtn.addEventListener("click", start);
  neutralBtn.addEventListener("click", setNeutralNow);

  function openSettings() {
    settingsOverlay.classList.add("open");
    settingsOverlay.setAttribute("aria-hidden", "false");
  }

  function closeSettingsModal() {
    settingsOverlay.classList.remove("open");
    settingsOverlay.setAttribute("aria-hidden", "true");
  }

  settingsToggle.addEventListener("click", openSettings);
  closeSettings.addEventListener("click", closeSettingsModal);
  settingsOverlay.addEventListener("click", (e) => {
    if (e.target === settingsOverlay) closeSettingsModal();
  });

  addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if (k === "arrowleft" || k === "a") keyboard.x = -1;
    if (k === "arrowright" || k === "d") keyboard.x = 1;
    if (k === "arrowup" || k === "w") keyboard.y = -1;
    if (k === "arrowdown" || k === "s") keyboard.y = 1;
    if (["arrowleft","arrowright","arrowup","arrowdown","a","d","w","s"].includes(k)) {
      e.preventDefault();
      sensor.using = sensor.using === "none" ? "keyboard" : sensor.using;
    }
  }, { passive:false });

  addEventListener("keyup", (e) => {
    const k = e.key.toLowerCase();
    if (k === "escape") closeSettingsModal();
    if ((k === "arrowleft" || k === "a") && keyboard.x < 0) keyboard.x = 0;
    if ((k === "arrowright" || k === "d") && keyboard.x > 0) keyboard.x = 0;
    if ((k === "arrowup" || k === "w") && keyboard.y < 0) keyboard.y = 0;
    if ((k === "arrowdown" || k === "s") && keyboard.y > 0) keyboard.y = 0;
  });

  function updateTilt(dt) {
    const nx = tilt.neutralX ?? tilt.rawX;
    const ny = tilt.neutralY ?? tilt.rawY;

    const sensorX = clamp(dz(tilt.rawX - nx), -maxTilt, maxTilt);
    const sensorY = clamp(dz(tilt.rawY - ny), -maxTilt, maxTilt);
    const targetX = keyboard.x ? keyboard.x * 18 : sensorX;
    const targetY = keyboard.y ? keyboard.y * 18 : sensorY;

    tilt.smoothX += (targetX - tilt.smoothX) * (1 - Math.pow(1 - smoothing, dt));
    tilt.smoothY += (targetY - tilt.smoothY) * (1 - Math.pow(1 - smoothing, dt));
  }

  function updateVelocity(dt) {
    marble.vx += tilt.smoothX * accel * dt;
    marble.vy += tilt.smoothY * accel * dt;

    const drag = Math.pow(friction, dt);
    marble.vx = clamp(marble.vx * drag, -maxSpeed, maxSpeed);
    marble.vy = clamp(marble.vy * drag, -maxSpeed, maxSpeed);
  }

  function updatePosition(dt) {
    marble.x += marble.vx * dt;
    marble.y += marble.vy * dt;
  }

  function handleWallCollisions() {
    if (marble.x < marble.r) { marble.x = marble.r; marble.vx = -marble.vx * bounce; }
    if (marble.x > innerWidth - marble.r) { marble.x = innerWidth - marble.r; marble.vx = -marble.vx * bounce; }
    if (marble.y < marble.r) { marble.y = marble.r; marble.vy = -marble.vy * bounce; }
    if (marble.y > innerHeight - marble.r) { marble.y = innerHeight - marble.r; marble.vy = -marble.vy * bounce; }
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

    debug.textContent =
      "sensor: " + sensor.using +
      "\norientation seen: " + sensor.gotOrientation +
      " | motion seen: " + sensor.gotMotion +
      "\nauto neutral: " + calibration.autoNeutralDone +
      "\nraw x/y: " + tilt.rawX.toFixed(2) + " / " + tilt.rawY.toFixed(2) +
      "\nneutral x/y: " + (tilt.neutralX ?? 0).toFixed(2) + " / " + (tilt.neutralY ?? 0).toFixed(2) +
      "\ntilt x/y: " + tilt.smoothX.toFixed(2) + " / " + tilt.smoothY.toFixed(2) +
      "\nvel x/y: " + marble.vx.toFixed(2) + " / " + marble.vy.toFixed(2);

    requestAnimationFrame(loop);
  }

  loop();
})();
