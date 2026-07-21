import { GAME_PHASES } from "./runtime-states.js";

export function resetIntroTimerState(sequence) {
  sequence.sequenceStage = "idle";
  sequence.timerStartedAt = 0;
  sequence.timerDelayMs = 0;
}

export function trackIntroTimer(sequence, stage, delay, now) {
  sequence.sequenceStage = stage;
  sequence.timerStartedAt = now;
  sequence.timerDelayMs = delay;
}

export function pauseIntroTimerState(intro, sequence, now) {
  if (!sequence.started || intro.released || sequence.sequenceStage === "idle")
    return false;

  const elapsed = now - sequence.timerStartedAt;
  sequence.timerDelayMs = Math.max(0, sequence.timerDelayMs - elapsed);
  return true;
}

export function resumeIntroTimerAction(intro, sequence) {
  if (!sequence.started || intro.released) return null;

  if (sequence.sequenceStage === "releaseCountdown") return "releaseCountdown";
  return null;
}

export function shouldPauseGame(game) {
  return !game.paused && game.phase !== GAME_PHASES.waiting;
}
