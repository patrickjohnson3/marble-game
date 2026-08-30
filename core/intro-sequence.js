import { copy } from "./copy.js";

export function createIntroSequence({
  intro,
  sequence,
  game,
  timing,
  messageOverlay,
  onRelease,
  clearTimeoutFn,
  createElement,
  now,
  setTimeoutFn,
}) {
  function clearTimers() {
    clearTimeoutFn(sequence.countdownTimer);
    sequence.countdownTimer = 0;
  }

  function reset() {
    clearTimers();
    sequence.started = false;
    sequence.countdownValue = Math.ceil(
      timing.introReleaseDelayMs / timing.countdownTickMs,
    );
    sequence.sequenceStage = "idle";
    sequence.timerStartedAt = 0;
    sequence.timerDelayMs = 0;
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
    sequence.sequenceStage = "releaseCountdown";
    sequence.timerStartedAt = now();
    sequence.timerDelayMs = delay;
    sequence.countdownTimer = setTimeoutFn(() => {
      if (game.paused) {
        sequence.countdownTimer = 0;
        sequence.sequenceStage = "releaseCountdown";
        sequence.timerStartedAt = now();
        sequence.timerDelayMs = timing.countdownTickMs;
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
    if (
      !sequence.started ||
      intro.released ||
      sequence.sequenceStage === "idle"
    ) {
      return;
    }

    const elapsed = now() - sequence.timerStartedAt;
    sequence.timerDelayMs = Math.max(0, sequence.timerDelayMs - elapsed);
    clearTimers();
  }

  function resume() {
    if (
      !sequence.started ||
      intro.released ||
      sequence.sequenceStage !== "releaseCountdown"
    ) {
      return;
    }

    showReleaseCountdown();
    scheduleReleaseTick(Math.max(0, sequence.timerDelayMs));
  }

  return {
    clearTimers,
    hideMessage,
    pause,
    reset,
    resume,
    schedule,
  };
}
