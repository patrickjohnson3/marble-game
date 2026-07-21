import {
  pauseIntroTimerState,
  resumeIntroTimerAction,
  trackIntroTimer,
} from "./intro-timers.js";
import { copy } from "./copy.js";

export function createIntroSequence({
  intro,
  sequence,
  game,
  timing,
  messageOverlay,
  onRelease,
  createElement = (tag) => document.createElement(tag),
}) {
  function clearTimers() {
    clearTimeout(sequence.messageTimer);
    clearTimeout(sequence.countdownTimer);
    sequence.messageTimer = 0;
    sequence.countdownTimer = 0;
  }

  function hideMessage() {
    messageOverlay.classList.remove("show");
  }

  function showReleaseCountdown() {
    const countdown = createElement("span");
    countdown.className = "countdown";
    countdown.textContent = sequence.countdownValue;
    messageOverlay.replaceChildren(copy.intro.countdown, countdown);
    messageOverlay.classList.add("show", "releaseCountdown");
  }

  function scheduleReleaseTick(delay = timing.countdownTickMs) {
    clearTimers();
    trackIntroTimer(sequence, "releaseCountdown", delay, performance.now());
    sequence.countdownTimer = setTimeout(() => {
      if (game.paused) {
        sequence.countdownTimer = 0;
        trackIntroTimer(
          sequence,
          "releaseCountdown",
          timing.countdownTickMs,
          performance.now(),
        );
        return;
      }

      sequence.countdownValue--;
      if (sequence.countdownValue <= 0) {
        sequence.countdownTimer = 0;
        sequence.sequenceStage = "idle";
        onRelease();
        return;
      }

      showReleaseCountdown();
      scheduleReleaseTick();
    }, delay);
  }

  function schedule() {
    if (sequence.started) return;

    sequence.started = true;
    sequence.countdownValue = Math.ceil(
      timing.introReleaseDelayMs / timing.countdownTickMs,
    );
    showReleaseCountdown();
    scheduleReleaseTick();
  }

  function pause() {
    const hadActiveTimer = pauseIntroTimerState(
      intro,
      sequence,
      performance.now(),
    );
    if (hadActiveTimer) clearTimers();
  }

  function resume() {
    const delay = Math.max(0, sequence.timerDelayMs);
    const action = resumeIntroTimerAction(intro, sequence);
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
    schedule,
  };
}
