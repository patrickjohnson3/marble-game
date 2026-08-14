import assert from "node:assert/strict";
import { createIntroSequence } from "../core/intro-sequence.js";

function fakeClassList() {
  const classes = new Set();
  return {
    add(...names) {
      names.forEach((name) => classes.add(name));
    },
    contains(name) {
      return classes.has(name);
    },
    remove(...names) {
      names.forEach((name) => classes.delete(name));
    },
  };
}

function fakeMessageOverlay() {
  return {
    classList: fakeClassList(),
    textContent: "",
    replaceChildren(...children) {
      this.children = children;
    },
  };
}

function testPausedCountdownTimeoutCanResume() {
  const callbacks = [];
  let now = 1000;
  let released = false;

  const setTimeoutFn = (callback) => {
    callbacks.push(callback);
    return callbacks.length;
  };
  const intro = { released: false };
  const introSequenceState = {
    started: true,
    sequenceStage: "releaseCountdown",
    messageTimer: 0,
    countdownTimer: 0,
    countdownValue: 2,
    timerStartedAt: 0,
    timerDelayMs: 0,
  };
  const game = { paused: true };
  const sequence = createIntroSequence({
    intro,
    sequence: introSequenceState,
    game,
    timing: { introReleaseDelayMs: 2000, countdownTickMs: 1000 },
    messageOverlay: fakeMessageOverlay(),
    clearTimeoutFn() {},
    createElement() {
      return { className: "", textContent: "" };
    },
    now: () => now,
    onRelease() {
      released = true;
    },
    setTimeoutFn,
  });

  sequence.resume();
  callbacks.shift()();

  assert.equal(introSequenceState.sequenceStage, "releaseCountdown");
  assert.equal(introSequenceState.timerDelayMs, 1000);
  assert.equal(introSequenceState.countdownValue, 2);
  assert.equal(released, false);

  game.paused = false;
  now = 2000;
  sequence.resume();
  callbacks.shift()();
  assert.equal(introSequenceState.countdownValue, 1);
}

testPausedCountdownTimeoutCanResume();

console.log("Intro sequence tests passed.");
