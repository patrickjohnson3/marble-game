import { resetIntroTimerState } from "./intro-timers.js";

export function createGameState({
  world,
  resolvedMapConfig,
  timing,
  hapticTuning,
  physicsConfig,
}) {
  const spawn = resolvedMapConfig.spawn;
  const state = {
    marble: {
      x: spawn.x,
      y: spawn.y,
      vx: 0,
      vy: 0,
      r: 0,
      roll: 0,
      impactSquash: 0,
    },
    bounds: {
      left: 0,
      right: world.width,
      top: 0,
      bottom: world.height,
    },
    intro: {
      released: false,
      wallThickness: resolvedMapConfig.intro.wallThickness,
      viewportMargin: resolvedMapConfig.intro.viewportMargin,
    },
    introSequence: {
      started: false,
      messageTimer: 0,
      countdownTimer: 0,
      countdownValue: Math.ceil(
        timing.introReleaseDelayMs / timing.countdownTickMs,
      ),
    },
    tilt: {
      rawX: 0,
      rawY: 0,
      smoothX: 0,
      smoothY: 0,
      neutralX: null,
      neutralY: null,
    },
    keyboard: {
      x: 0,
      y: 0,
    },
    camera: {
      x: 0,
      y: 0,
      scale: 1,
      minScale: resolvedMapConfig.camera.minScale,
      maxScale: resolvedMapConfig.camera.maxScale,
      followLag: resolvedMapConfig.camera.followLag,
      gestureCooldown: 0,
    },
    haptics: {
      enabled: true,
      impact: {
        cooldownMs: hapticTuning.impactCooldownMs,
        lastPulse: 0,
        minImpact: hapticTuning.impactMin,
      },
      surface: {
        cooldownMs: hapticTuning.surfaceCooldownMs,
        lastPulse: 0,
        minSpeed: hapticTuning.surfaceMinSpeed,
      },
      goal: {
        holdCooldownMs: hapticTuning.goalHoldCooldownMs,
        lastHoldPulse: 0,
      },
    },
    calibration: {
      sampleCount: 0,
      sampleX: 0,
      sampleY: 0,
      autoNeutralDone: false,
    },
    sensor: {
      gotOrientation: false,
      gotMotion: false,
      using: "none",
    },
    game: {
      phase: "waiting",
      paused: false,
    },
    physics: { ...physicsConfig },
  };

  resetIntroTimerState(state.introSequence);
  return state;
}
