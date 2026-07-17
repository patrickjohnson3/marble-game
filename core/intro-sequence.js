import {
  pauseIntroTimerState,
  resumeIntroTimerAction,
  trackIntroTimer
} from "./intro-timers.js";
import { copy } from "./copy.js";

export function createIntroSequence({
  intro,
  game,
  timing,
  messageOverlay,
  onRelease,
  createElement = (tag) => document.createElement(tag)
}) {
  function clearTimers() {
    clearTimeout(intro.messageTimer);
    clearTimeout(intro.countdownTimer);
    intro.messageTimer = 0;
    intro.countdownTimer = 0;
  }

  function hideMessage() {
    messageOverlay.classList.remove("show");
  }

  function showReleaseCountdown() {
    const countdown = createElement("span");
    countdown.className = "countdown";
    countdown.textContent = intro.countdownValue;
    messageOverlay.replaceChildren(copy.intro.countdown, countdown);
    messageOverlay.classList.add("show", "releaseCountdown");
  }

  function scheduleReleaseTick(delay = timing.countdownTickMs) {
    clearTimers();
    trackIntroTimer(intro, "releaseCountdown", delay, performance.now());
    intro.countdownTimer = setTimeout(() => {
      if (game.paused) {
        intro.countdownTimer = 0;
        trackIntroTimer(intro, "releaseCountdown", timing.countdownTickMs, performance.now());
        return;
      }

      intro.countdownValue--;
      if (intro.countdownValue <= 0) {
        intro.countdownTimer = 0;
        intro.sequenceStage = "idle";
        onRelease();
        return;
      }

      showReleaseCountdown();
      scheduleReleaseTick();
    }, delay);
  }

  function schedule() {
    if (intro.started) return;

    intro.started = true;
    intro.countdownValue = Math.ceil(timing.introReleaseDelayMs / timing.countdownTickMs);
    showReleaseCountdown();
    scheduleReleaseTick();
  }

  function pause() {
    const hadActiveTimer = pauseIntroTimerState(intro, performance.now());
    if (hadActiveTimer) clearTimers();
  }

  function resume() {
    const delay = Math.max(0, intro.timerDelayMs);
    const action = resumeIntroTimerAction(intro);
    if (action === "releaseCountdown") {
      showReleaseCountdown();
      scheduleReleaseTick(delay);
    }
  }

  return {
    clearTimers,
    hideMessage,
    pause,
    resume,
    schedule
  };
}
