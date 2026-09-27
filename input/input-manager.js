export function createInputManager({
  target = globalThis,
  gameEl,
  startBtn,
  onOrientation,
  onMotion,
  onKeyDown,
  onKeyUp,
  onBlur,
  onPointerDown,
  onPointerMove,
  onPointerEnd,
  onStartClick,
}) {
  function enableMotion() {
    target.addEventListener("deviceorientation", onOrientation, true);
    target.addEventListener("devicemotion", onMotion, true);
  }

  function enableKeyboard() {
    target.addEventListener("keydown", onKeyDown, { passive: false });
    target.addEventListener("keyup", onKeyUp);
    target.addEventListener("blur", onBlur);
  }

  function enableGestures() {
    gameEl.addEventListener("pointerdown", onPointerDown);
    gameEl.addEventListener("pointermove", onPointerMove);
    gameEl.addEventListener("pointerup", onPointerEnd);
    gameEl.addEventListener("pointercancel", onPointerEnd);
  }

  function bindStartButton() {
    startBtn.addEventListener("click", onStartClick);
  }

  function destroy() {
    target.removeEventListener("deviceorientation", onOrientation, {
      capture: true,
    });
    target.removeEventListener("devicemotion", onMotion, { capture: true });
    target.removeEventListener("keydown", onKeyDown, { passive: false });
    target.removeEventListener("keyup", onKeyUp);
    target.removeEventListener("blur", onBlur);
    gameEl.removeEventListener("pointerdown", onPointerDown);
    gameEl.removeEventListener("pointermove", onPointerMove);
    gameEl.removeEventListener("pointerup", onPointerEnd);
    gameEl.removeEventListener("pointercancel", onPointerEnd);
    startBtn.removeEventListener("click", onStartClick);
  }

  return {
    bindStartButton,
    destroy,
    enableGestures,
    enableKeyboard,
    enableMotion,
  };
}
