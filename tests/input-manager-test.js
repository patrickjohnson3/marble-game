import assert from "node:assert/strict";
import { createInputManager } from "../input/input-manager.js";

const target = new globalThis.EventTarget();
const gameEl = new globalThis.EventTarget();
const startBtn = new globalThis.EventTarget();
const eventTargets = {
  deviceorientation: target,
  devicemotion: target,
  keydown: target,
  keyup: target,
  blur: target,
  pointerdown: gameEl,
  pointermove: gameEl,
  pointerup: gameEl,
  pointercancel: gameEl,
  click: startBtn,
};
const calls = Object.fromEntries(
  Object.keys(eventTargets).map((type) => [type, 0]),
);
function record(event) {
  calls[event.type] += 1;
  if (event.type === "keydown") event.preventDefault();
}
const inputManager = createInputManager({
  target,
  gameEl,
  startBtn,
  onOrientation: record,
  onMotion: record,
  onKeyDown: record,
  onKeyUp: record,
  onBlur: record,
  onPointerDown: record,
  onPointerMove: record,
  onPointerEnd: record,
  onStartClick: record,
});

function dispatchAll(expectedCalls, active) {
  for (const [type, eventTarget] of Object.entries(eventTargets)) {
    const event = new globalThis.Event(type, { cancelable: true });
    eventTarget.dispatchEvent(event);
    assert.equal(calls[type], expectedCalls, `${type} callback count`);
    if (type === "keydown") {
      assert.equal(
        event.defaultPrevented,
        active,
        "keyboard input can prevent scrolling",
      );
    }
  }
}

// Cleanup is safe before registration, and a manager can be enabled again.
inputManager.destroy();
inputManager.destroy();
dispatchAll(0, false);
for (let cycle = 1; cycle <= 2; cycle++) {
  for (let repeat = 0; repeat < 2; repeat++) {
    inputManager.enableMotion();
    inputManager.enableKeyboard();
    inputManager.enableGestures();
    inputManager.bindStartButton();
  }
  dispatchAll(cycle, true);
  inputManager.destroy();
  inputManager.destroy();
  dispatchAll(cycle, false);
}

console.log("Input manager tests passed.");
