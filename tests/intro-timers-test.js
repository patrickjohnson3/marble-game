import assert from "node:assert/strict";
import {
  pauseIntroTimerState,
  resetIntroTimerState,
  resumeIntroTimerAction,
  shouldPauseGame,
  trackIntroTimer,
} from "../core/intro-timers.js";

function introState(overrides = {}) {
  return {
    released: false,
    ...overrides,
  };
}

function introSequenceState(overrides = {}) {
  return {
    started: true,
    sequenceStage: "idle",
    timerStartedAt: 0,
    timerDelayMs: 0,
    ...overrides,
  };
}

function testReleaseCountdownPausesRemainingDelay() {
  const intro = introState();
  const sequence = introSequenceState();

  trackIntroTimer(sequence, "releaseCountdown", 6000, 1000);
  const paused = pauseIntroTimerState(intro, sequence, 3500);

  assert.equal(paused, true);
  assert.equal(sequence.sequenceStage, "releaseCountdown");
  assert.equal(sequence.timerDelayMs, 3500);
  assert.equal(resumeIntroTimerAction(intro, sequence), "releaseCountdown");
}

function testCountdownTickResumesNextTick() {
  const intro = introState();
  const sequence = introSequenceState();

  trackIntroTimer(sequence, "countdown", 1000, 5000);
  pauseIntroTimerState(intro, sequence, 5750);

  assert.equal(sequence.timerDelayMs, 250);
  assert.equal(resumeIntroTimerAction(intro, sequence), null);
}

function testReleasedIntroDoesNotResume() {
  const intro = introState({ released: true });
  const sequence = introSequenceState();

  trackIntroTimer(sequence, "countdown", 1000, 0);

  assert.equal(pauseIntroTimerState(intro, sequence, 500), false);
  assert.equal(resumeIntroTimerAction(intro, sequence), null);
}

function testIdleIntroDoesNotPause() {
  const intro = introState();
  const sequence = introSequenceState();

  resetIntroTimerState(sequence);

  assert.equal(pauseIntroTimerState(intro, sequence, 500), false);
  assert.equal(resumeIntroTimerAction(intro, sequence), null);
}

function testShouldPauseOnlyStartedUnpausedGame() {
  assert.equal(shouldPauseGame({ phase: "waiting", paused: false }), false);
  assert.equal(shouldPauseGame({ phase: "running", paused: true }), false);
  assert.equal(shouldPauseGame({ phase: "running", paused: false }), true);
}

testReleaseCountdownPausesRemainingDelay();
testCountdownTickResumesNextTick();
testReleasedIntroDoesNotResume();
testIdleIntroDoesNotPause();
testShouldPauseOnlyStartedUnpausedGame();

console.log("Intro timer tests passed.");
