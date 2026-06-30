export const mapConfig = {
  world: {
    width: 2200,
    height: 2200
  },
  intro: {
    wallThickness: 34,
    viewportMargin: 18
  },
  camera: {
    minScale: 0.2,
    maxScale: 2.5,
    followLag: 0.08
  },
  elements: [
    { type: "obstacle", x: 260, y: 330, w: 310, h: 42 },
    { type: "obstacle", x: 720, y: 250, w: 54, h: 360 },
    { type: "obstacle", x: 1320, y: 330, w: 430, h: 52 },
    { type: "obstacle", x: 1700, y: 600, w: 58, h: 430 },
    { type: "obstacle", x: 250, y: 900, w: 520, h: 54 },
    { type: "obstacle", x: 910, y: 760, w: 58, h: 380 },
    { type: "obstacle", x: 1180, y: 960, w: 520, h: 50 },
    { type: "obstacle", x: 520, y: 1380, w: 52, h: 440 },
    { type: "obstacle", x: 830, y: 1570, w: 620, h: 52 },
    { type: "obstacle", x: 1640, y: 1370, w: 52, h: 470 },
    { type: "roughPatch", x: 360, y: 650, w: 290, h: 220 },
    { type: "roughPatch", x: 1040, y: 520, w: 360, h: 240 },
    { type: "roughPatch", x: 1420, y: 1160, w: 330, h: 260 },
    { type: "roughPatch", x: 600, y: 1780, w: 420, h: 230 }
  ]
};

export const timing = {
  introPromptDelayMs: 10000,
  countdownDelayMs: 4500,
  countdownStart: 5,
  countdownTickMs: 1000,
  sensorFallbackMs: 1400,
  targetFrameMs: 16.67,
  minFrameStep: 0.25,
  maxFrameStep: 2
};

export const tuning = {
  neutralSampleCount: 18,
  gestureCooldownFrames: 90,
  motionGravityScale: 3
};

export const hapticTuning = {
  impactCooldownMs: 90,
  impactMin: 1.7,
  impactScale: 3,
  impactMinDurationMs: 8,
  impactMaxDurationMs: 35,
  surfaceCooldownMs: 130,
  surfaceMinSpeed: 1.2,
  surfaceScale: 1.4,
  surfaceMinDurationMs: 5,
  surfaceMaxDurationMs: 16
};

export const physicsConfig = {
  accel: 0.115,
  maxTilt: 26,
  smoothing: 0.2,
  friction: 0.94,
  bounce: 0.38,
  deadZone: 0.65,
  maxSpeed: 14,
  keyboardTilt: 18
};

export const settingsConfig = {
  maxSpeed: physicsConfig.maxSpeed,
  acceleration: physicsConfig.accel,
  rotationEnabled: false,
  hapticsEnabled: true
};

export const settingsControls = {
  maxSpeed: {
    min: 8,
    max: 24,
    step: 1
  },
  acceleration: {
    min: 0.06,
    max: 0.18,
    step: 0.005
  }
};
