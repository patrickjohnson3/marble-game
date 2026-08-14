import assert from "node:assert/strict";
import { createFakeDocument } from "./test-dom.js";
import { createApp } from "../app.js";

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
    document.getElementById("settingsTitle").textContent,
    "Settings",
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
