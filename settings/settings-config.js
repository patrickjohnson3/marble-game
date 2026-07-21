import { appConfig, physicsConfig } from "../core/game-config.js";

const numericSettingControls = {
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

export const settingsSchema = Object.freeze({
  maxSpeed: Object.freeze({
    defaultValue: physicsConfig.maxSpeed,
    type: "number",
    control: numericSettingControls.maxSpeed,
  }),
  acceleration: Object.freeze({
    defaultValue: physicsConfig.accel,
    type: "number",
    control: numericSettingControls.acceleration,
  }),
  hapticsEnabled: Object.freeze({
    defaultValue: true,
    type: "boolean",
  }),
  trailEnabled: Object.freeze({
    defaultValue: false,
    type: "boolean",
  }),
  trailDefaultVersion: Object.freeze({
    defaultValue: 2,
    type: "number",
  }),
  fullscreenEnabled: Object.freeze({
    defaultValue: appConfig.fullscreenOnStart,
    type: "boolean",
  }),
  fpsEnabled: Object.freeze({
    defaultValue: false,
    type: "boolean",
  }),
  statsEnabled: Object.freeze({
    defaultValue: false,
    type: "boolean",
  }),
});

export const settingsConfig = Object.fromEntries(
  Object.entries(settingsSchema).map(([key, config]) => [
    key,
    config.defaultValue,
  ]),
);

export const persistedSettingsKeys = Object.keys(settingsSchema);

export const settingsControls = Object.fromEntries(
  Object.entries(settingsSchema)
    .filter(([, config]) => config.control)
    .map(([key, config]) => [key, config.control]),
);
