export function createGameState({ world, mapConfig, timing, hapticTuning, physicsConfig }) {
  return {
    marble: {
      x: world.width / 2,
      y: world.height / 2,
      vx: 0,
      vy: 0,
      r: 0,
      roll: 0
    },
    bounds: {
      left: 0,
      right: world.width,
      top: 0,
      bottom: world.height
    },
    intro: {
      started: false,
      released: false,
      wallThickness: mapConfig.intro.wallThickness,
      viewportMargin: mapConfig.intro.viewportMargin,
      messageTimer: 0,
      countdownTimer: 0,
      countdownValue: timing.countdownStart
    },
    tilt: {
      rawX: 0,
      rawY: 0,
      smoothX: 0,
      smoothY: 0,
      neutralX: null,
      neutralY: null
    },
    keyboard: {
      x: 0,
      y: 0
    },
    camera: {
      x: 0,
      y: 0,
      scale: 1,
      rotation: 0,
      rotationEnabled: false,
      minScale: mapConfig.camera.minScale,
      maxScale: mapConfig.camera.maxScale,
      followLag: mapConfig.camera.followLag,
      gestureCooldown: 0
    },
    haptics: {
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
    },
    calibration: {
      sampleCount: 0,
      sampleX: 0,
      sampleY: 0,
      autoNeutralDone: false
    },
    sensor: {
      gotOrientation: false,
      gotMotion: false,
      using: "none"
    },
    game: {
      phase: "waiting"
    },
    physics: { ...physicsConfig }
  };
}
