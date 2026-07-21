export function createCameraGestureController({
  camera,
  cameraEl,
  centerOnMarble,
  clamp,
  distance,
  game,
  intro,
  midpoint,
  tuning,
  applyTransform,
}) {
  const pointers = new Map();
  let gesture = null;

  function pointerPoint(e) {
    return { x: e.clientX, y: e.clientY };
  }

  function gesturePoints() {
    return Array.from(pointers.values()).slice(0, 2);
  }

  function startGesture() {
    const [a, b] = gesturePoints();
    if (!a || !b) return;

    gesture = {
      distance: Math.max(distance(a, b), 1),
      midpoint: midpoint(a, b),
      x: camera.x,
      y: camera.y,
      scale: camera.scale,
    };
  }

  function updateGesture() {
    if (!gesture || pointers.size < 2) return;

    const [a, b] = gesturePoints();
    const nextMidpoint = midpoint(a, b);
    camera.scale = clamp(
      gesture.scale * (distance(a, b) / gesture.distance),
      camera.minScale,
      camera.maxScale,
    );
    if (!intro.released) {
      centerOnMarble();
      return;
    }

    camera.x = gesture.x + nextMidpoint.x - gesture.midpoint.x;
    camera.y = gesture.y + nextMidpoint.y - gesture.midpoint.y;
    camera.gestureCooldown = tuning.gestureCooldownFrames;
    applyTransform();
  }

  function onPointerDown(e) {
    if (game.paused) return;

    pointers.set(e.pointerId, pointerPoint(e));
    if (cameraEl.setPointerCapture) {
      try {
        cameraEl.setPointerCapture(e.pointerId);
      } catch {
        // Losing capture is acceptable; pointercancel/up will still clear state.
      }
    }
    if (pointers.size === 2) startGesture();
  }

  function onPointerMove(e) {
    if (game.paused) return;
    if (!pointers.has(e.pointerId)) return;

    pointers.set(e.pointerId, pointerPoint(e));
    updateGesture();
  }

  function onPointerEnd(e) {
    pointers.delete(e.pointerId);
    gesture = null;
    if (pointers.size === 2) startGesture();
  }

  function resetGesture() {
    gesture = null;
    pointers.clear();
  }

  return {
    onPointerDown,
    onPointerEnd,
    onPointerMove,
    resetGesture,
  };
}
