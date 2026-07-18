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
    started: true,
    released: false,
    sequenceStage: "idle",
    timerStartedAt: 0,
    timerDelayMs: 0,
    ...overrides,
  };
}

function testReleaseCountdownPausesRemainingDelay() {
  const intro = introState();

  trackIntroTimer(intro, "releaseCountdown", 6000, 1000);
  const paused = pauseIntroTimerState(intro, 3500);

  assert.equal(paused, true);
  assert.equal(intro.sequenceStage, "releaseCountdown");
  assert.equal(intro.timerDelayMs, 3500);
  assert.equal(resumeIntroTimerAction(intro), "releaseCountdown");
}

function testCountdownTickResumesNextTick() {
  const intro = introState();

  trackIntroTimer(intro, "countdown", 1000, 5000);
  pauseIntroTimerState(intro, 5750);

  assert.equal(intro.timerDelayMs, 250);
  assert.equal(resumeIntroTimerAction(intro), null);
}

function testReleasedIntroDoesNotResume() {
  const intro = introState({ released: true });

  trackIntroTimer(intro, "countdown", 1000, 0);

  assert.equal(pauseIntroTimerState(intro, 500), false);
  assert.equal(resumeIntroTimerAction(intro), null);
}

function testIdleIntroDoesNotPause() {
  const intro = introState();

  resetIntroTimerState(intro);

  assert.equal(pauseIntroTimerState(intro, 500), false);
  assert.equal(resumeIntroTimerAction(intro), null);
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
