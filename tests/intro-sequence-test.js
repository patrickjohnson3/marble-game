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

function testCountdownReleasesMapExactlyOnce() {
  const callbacks = [];
  let now = 0;
  let releaseCount = 0;
  const intro = { released: false };
  const introSequenceState = {
    started: false,
    sequenceStage: "idle",
    countdownTimer: 0,
    countdownValue: 0,
    timerStartedAt: 0,
    timerDelayMs: 0,
  };
  const messageOverlay = fakeMessageOverlay();
  const sequence = createIntroSequence({
    intro,
    sequence: introSequenceState,
    game: { paused: false },
    timing: { introReleaseDelayMs: 3000, countdownTickMs: 1000 },
    messageOverlay,
    clearTimeoutFn() {},
    createElement() {
      return { className: "", textContent: "" };
    },
    now: () => now,
    onRelease() {
      releaseCount++;
      intro.released = true;
    },
    setTimeoutFn(callback) {
      callbacks.push(callback);
      return callbacks.length;
    },
  });

  sequence.schedule();
  sequence.schedule();
  assert.equal(callbacks.length, 1, "schedule must be idempotent");
  assert.equal(introSequenceState.countdownValue, 3);
  assert.equal(messageOverlay.children[1].textContent, 3);

  now = 1000;
  callbacks.shift()();
  assert.equal(introSequenceState.countdownValue, 2);
  assert.equal(messageOverlay.children[1].textContent, 2);

  now = 2000;
  callbacks.shift()();
  assert.equal(introSequenceState.countdownValue, 1);
  assert.equal(messageOverlay.children[1].textContent, 1);

  now = 3000;
  callbacks.shift()();
  assert.equal(releaseCount, 1);
  assert.equal(intro.released, true);
  assert.equal(introSequenceState.countdownValue, 0);
  assert.equal(introSequenceState.countdownTimer, 0);
  assert.equal(introSequenceState.sequenceStage, "idle");
  assert.equal(callbacks.length, 0);

  sequence.schedule();
  assert.equal(releaseCount, 1);
  assert.equal(callbacks.length, 0);
}

testPausedCountdownTimeoutCanResume();
testCountdownReleasesMapExactlyOnce();

function testPausePreservesDelayAndResetRestoresInitialState() {
  const scheduledDelays = [];
  const clearedTimers = [];
  let now = 0;
  const intro = { released: false };
  const state = {
    started: false,
    sequenceStage: "idle",
    countdownTimer: 0,
    countdownValue: 0,
    timerStartedAt: 0,
    timerDelayMs: 0,
  };
  const sequence = createIntroSequence({
    intro,
    sequence: state,
    game: { paused: false },
    timing: { introReleaseDelayMs: 3000, countdownTickMs: 1000 },
    messageOverlay: fakeMessageOverlay(),
    clearTimeoutFn(timer) {
      clearedTimers.push(timer);
    },
    createElement() {
      return { className: "", textContent: "" };
    },
    now: () => now,
    onRelease() {},
    setTimeoutFn(_callback, delay) {
      scheduledDelays.push(delay);
      return scheduledDelays.length;
    },
  });

  sequence.schedule();
  now = 400;
  sequence.pause();
  assert.equal(state.timerDelayMs, 600);
  assert.equal(clearedTimers.includes(1), true);

  sequence.resume();
  assert.equal(scheduledDelays.at(-1), 600);

  sequence.reset();
  assert.deepEqual(
    {
      countdownTimer: state.countdownTimer,
      countdownValue: state.countdownValue,
      sequenceStage: state.sequenceStage,
      started: state.started,
      timerDelayMs: state.timerDelayMs,
      timerStartedAt: state.timerStartedAt,
    },
    {
      countdownTimer: 0,
      countdownValue: 3,
      sequenceStage: "idle",
      started: false,
      timerDelayMs: 0,
      timerStartedAt: 0,
    },
  );
}

testPausePreservesDelayAndResetRestoresInitialState();

console.log("Intro sequence tests passed.");
