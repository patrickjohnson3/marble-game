import { createCameraGestureController } from "./camera-gestures.js";
import { clamp } from "../core/geometry.js";

export function createCameraController({
  camera,
  cameraEl,
  game,
  intro,
  marble,
  tuning,
  viewport,
  mapState,
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

    const world = mapState.activeMap.world;
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

    camera.x = boundsCache.worldFitsX
      ? boundsCache.centerX
      : clamp(camera.x, boundsCache.minX, boundsCache.maxX);
    camera.y = boundsCache.worldFitsY
      ? boundsCache.centerY
      : clamp(camera.y, boundsCache.minY, boundsCache.maxY);
  }

  function applyTransform() {
    clampCameraPosition();
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

  function invalidateWorldBounds() {
    boundsCache.scale = null;
    applyTransform();
  }

  function updateFollow(dt) {
    if (!intro.released || gestures.isActive()) return;

    camera.gestureCooldown = Math.max(0, camera.gestureCooldown - dt);
    const width = viewport.width();
    const height = viewport.height();
    const marbleX = marble.x * camera.scale;
    const marbleY = marble.y * camera.scale;
    if (camera.gestureCooldown === 0) {
      const followStep = 1 - Math.pow(1 - camera.followLag, dt);
      camera.x += (width / 2 - marbleX - camera.x) * followStep;
      camera.y += (height / 2 - marbleY - camera.y) * followStep;
    }

    // Manual gestures may explore away from the marble. After release, neither
    // the cooldown nor smooth following may let its body leave the viewport.
    const radius = marble.r * camera.scale;
    const marginX = Math.min(radius, width / 2);
    const marginY = Math.min(radius, height / 2);
    camera.x = clamp(camera.x, marginX - marbleX, width - marginX - marbleX);
    camera.y = clamp(camera.y, marginY - marbleY, height - marginY - marbleY);
    applyTransform();
  }

  function zoomBy(factor) {
    if (game.paused) return;
    gestures.resetGesture();
    const scale = clamp(
      camera.scale * factor,
      camera.minScale,
      camera.maxScale,
    );
    // Keep the marble at its screen position before enforcing view bounds.
    camera.x += marble.x * (camera.scale - scale);
    camera.y += marble.y * (camera.scale - scale);
    camera.scale = scale;
    if (!intro.released) {
      centerOnMarble();
      return;
    }
    camera.gestureCooldown = tuning.gestureCooldownFrames;
    updateFollow(0);
  }

  function panBy(dx, dy) {
    if (game.paused) return;
    gestures.resetGesture();
    if (!intro.released) {
      centerOnMarble();
      return;
    }
    camera.x += dx;
    camera.y += dy;
    camera.gestureCooldown = tuning.gestureCooldownFrames;
    updateFollow(0);
  }

  function recenter() {
    if (game.paused) return;
    gestures.resetGesture();
    camera.gestureCooldown = 0;
    centerOnMarble();
  }

  const gestures = createCameraGestureController({
    camera,
    cameraEl,
    centerOnMarble,
    game,
    intro,
    tuning,
    applyTransform,
  });

  return {
    applyTransform,
    camera,
    centerOnMarble,
    zoomBy,
    panBy,
    recenter,
    onPointerDown: gestures.onPointerDown,
    onPointerEnd: gestures.onPointerEnd,
    onPointerMove: gestures.onPointerMove,
    resetGesture: gestures.resetGesture,
    invalidateWorldBounds,
    updateFollow,
  };
}
