import { GAME_PHASES, SENSOR_MODES } from "../core/runtime-states.js";

const movementKeys = new Set([
  "arrowleft",
  "arrowright",
  "arrowup",
  "arrowdown",
  "a",
  "d",
  "w",
  "s",
]);

export function createKeyboardController({
  calibration,
  game,
  introSequence,
  keyboard,
  scheduleFrame,
  sensor,
  tilt,
  closeSettings,
}) {
  function activateKeyboardFallback() {
    sensor.using =
      sensor.using === SENSOR_MODES.none ? SENSOR_MODES.keyboard : sensor.using;
    if (
      game.phase !== GAME_PHASES.waiting &&
      game.phase !== GAME_PHASES.calibrating
    )
      return;

    game.phase = GAME_PHASES.keyboard;
    tilt.neutralX = 0;
    tilt.neutralY = 0;
    calibration.autoNeutralDone = true;
    introSequence.schedule();
    scheduleFrame();
  }

  function onKeyDown(e) {
    const key = e.key.toLowerCase();
    if (game.paused) return;

    if (key === "arrowleft" || key === "a") keyboard.x = -1;
    if (key === "arrowright" || key === "d") keyboard.x = 1;
    if (key === "arrowup" || key === "w") keyboard.y = -1;
    if (key === "arrowdown" || key === "s") keyboard.y = 1;
    if (movementKeys.has(key)) {
      e.preventDefault();
      activateKeyboardFallback();
    }
  }

  function onKeyUp(e) {
    const key = e.key.toLowerCase();
    if (key === "escape") closeSettings();
    if (game.paused) return;

    if ((key === "arrowleft" || key === "a") && keyboard.x < 0) keyboard.x = 0;
    if ((key === "arrowright" || key === "d") && keyboard.x > 0) keyboard.x = 0;
    if ((key === "arrowup" || key === "w") && keyboard.y < 0) keyboard.y = 0;
    if ((key === "arrowdown" || key === "s") && keyboard.y > 0) keyboard.y = 0;
  }

  return {
    onKeyDown,
    onKeyUp,
  };
}
