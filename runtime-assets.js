export const runtimeScripts = [
  "app.js",
  "app-config.js",
  "app-setup.js",
  "boot.js",
  "camera.js",
  "config.js",
  "copy.js",
  "debug.js",
  "dom-ids.js",
  "dom.js",
  "effects.js",
  "frame-loop.js",
  "game-loop.js",
  "game-controller.js",
  "game-lifecycle.js",
  "geometry.js",
  "haptics.js",
  "haptic-config.js",
  "input-manager.js",
  "intro-sequence.js",
  "intro-timers.js",
  "keyboard-controller.js",
  "map.js",
  "map-config.js",
  "map-renderer.js",
  "marble-view.js",
  "physics.js",
  "physics-config.js",
  "platform.js",
  "rendering.js",
  "sensor-controller.js",
  "sensor-watchdog.js",
  "settings-applier.js",
  "settings-panel.js",
  "settings-config.js",
  "settings-runtime.js",
  "settings-store.js",
  "state.js",
  "terrain-view.js",
  "timer-utils.js",
  "timing-config.js",
  "trail.js",
  "ui.js",
  "viewport.js",
  "visual-config.js"
];

export const runtimeModuleScripts = runtimeScripts.filter((script) => script !== "app.js");

export const runtimeStyles = [
  "style.css"
];

export const runtimeFiles = [
  ...runtimeScripts,
  ...runtimeStyles
];
