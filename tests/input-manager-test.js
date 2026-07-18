import assert from "node:assert/strict";
import { createInputManager } from "../input/input-manager.js";

function createTarget() {
  const listeners = [];
  const removedListeners = [];

  return {
    listeners,
    removedListeners,
    addEventListener(type, listener, options) {
      listeners.push({ type, listener, options });
    },
    removeEventListener(type, listener, options) {
      removedListeners.push({ type, listener, options });
    },
  };
}

const target = createTarget();
const gameEl = createTarget();
const startBtn = createTarget();

const inputManager = createInputManager({
  target,
  gameEl,
  startBtn,
  onOrientation() {},
  onMotion() {},
  onKeyDown() {},
  onKeyUp() {},
  onPointerDown() {},
  onPointerMove() {},
  onPointerEnd() {},
  onStartClick() {},
});

inputManager.enableMotion();
inputManager.enableMotion();
assert.deepEqual(
  target.listeners.map((listener) => listener.type),
  ["deviceorientation", "devicemotion"],
);

inputManager.enableKeyboard();
inputManager.enableKeyboard();
assert.deepEqual(
  target.listeners.map((listener) => listener.type),
  ["deviceorientation", "devicemotion", "keydown", "keyup"],
);

inputManager.enableGestures();
inputManager.enableGestures();
assert.deepEqual(
  gameEl.listeners.map((listener) => listener.type),
  ["pointerdown", "pointermove", "pointerup", "pointercancel"],
);

inputManager.bindStartButton();
inputManager.bindStartButton();
assert.deepEqual(
  startBtn.listeners.map((listener) => listener.type),
  ["click"],
);

inputManager.destroy();
inputManager.destroy();
assert.deepEqual(
  target.removedListeners.map((listener) => listener.type),
  ["deviceorientation", "devicemotion", "keydown", "keyup"],
);
assert.deepEqual(
  gameEl.removedListeners.map((listener) => listener.type),
  ["pointerdown", "pointermove", "pointerup", "pointercancel"],
);
assert.deepEqual(
  startBtn.removedListeners.map((listener) => listener.type),
  ["click"],
);

console.log("Input manager tests passed.");
