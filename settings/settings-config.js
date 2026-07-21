import { appConfig, physicsConfig } from "../core/game-config.js";

export const settingsConfig = {
  maxSpeed: physicsConfig.maxSpeed,
  acceleration: physicsConfig.accel,
  hapticsEnabled: true,
  trailEnabled: false,
  trailDefaultVersion: 2,
  fullscreenEnabled: appConfig.fullscreenOnStart,
  fpsEnabled: false,
  statsEnabled: false,
};

export const persistedSettingsKeys = Object.keys(settingsConfig);

export const settingsControls = {
  maxSpeed: {
    min: 8,
    max: 24,
    step: 1,
  },
  acceleration: {
    min: 0.06,
    max: 0.18,
    step: 0.005,
  },
};
