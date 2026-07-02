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

  function enableMotion() {
    if (motionEnabled) return;

    motionEnabled = true;
    target.addEventListener("deviceorientation", onOrientation, true);
    target.addEventListener("devicemotion", onMotion, true);
  }

  function enableKeyboard() {
    target.addEventListener("keydown", onKeyDown, { passive:false });
    target.addEventListener("keyup", onKeyUp);
  }

  function enableGestures() {
    gameEl.addEventListener("pointerdown", onPointerDown);
    gameEl.addEventListener("pointermove", onPointerMove);
    gameEl.addEventListener("pointerup", onPointerEnd);
    gameEl.addEventListener("pointercancel", onPointerEnd);
  }

  function bindStartButton() {
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
