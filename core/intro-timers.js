export function resetIntroTimerState(intro) {
  intro.sequenceStage = "idle";
  intro.timerStartedAt = 0;
  intro.timerDelayMs = 0;
}

export function trackIntroTimer(intro, stage, delay, now) {
  intro.sequenceStage = stage;
  intro.timerStartedAt = now;
  intro.timerDelayMs = delay;
}

export function pauseIntroTimerState(intro, now) {
  if (!intro.started || intro.released || intro.sequenceStage === "idle")
    return false;

  const elapsed = now - intro.timerStartedAt;
  intro.timerDelayMs = Math.max(0, intro.timerDelayMs - elapsed);
  return true;
}

export function resumeIntroTimerAction(intro) {
  if (!intro.started || intro.released) return null;

  if (intro.sequenceStage === "releaseCountdown") return "releaseCountdown";
  return null;
}

export function shouldPauseGame(game) {
  return !game.paused && game.phase !== "waiting";
}
