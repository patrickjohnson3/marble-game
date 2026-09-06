import { clamp, distance, midpoint } from "../core/geometry.js";

export function createCameraGestureController({
  camera,
  cameraEl,
  centerOnMarble,
  game,
  intro,
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

    const center = midpoint(a, b);
    gesture = {
      distance: Math.max(distance(a, b), 1),
      worldX: (center.x - camera.x) / camera.scale,
      worldY: (center.y - camera.y) / camera.scale,
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
      gesture.worldX = (nextMidpoint.x - camera.x) / camera.scale;
      gesture.worldY = (nextMidpoint.y - camera.y) / camera.scale;
      return;
    }

    // Keep the same map point between the fingers, including at zoom limits.
    camera.x = nextMidpoint.x - gesture.worldX * camera.scale;
    camera.y = nextMidpoint.y - gesture.worldY * camera.scale;
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
    if (!pointers.delete(e.pointerId)) return;

    if (gesture && pointers.size < 2 && intro.released) {
      camera.gestureCooldown = tuning.gestureCooldownFrames;
    }
    gesture = null;
    if (pointers.size >= 2) startGesture();
  }

  function resetGesture() {
    gesture = null;
    pointers.clear();
  }

  return {
    isActive: () => gesture !== null,
    onPointerDown,
    onPointerEnd,
    onPointerMove,
    resetGesture,
  };
}
