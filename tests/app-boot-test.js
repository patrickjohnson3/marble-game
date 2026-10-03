import assert from "node:assert/strict";
import { createFakeDocument } from "./test-dom.js";
import { createApp } from "../app.js";
import { baseMapConfig } from "../core/map-config.js";
import { resolveMapVariantConfig } from "../core/map-variants.js";
import { settingsConfig } from "../settings/settings-config.js";

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
const frames = [];
const vibrations = [];
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
setTestGlobal("navigator", {
  vibrate(pattern) {
    vibrations.push(pattern);
    return true;
  },
});
setTestGlobal("requestAnimationFrame", (callback) => {
  frames.push(callback);
  return frames.length;
});
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
    document.getElementById("appVersion").textContent,
    "Release development",
  );
  assert.equal(document.getElementById("checkAppUpdates").disabled, true);
  assert.equal(document.getElementById("updateApp").hidden, true);
  const mapSelect = document.getElementById("mapSelect");
  assert.deepEqual(
    mapSelect.children.map((option) => option.value),
    baseMapConfig.variants.map((variant) => variant.id),
    "all registered maps should be selectable, including generated maps",
  );
  assert.ok(
    mapSelect.children.every(
      (option) =>
        typeof option.textContent === "string" && option.textContent.length > 0,
    ),
  );
  assert.equal(mapSelect.value, app.mapRuntime.state.activeMap.variantId);
  assert.equal(mapSelect.disabled, true);
  assert.equal(document.getElementById("loadMap").disabled, true);
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
    "Pinch to zoom. Drag with two fingers to pan. Or open Camera to zoom, pan nearby, or center on the marble.",
  );
  assert.equal(
    document.getElementById("goalHelp").textContent,
    "Kill all kitchen ants, then choose Next room when ready. Defeat the living-room mouse and reach its exit, or hold inside the green goal. Your current objective is shown above. The Mouse arrow points from your marble toward a distant mouse automatically.",
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
  const savedSettings = { maxSpeed: 18, acceleration: 0.09 };
  const storedSettings = new Map([
    ["marbleGameSettings", JSON.stringify(savedSettings)],
  ]);
  const storage = {
    getItem(key) {
      return storedSettings.get(key) ?? null;
    },
    setItem(key, value) {
      storedSettings.set(key, value);
    },
  };
  const livingApp = createApp({
    document: livingDocument,
    window: globalThis,
    storage,
    initialMap,
  });
  assert.deepEqual(
    {
      maxSpeed: livingApp.state.physics.maxSpeed,
      acceleration: livingApp.state.physics.accel,
    },
    savedSettings,
    "both saved control preferences must reach live physics on boot",
  );
  const rangeSettings = [
    ["maxSpeed", "maxSpeed", "speedSetting", "resetSpeedSetting", 20],
    [
      "acceleration",
      "accel",
      "sensitivitySetting",
      "resetSensitivitySetting",
      0.15,
    ],
  ];
  for (const [setting, physicsKey, inputId, , value] of rangeSettings) {
    const input = livingDocument.getElementById(inputId);
    input.value = String(value);
    input.listeners.find(({ type }) => type === "input").listener();
    assert.equal(
      livingApp.state.physics[physicsKey],
      value,
      `${setting} input must change live physics`,
    );
    assert.equal(
      JSON.parse(storage.getItem("marbleGameSettings"))[setting],
      value,
      `${setting} input must save under the established storage key`,
    );
  }
  const trailInput = livingDocument.getElementById("trailSetting");
  trailInput.checked = true;
  trailInput.listeners.find(({ type }) => type === "change").listener();
  const hapticsInput = livingDocument.getElementById("hapticsSetting");
  hapticsInput.checked = false;
  hapticsInput.listeners.find(({ type }) => type === "change").listener();
  assert.equal(
    JSON.parse(storage.getItem("marbleGameSettings")).hapticsEnabled,
    false,
    "disabling haptics must save the preference",
  );

  const reopenedDocument = createFakeDocument();
  setTestGlobal("document", reopenedDocument);
  const reopenedApp = createApp({
    document: reopenedDocument,
    window: globalThis,
    storage,
    initialMap,
  });
  const tick = frames.at(-1);
  for (const [setting, physicsKey, inputId, , value] of rangeSettings) {
    assert.equal(
      reopenedApp.state.physics[physicsKey],
      value,
      `${setting} UI change must survive a fresh application boot`,
    );
    assert.equal(Number(reopenedDocument.getElementById(inputId).value), value);
  }
  assert.equal(reopenedDocument.getElementById("trailSetting").checked, true);

  const reopenedHaptics = reopenedDocument.getElementById("hapticsSetting");
  assert.equal(reopenedHaptics.checked, false);
  reopenedApp.state.game.phase = "running";
  reopenedApp.state.intro.released = true;
  Object.assign(reopenedApp.state.bounds, {
    left: 0,
    top: 0,
    right: initialMap.world.width,
    bottom: initialMap.world.height,
  });
  function hitLeftBoundary() {
    const { marble, haptics } = reopenedApp.state;
    Object.assign(marble, { x: marble.r, y: 1000, vx: -10, vy: 0 });
    // Make the contact eligible regardless of wall-clock timing between frames.
    haptics.impact.lastPulse = Number.NEGATIVE_INFINITY;
    tick();
    assert.ok(
      marble.vx > 0,
      "the scheduled gameplay frame must resolve the hit",
    );
  }
  hitLeftBoundary();
  assert.deepEqual(
    vibrations,
    [],
    "a saved disabled preference must suppress actual collision feedback on boot",
  );
  for (const enabled of [true, false]) {
    vibrations.length = 0;
    reopenedHaptics.checked = enabled;
    reopenedHaptics.listeners.find(({ type }) => type === "change").listener();
    hitLeftBoundary();
    assert.equal(
      vibrations.length > 0,
      enabled,
      "the Haptics checkbox must control platform vibration requests",
    );
    assert.equal(
      JSON.parse(storage.getItem("marbleGameSettings")).hapticsEnabled,
      enabled,
    );
  }

  setTestGlobal("document", livingDocument);
  for (const [setting, physicsKey, , resetId] of rangeSettings) {
    livingDocument
      .getElementById(resetId)
      .listeners.find(({ type }) => type === "click")
      .listener();
    assert.equal(
      livingApp.state.physics[physicsKey],
      settingsConfig[setting],
      `${setting} reset must restore live physics defaults`,
    );
    assert.equal(
      JSON.parse(storage.getItem("marbleGameSettings"))[setting],
      settingsConfig[setting],
      `${setting} reset must persist its default`,
    );
  }

  const resetDocument = createFakeDocument();
  setTestGlobal("document", resetDocument);
  const resetApp = createApp({
    document: resetDocument,
    window: globalThis,
    storage,
    initialMap,
  });
  for (const [setting, physicsKey, inputId] of rangeSettings) {
    assert.equal(
      resetApp.state.physics[physicsKey],
      settingsConfig[setting],
      `${setting} reset must survive a fresh application boot`,
    );
    assert.equal(
      Number(resetDocument.getElementById(inputId).value),
      settingsConfig[setting],
    );
  }
  assert.equal(
    resetDocument.getElementById("trailSetting").checked,
    true,
    "range resets must preserve the separately saved trail preference",
  );
  setTestGlobal("document", livingDocument);
  assert.equal(livingApp.mapRuntime.state.activeMap.variantId, "living-room");
  assert.equal(livingApp.state.marble.x, initialMap.spawn.x);
  assert.equal(livingApp.kitchenDynamics.state.ants.length, 0);
  assert.equal(
    livingDocument.getElementById("objectiveStatus").textContent,
    "Defeat the mouse · Roll fast to hit harder",
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
