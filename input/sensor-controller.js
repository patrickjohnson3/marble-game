import { copy } from "../core/copy.js";
import { GAME_PHASES, SENSOR_MODES } from "../core/runtime-states.js";

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
  adjustScreen,
}) {
  function maybeAutoNeutral() {
    if (game.paused) return;
    if (tilt.neutralX !== null && tilt.neutralY !== null) return;

    calibration.sampleX += tilt.rawX;
    calibration.sampleY += tilt.rawY;
    calibration.sampleCount++;

    if (calibration.sampleCount >= tuning.neutralSampleCount) {
      tilt.neutralX = calibration.sampleX / calibration.sampleCount;
      tilt.neutralY = calibration.sampleY / calibration.sampleCount;
      game.phase = GAME_PHASES.running;
      marble.vx = 0;
      marble.vy = 0;
      ui.setHint(copy.hints.neutralSet);
      ui.setGameStatus("");
      introSequence.schedule();
    }
  }

  function onOrientation(e) {
    if (e.beta == null || e.gamma == null) return;
    sensor.using = SENSOR_MODES.orientation;
    const [tx, ty] = adjustScreen(e.gamma, e.beta);
    tilt.rawX = tx;
    tilt.rawY = ty;
    maybeAutoNeutral();
  }

  function onMotion(e) {
    if (sensor.using === SENSOR_MODES.orientation) return;
    const g = e.accelerationIncludingGravity;
    if (!g) return;
    sensor.using = SENSOR_MODES.motion;
    tilt.rawX = -(g.x || 0) * tuning.motionGravityScale;
    tilt.rawY = (g.y || 0) * tuning.motionGravityScale;
    maybeAutoNeutral();
  }

  function resetCalibration() {
    calibration.sampleCount = 0;
    calibration.sampleX = 0;
    calibration.sampleY = 0;
    tilt.neutralX = null;
    tilt.neutralY = null;
  }

  function setNeutralNow() {
    tilt.neutralX = tilt.rawX;
    tilt.neutralY = tilt.rawY;
    if (game.phase === GAME_PHASES.calibrating)
      game.phase = GAME_PHASES.running;
    calibration.sampleCount = tuning.neutralSampleCount;
    marble.vx = 0;
    marble.vy = 0;
    tilt.smoothX = 0;
    tilt.smoothY = 0;
    ui.setHint(copy.hints.neutralReset);
    ui.setGameStatus("");
    introSequence.schedule();
    scheduleFrame();
  }

  return {
    onMotion,
    onOrientation,
    resetCalibration,
    setNeutralNow,
  };
}
