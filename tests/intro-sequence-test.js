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
    }
  };
}

function fakeMessageOverlay() {
  return {
    classList: fakeClassList(),
    textContent: "",
    replaceChildren(...children) {
      this.children = children;
    }
  };
}

function testPausedCountdownTimeoutCanResume() {
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  const originalPerformance = globalThis.performance;
  const callbacks = [];
  let now = 1000;
  let released = false;

  globalThis.setTimeout = (callback) => {
    callbacks.push(callback);
    return callbacks.length;
  };
  globalThis.clearTimeout = () => {};
  globalThis.performance = {
    now() {
      return now;
    }
  };

  try {
    const intro = {
      started: true,
      released: false,
      sequenceStage: "releaseCountdown",
      messageTimer: 0,
      countdownTimer: 0,
      countdownValue: 2,
      timerStartedAt: 0,
      timerDelayMs: 0
    };
    const game = { paused: true };
    const sequence = createIntroSequence({
      intro,
      game,
      timing: {
        introReleaseDelayMs: 2000,
        countdownTickMs: 1000
      },
      messageOverlay: fakeMessageOverlay(),
      createElement() {
        return { className: "", textContent: "" };
      },
      onRelease() {
        released = true;
      }
    });

    sequence.resume();
    callbacks.shift()();

    assert.equal(intro.sequenceStage, "releaseCountdown");
    assert.equal(intro.timerDelayMs, 1000);
    assert.equal(intro.countdownValue, 2);
    assert.equal(released, false);

    game.paused = false;
    now = 2000;
    sequence.resume();
    callbacks.shift()();
    assert.equal(intro.countdownValue, 1);
  } finally {
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
    globalThis.performance = originalPerformance;
  }
}

testPausedCountdownTimeoutCanResume();

console.log("Intro sequence tests passed.");
