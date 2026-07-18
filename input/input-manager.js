export function createInputManager({
  target = globalThis,
  gameEl,
  startBtn,
  onOrientation,
  onMotion,
  onKeyDown,
  onKeyUp,
  onPointerDown,
  onPointerMove,
  onPointerEnd,
  onStartClick,
}) {
  let motionEnabled = false;
  let keyboardEnabled = false;
  let gesturesEnabled = false;
  let startButtonBound = false;

  function enableMotion() {
    if (motionEnabled) return;

    motionEnabled = true;
    target.addEventListener("deviceorientation", onOrientation, true);
    target.addEventListener("devicemotion", onMotion, true);
  }

  function enableKeyboard() {
    if (keyboardEnabled) return;

    keyboardEnabled = true;
    target.addEventListener("keydown", onKeyDown, { passive: false });
    target.addEventListener("keyup", onKeyUp);
  }

  function enableGestures() {
    if (gesturesEnabled) return;

    gesturesEnabled = true;
    gameEl.addEventListener("pointerdown", onPointerDown);
    gameEl.addEventListener("pointermove", onPointerMove);
    gameEl.addEventListener("pointerup", onPointerEnd);
    gameEl.addEventListener("pointercancel", onPointerEnd);
  }

  function bindStartButton() {
    if (startButtonBound) return;

    startButtonBound = true;
    startBtn.addEventListener("click", onStartClick);
  }

  function destroy() {
    if (motionEnabled) {
      target.removeEventListener("deviceorientation", onOrientation, true);
      target.removeEventListener("devicemotion", onMotion, true);
      motionEnabled = false;
    }
    if (keyboardEnabled) {
      target.removeEventListener("keydown", onKeyDown, { passive: false });
      target.removeEventListener("keyup", onKeyUp);
      keyboardEnabled = false;
    }
    if (gesturesEnabled) {
      gameEl.removeEventListener("pointerdown", onPointerDown);
      gameEl.removeEventListener("pointermove", onPointerMove);
      gameEl.removeEventListener("pointerup", onPointerEnd);
      gameEl.removeEventListener("pointercancel", onPointerEnd);
      gesturesEnabled = false;
    }
    if (startButtonBound) {
      startBtn.removeEventListener("click", onStartClick);
      startButtonBound = false;
    }
  }

  return {
    bindStartButton,
    destroy,
    enableGestures,
    enableKeyboard,
    enableMotion,
  };
}
