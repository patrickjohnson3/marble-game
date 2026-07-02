import {
  pauseIntroTimerState,
  resumeIntroTimerAction,
  trackIntroTimer
} from "./intro-timers.js";

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

  function setTimer(stage, delay, callback) {
    clearTimers();
    trackIntroTimer(intro, stage, delay, performance.now());
    intro.messageTimer = setTimeout(callback, delay);
  }

  function showMessage(message) {
    messageOverlay.textContent = message;
    messageOverlay.classList.remove("countdownMode");
    messageOverlay.classList.add("show", "toast");
  }

  function hideMessage() {
    messageOverlay.classList.remove("show");
  }

  function showCountdown() {
    const countdown = createElement("span");
    countdown.className = "countdown";
    countdown.textContent = intro.countdownValue;
    messageOverlay.replaceChildren("Ready?", countdown);
    messageOverlay.classList.remove("toast");
    messageOverlay.classList.add("show", "countdownMode");
  }

  function scheduleCountdownTick(delay = timing.countdownTickMs) {
    clearTimers();
    trackIntroTimer(intro, "countdown", delay, performance.now());
    intro.countdownTimer = setTimeout(() => {
      if (game.paused) {
        intro.countdownTimer = 0;
        trackIntroTimer(intro, "countdown", timing.countdownTickMs, performance.now());
        return;
      }

      intro.countdownValue--;
      if (intro.countdownValue <= 0) {
        intro.countdownTimer = 0;
        intro.sequenceStage = "idle";
        onRelease();
        return;
      }

      showCountdown();
      scheduleCountdownTick();
    }, delay);
  }

  function startReleaseCountdown() {
    clearTimers();
    intro.sequenceStage = "countdown";
    intro.countdownValue = timing.countdownStart;
    showCountdown();
    scheduleCountdownTick();
  }

  function showIntroPrompt() {
    showMessage("Pinch to zoom out. Reverse pinch to zoom in. Rotation is available in settings.");
    setTimer("countdownWait", timing.countdownDelayMs, startReleaseCountdown);
  }

  function schedule() {
    if (intro.started) return;

    intro.started = true;
    setTimer("promptWait", timing.introPromptDelayMs, showIntroPrompt);
  }

  function pause() {
    const hadActiveTimer = pauseIntroTimerState(intro, performance.now());
    if (hadActiveTimer) clearTimers();
  }

  function resume() {
    const delay = Math.max(0, intro.timerDelayMs);
    const action = resumeIntroTimerAction(intro);
    if (action === "prompt") {
      setTimer("promptWait", delay, showIntroPrompt);
    } else if (action === "countdownStart") {
      setTimer("countdownWait", delay, startReleaseCountdown);
    } else if (action === "countdownTick") {
      scheduleCountdownTick(delay);
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
