import { createCameraGestureController } from "./camera-gestures.js";

export function createCameraController({
  camera,
  cameraEl,
  game,
  intro,
  marble,
  tuning,
  clamp,
  distance,
  midpoint,
  viewport,
}) {
  function applyTransform() {
    const floorStyle = cameraEl.parentElement?.style ?? cameraEl.style;

    floorStyle.setProperty?.("--camera-x", camera.x + "px");
    floorStyle.setProperty?.("--camera-y", camera.y + "px");
    floorStyle.setProperty?.("--camera-scale", camera.scale);
    cameraEl.style.transform =
      "translate(" +
      camera.x +
      "px, " +
      camera.y +
      "px) " +
      "scale(" +
      camera.scale +
      ")";
  }

  function transformedWorldPoint(x, y) {
    return {
      x: x * camera.scale,
      y: y * camera.scale,
    };
  }

  function centerOnMarble() {
    const transformed = transformedWorldPoint(marble.x, marble.y);
    camera.x = viewport.width() / 2 - transformed.x;
    camera.y = viewport.height() / 2 - transformed.y;
    applyTransform();
  }

  function updateFollow(dt) {
    if (!intro.released) return;

    camera.gestureCooldown = Math.max(0, camera.gestureCooldown - dt);
    if (camera.gestureCooldown > 0) return;

    const transformed = transformedWorldPoint(marble.x, marble.y);
    const targetX = viewport.width() / 2 - transformed.x;
    const targetY = viewport.height() / 2 - transformed.y;
    const followStep = 1 - Math.pow(1 - camera.followLag, dt);

    camera.x += (targetX - camera.x) * followStep;
    camera.y += (targetY - camera.y) * followStep;
    applyTransform();
  }

  const gestures = createCameraGestureController({
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
  });

  return {
    applyTransform,
    camera,
    centerOnMarble,
    onPointerDown: gestures.onPointerDown,
    onPointerEnd: gestures.onPointerEnd,
    onPointerMove: gestures.onPointerMove,
    resetGesture: gestures.resetGesture,
    updateFollow,
  };
}
