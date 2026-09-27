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
  game,
  introSequence,
  keyboard,
  scheduleFrame,
  sensor,
  tilt,
  closeSettings,
  onInputReady = () => {},
}) {
  function activateKeyboardFallback() {
    sensor.using =
      sensor.using === SENSOR_MODES.none ? SENSOR_MODES.keyboard : sensor.using;
    if (
      game.phase !== GAME_PHASES.waiting &&
      game.phase !== GAME_PHASES.calibrating
    )
      return;

    game.phase = GAME_PHASES.running;
    // A partial sensor stream must not block keyboard startup, or lose its
    // pending calibration if readings resume after the player switches inputs.
    if (sensor.using === SENSOR_MODES.keyboard) {
      tilt.neutralX = 0;
      tilt.neutralY = 0;
    }
    onInputReady();
    introSequence.schedule();
    scheduleFrame();
  }

  function updateDirection() {
    keyboard.x = 0;
    keyboard.y = 0;
    // Set insertion order preserves the last freshly pressed direction per axis.
    for (const key of keyboard.heldKeys) {
      if (key === "arrowleft" || key === "a") keyboard.x = -1;
      if (key === "arrowright" || key === "d") keyboard.x = 1;
      if (key === "arrowup" || key === "w") keyboard.y = -1;
      if (key === "arrowdown" || key === "s") keyboard.y = 1;
    }
  }

  function clear() {
    keyboard.heldKeys.clear();
    updateDirection();
  }

  function onKeyDown(e) {
    const key = e.key.toLowerCase();
    if (game.paused || !movementKeys.has(key)) return;
    e.preventDefault();
    if (game.phase === GAME_PHASES.waiting) return;
    // A held key must not spring back to life after pause or focus loss.
    if (e.repeat && !keyboard.heldKeys.has(key)) return;

    keyboard.heldKeys.add(key);
    updateDirection();
    activateKeyboardFallback();
  }

  function onKeyUp(e) {
    const key = e.key.toLowerCase();
    if (key === "escape") closeSettings();
    if (!movementKeys.has(key)) return;
    keyboard.heldKeys.delete(key);
    updateDirection();
  }

  return {
    clear,
    onKeyDown,
    onKeyUp,
  };
}
