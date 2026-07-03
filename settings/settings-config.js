import { appConfig } from "../core/app-config.js";
import { physicsConfig } from "../core/physics-config.js";

export const settingsConfig = {
  maxSpeed: physicsConfig.maxSpeed,
  acceleration: physicsConfig.accel,
  rotationEnabled: false,
  hapticsEnabled: true,
  trailEnabled: false,
  trailDefaultVersion: 2,
  fullscreenEnabled: appConfig.fullscreenOnStart,
  cameraMode: "follow"
};

export const cameraModes = [
  "follow",
  "lockedCenter",
  "predictiveLookAhead"
];

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
  },
  cameraModes
};
