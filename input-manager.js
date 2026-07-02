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
  onStartPointerDown,
  onStartClick
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
    target.addEventListener("keydown", onKeyDown, { passive:false });
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
    startBtn.addEventListener("pointerdown", onStartPointerDown);
    startBtn.addEventListener("click", onStartClick);
  }

  return {
    bindStartButton,
    enableGestures,
    enableKeyboard,
    enableMotion
  };
}
