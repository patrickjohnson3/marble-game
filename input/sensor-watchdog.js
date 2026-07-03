import { createPausableTimeout } from "../core/timer-utils.js";

export function createSensorWatchdog({ delayMs, game, sensor, onFallback }) {
  const timer = createPausableTimeout({
    delayMs,
    onRun() {
      if (game.paused) return;
      if (sensor.using !== "none") return;

      onFallback();
    }
  });

  return {
    pause: timer.pause,
    reset: timer.reset,
    resume: timer.resume,
    schedule: timer.schedule
  };
}
