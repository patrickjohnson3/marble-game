import assert from "node:assert/strict";
import { createFakeDocument } from "./test-dom.js";
import { createApp } from "../app.js";

const originalGlobals = {
  addEventListener: globalThis.addEventListener,
  document: globalThis.document,
  innerHeight: globalThis.innerHeight,
  innerWidth: globalThis.innerWidth,
  localStorage: globalThis.localStorage,
  navigator: globalThis.navigator,
  requestAnimationFrame: globalThis.requestAnimationFrame,
  screen: globalThis.screen,
  window: globalThis.window
};

const document = createFakeDocument();
globalThis.addEventListener = () => {};
globalThis.document = document;
globalThis.innerHeight = 844;
globalThis.innerWidth = 390;
globalThis.localStorage = {
  getItem() {
    return null;
  },
  setItem() {}
};
globalThis.navigator = {};
globalThis.requestAnimationFrame = () => 1;
globalThis.screen = { orientation: { angle: 0 } };
globalThis.window = globalThis;

try {
  createApp({
    document,
    window: globalThis,
    storage: globalThis.localStorage
  });
  assert.equal(globalThis.__marbleAppBooted, true);
  assert.equal(document.getElementById("settingsTitle").textContent, "Settings");
  assert.equal(document.getElementById("resumeGame").textContent, "resume");
  assert.equal(
    document.getElementById("cameraModeSetting").querySelector('option[value="follow"]').textContent,
    "follow"
  );
  assert.equal(
    document.getElementById("cameraModeSetting").querySelector('option[value="lockedCenter"]').textContent,
    "locked center"
  );
  assert.equal(
    document.getElementById("cameraModeSetting").querySelector('option[value="predictiveLookAhead"]').textContent,
    "look-ahead"
  );
} finally {
  for (const [key, value] of Object.entries(originalGlobals)) {
    if (value === undefined) {
      delete globalThis[key];
    } else {
      globalThis[key] = value;
    }
  }
}

console.log("App boot tests passed.");
