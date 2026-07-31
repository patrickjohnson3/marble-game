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
  world,
}) {
  const boundsCache = {
    centerX: 0,
    centerY: 0,
    maxX: 0,
    maxY: 0,
    minX: 0,
    minY: 0,
    scale: null,
    viewportHeight: null,
    viewportWidth: null,
    worldFitsX: false,
    worldFitsY: false,
  };

  function updateBoundsCache() {
    const viewportWidth = viewport.width();
    const viewportHeight = viewport.height();
    if (
      boundsCache.scale === camera.scale &&
      boundsCache.viewportWidth === viewportWidth &&
      boundsCache.viewportHeight === viewportHeight
    )
      return;

    const scaledWidth = world.width * camera.scale;
    const scaledHeight = world.height * camera.scale;
    boundsCache.scale = camera.scale;
    boundsCache.viewportWidth = viewportWidth;
    boundsCache.viewportHeight = viewportHeight;
    boundsCache.worldFitsX = scaledWidth <= viewportWidth;
    boundsCache.worldFitsY = scaledHeight <= viewportHeight;
    boundsCache.centerX = (viewportWidth - scaledWidth) / 2;
    boundsCache.centerY = (viewportHeight - scaledHeight) / 2;
    boundsCache.minX = viewportWidth - scaledWidth;
    boundsCache.minY = viewportHeight - scaledHeight;
  }

  function clampCameraPosition() {
    updateBoundsCache();

    camera.x =
      boundsCache.worldFitsX
        ? boundsCache.centerX
        : clamp(camera.x, boundsCache.minX, boundsCache.maxX);
    camera.y =
      boundsCache.worldFitsY
        ? boundsCache.centerY
        : clamp(camera.y, boundsCache.minY, boundsCache.maxY);
  }

  function applyTransform() {
    clampCameraPosition();
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

  function centerOnMarble() {
    camera.x = viewport.width() / 2 - marble.x * camera.scale;
    camera.y = viewport.height() / 2 - marble.y * camera.scale;
    applyTransform();
  }

  function updateFollow(dt) {
    if (!intro.released) return;

    camera.gestureCooldown = Math.max(0, camera.gestureCooldown - dt);
    if (camera.gestureCooldown > 0) return;

    const targetX = viewport.width() / 2 - marble.x * camera.scale;
    const targetY = viewport.height() / 2 - marble.y * camera.scale;
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
