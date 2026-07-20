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

  function followTarget() {
    if (camera.mode !== "predictiveLookAhead") {
      return { x: marble.x, y: marble.y };
    }

    return {
      x: marble.x + marble.vx * camera.predictiveLookAheadFrames,
      y: marble.y + marble.vy * camera.predictiveLookAheadFrames,
    };
  }

  function updateFollow(dt) {
    if (!intro.released) return;

    camera.gestureCooldown = Math.max(0, camera.gestureCooldown - dt);
    if (camera.gestureCooldown > 0 && camera.mode !== "lockedCenter") return;

    const target = followTarget();
    const transformed = transformedWorldPoint(target.x, target.y);
    const targetX = viewport.width() / 2 - transformed.x;
    const targetY = viewport.height() / 2 - transformed.y;
    const followStep =
      camera.mode === "lockedCenter"
        ? 1
        : 1 - Math.pow(1 - camera.followLag, dt);

    camera.x += (targetX - camera.x) * followStep;
    camera.y += (targetY - camera.y) * followStep;
    applyTransform();
  }

  function applyMode() {
    camera.gestureCooldown = 0;
    if (!intro.released || camera.mode === "lockedCenter") {
      centerOnMarble();
      return;
    }

    updateFollow(1);
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
    applyMode,
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
