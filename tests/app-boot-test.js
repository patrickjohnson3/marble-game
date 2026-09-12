import assert from "node:assert/strict";
import { createFakeDocument } from "./test-dom.js";
import { createApp } from "../app.js";
import { baseMapConfig } from "../core/map-config.js";
import { resolveMapVariantConfig } from "../core/map-variants.js";

const originalGlobals = {
  addEventListener: Object.getOwnPropertyDescriptor(
    globalThis,
    "addEventListener",
  ),
  document: Object.getOwnPropertyDescriptor(globalThis, "document"),
  innerHeight: Object.getOwnPropertyDescriptor(globalThis, "innerHeight"),
  innerWidth: Object.getOwnPropertyDescriptor(globalThis, "innerWidth"),
  localStorage: Object.getOwnPropertyDescriptor(globalThis, "localStorage"),
  navigator: Object.getOwnPropertyDescriptor(globalThis, "navigator"),
  requestAnimationFrame: Object.getOwnPropertyDescriptor(
    globalThis,
    "requestAnimationFrame",
  ),
  screen: Object.getOwnPropertyDescriptor(globalThis, "screen"),
  setTimeout: Object.getOwnPropertyDescriptor(globalThis, "setTimeout"),
  clearTimeout: Object.getOwnPropertyDescriptor(globalThis, "clearTimeout"),
  window: Object.getOwnPropertyDescriptor(globalThis, "window"),
};

function setTestGlobal(name, value) {
  Object.defineProperty(globalThis, name, {
    configurable: true,
    writable: true,
    value,
  });
}

const document = createFakeDocument();
setTestGlobal("addEventListener", () => {});
setTestGlobal("document", document);
setTestGlobal("innerHeight", 844);
setTestGlobal("innerWidth", 390);
setTestGlobal("localStorage", {
  getItem() {
    return null;
  },
  setItem() {},
});
setTestGlobal("navigator", {});
setTestGlobal("requestAnimationFrame", () => 1);
setTestGlobal("screen", { orientation: { angle: 0 } });
setTestGlobal("setTimeout", () => 1);
setTestGlobal("clearTimeout", () => {});
setTestGlobal("window", globalThis);

try {
  const app = createApp({
    document,
    window: globalThis,
    storage: globalThis.localStorage,
  });
  assert.equal(globalThis.__marbleAppBooted, true);
  assert.equal(
    app.kitchenDynamics.state.ants.length,
    10,
    "boot initializes objective targets before Start",
  );
  assert.equal(
    document.getElementById("objectiveStatus").textContent,
    "Kill all ants · 10 left",
  );
  assert.equal(
    document.getElementById("settingsTitle").textContent,
    "Settings",
  );
  assert.equal(
    document.getElementById("gameplaySettingsTitle").textContent,
    "Gameplay",
  );
  assert.equal(
    document.getElementById("deviceSettingsTitle").textContent,
    "Device",
  );
  assert.equal(
    document.getElementById("diagnosticsSettingsTitle").textContent,
    "Diagnostics",
  );
  assert.equal(
    document.getElementById("controlsHelpTitle").textContent,
    "Controls & map",
  );
  assert.equal(
    document.getElementById("cameraHelp").textContent,
    "Pinch to zoom. Drag with two fingers to pan.",
  );
  assert.equal(
    document.getElementById("goalHelp").textContent,
    "Kill all kitchen ants, reach the living-room exit, or hold inside the green goal. Your current objective is shown above.",
  );
  assert.equal(
    document.getElementById("resetSpeedSetting").textContent,
    "reset",
  );
  assert.equal(
    document.getElementById("resetSensitivitySetting").textContent,
    "reset",
  );
  assert.equal(
    document.getElementById("levelLabel").textContent,
    "level 1: kitchen floor",
  );
  assert.equal(document.getElementById("resumeGame").textContent, "resume");
  assert.equal(
    document.getElementById("installApp").textContent,
    "install app",
  );

  const startButton = document.getElementById("start");
  const startListener = startButton.listeners.find(
    (listener) => listener.type === "click",
  );
  await startListener.listener();

  assert.equal(app.state.game.phase, "calibrating");
  assert.equal(app.state.input.sensor.permission, "granted");
  assert.equal(document.getElementById("controls").hidden, true);

  const livingDocument = createFakeDocument();
  setTestGlobal("document", livingDocument);
  const initialMap = resolveMapVariantConfig(baseMapConfig, "living-room");
  const livingApp = createApp({
    document: livingDocument,
    window: globalThis,
    storage: globalThis.localStorage,
    initialMap,
  });
  assert.equal(livingApp.mapRuntime.state.activeMap.variantId, "living-room");
  assert.equal(livingApp.state.marble.x, initialMap.spawn.x);
  assert.equal(livingApp.kitchenDynamics.state.ants.length, 0);
  assert.equal(
    livingDocument.getElementById("objectiveStatus").textContent,
    "Reach the exit doorway",
  );
  await livingApp.gameController.start();
  assert.equal(
    livingApp.mapRuntime.state.activeMap.variantId,
    "living-room",
    "Start preserves an authoring tool's selected map",
  );
} finally {
  for (const [key, descriptor] of Object.entries(originalGlobals)) {
    if (descriptor === undefined) {
      delete globalThis[key];
    } else {
      Object.defineProperty(globalThis, key, descriptor);
    }
  }
}

console.log("App boot tests passed.");
