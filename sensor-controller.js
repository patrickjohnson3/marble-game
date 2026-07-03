import { copy } from "./copy.js";
import { screenAdjusted } from "./platform.js";

export function createSensorController({
  calibration,
  game,
  introSequence,
  marble,
  scheduleFrame,
  sensor,
  tilt,
  tuning,
  ui,
  adjustScreen = screenAdjusted
}) {
  function maybeAutoNeutral() {
    if (game.paused) return;
    if (calibration.autoNeutralDone) return;

    calibration.sampleX += tilt.rawX;
    calibration.sampleY += tilt.rawY;
    calibration.sampleCount++;

    if (calibration.sampleCount >= tuning.neutralSampleCount) {
      tilt.neutralX = calibration.sampleX / calibration.sampleCount;
      tilt.neutralY = calibration.sampleY / calibration.sampleCount;
      calibration.autoNeutralDone = true;
      game.phase = "running";
      marble.vx = 0;
      marble.vy = 0;
      ui.setHint(copy.hints.neutralSet);
      introSequence.schedule();
    }
  }

  function onOrientation(e) {
    if (e.beta == null || e.gamma == null) return;
    sensor.gotOrientation = true;
    sensor.using = "deviceorientation";
    const [tx, ty] = adjustScreen(e.gamma, e.beta);
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

  function setNeutralNow() {
    tilt.neutralX = tilt.rawX;
    tilt.neutralY = tilt.rawY;
    calibration.autoNeutralDone = true;
    if (game.phase === "calibrating") game.phase = "running";
    calibration.sampleCount = tuning.neutralSampleCount;
    marble.vx = 0;
    marble.vy = 0;
    tilt.smoothX = 0;
    tilt.smoothY = 0;
    ui.setHint(copy.hints.neutralReset);
    scheduleFrame();
  }

  return {
    onMotion,
    onOrientation,
    resetCalibration,
    setNeutralNow
  };
}
