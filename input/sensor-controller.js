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
    if (game.paused || game.phase === GAME_PHASES.waiting) return;
    if (tilt.neutralX !== null && tilt.neutralY !== null) return;

    calibration.sampleX += tilt.rawX;
    calibration.sampleY += tilt.rawY;
    calibration.sampleCount++;

    if (calibration.sampleCount >= tuning.neutralSampleCount) {
      tilt.neutralX = calibration.sampleX / calibration.sampleCount;
      tilt.neutralY = calibration.sampleY / calibration.sampleCount;
      // Keyboard play may have started while sensor samples were pending.
      if (game.phase !== GAME_PHASES.running) {
        marble.vx = 0;
        marble.vy = 0;
      }
      game.phase = GAME_PHASES.running;
      ui.setHint(copy.hints.neutralSet);
      ui.setGameStatus("");
      introSequence.schedule();
    }
  }

  function acceptSample(mode, rawX, rawY) {
    if (game.phase === GAME_PHASES.waiting) return;
    if (!Number.isFinite(rawX) || !Number.isFinite(rawY)) return;

    if (sensor.using !== mode) {
      // Each source has its own units and neutral. In particular, a sensor
      // arriving after keyboard fallback must calibrate the holding angle.
      resetCalibration();
      tilt.smoothX = 0;
      tilt.smoothY = 0;
      sensor.using = mode;
      game.phase = GAME_PHASES.calibrating;
      ui.setHint(copy.hints.calibrating);
      ui.setGameStatus(copy.hints.calibrating);
    }
    tilt.rawX = rawX;
    tilt.rawY = rawY;
    maybeAutoNeutral();
  }

  function onOrientation(e) {
    if (!Number.isFinite(e.beta) || !Number.isFinite(e.gamma)) return;
    const [tx, ty] = adjustScreen(e.gamma, e.beta);
    acceptSample(SENSOR_MODES.orientation, tx, ty);
  }

  function onMotion(e) {
    if (sensor.using === SENSOR_MODES.orientation) return;
    const g = e.accelerationIncludingGravity;
    if (!Number.isFinite(g?.x) || !Number.isFinite(g?.y)) return;
    const [tx, ty] = adjustScreen(
      -g.x * tuning.motionGravityScale,
      g.y * tuning.motionGravityScale,
    );
    acceptSample(SENSOR_MODES.motion, tx, ty);
  }

  function resetCalibration() {
    calibration.sampleCount = 0;
    calibration.sampleX = 0;
    calibration.sampleY = 0;
    tilt.neutralX = null;
    tilt.neutralY = null;
  }

  function setNeutralNow() {
    if (game.phase === GAME_PHASES.waiting) return;

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
