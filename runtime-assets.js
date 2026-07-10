export const runtimeScripts = [
  "app.js",
  "boot.js",
  "core/app-config.js",
  "core/app-setup.js",
  "core/camera.js",
  "core/config.js",
  "core/copy.js",
  "core/debug.js",
  "core/dom-ids.js",
  "core/dom.js",
  "core/frame-loop.js",
  "core/game-controller.js",
  "core/game-lifecycle.js",
  "core/game-loop.js",
  "core/geometry.js",
  "core/haptic-config.js",
  "core/haptics.js",
  "core/intro-sequence.js",
  "core/intro-timers.js",
  "core/map-config.js",
  "core/map-progression.js",
  "core/map-reachability.js",
  "core/map-validation.js",
  "core/map.js",
  "core/physics-collisions.js",
  "core/physics-config.js",
  "core/physics.js",
  "core/state.js",
  "core/timer-utils.js",
  "core/timing-config.js",
  "core/visual-config.js",
  "input/input-manager.js",
  "input/keyboard-controller.js",
  "input/sensor-controller.js",
  "input/sensor-watchdog.js",
  "platform/platform.js",
  "platform/viewport.js",
  "rendering/effects.js",
  "rendering/map-renderer.js",
  "rendering/marble-view.js",
  "rendering/rendering.js",
  "rendering/terrain-view.js",
  "rendering/trail.js",
  "rendering/ui.js",
  "settings/settings-applier.js",
  "settings/settings-config.js",
  "settings/settings-panel.js",
  "settings/settings-runtime.js",
  "settings/settings-store.js"
];

export const runtimeModuleScripts = runtimeScripts.filter((script) => script !== "app.js");

export const runtimeStyles = [
  "style.css"
];

export const runtimeFiles = [
  ...runtimeScripts,
  ...runtimeStyles
];
