export function createCameraController({
  camera,
  cameraEl,
  game,
  intro,
  marble,
  tuning,
  clamp,
  distance,
  angle,
  midpoint,
  viewport
}) {
  const pointers = new Map();
  let gesture = null;

  function applyTransform() {
    cameraEl.style.transform =
      "translate(" + camera.x + "px, " + camera.y + "px) " +
      "scale(" + camera.scale + ") " +
      "rotate(" + camera.rotation + "rad)";
  }

  function transformedWorldPoint(x, y) {
    const c = Math.cos(camera.rotation);
    const s = Math.sin(camera.rotation);

    return {
      x: (x * c - y * s) * camera.scale,
      y: (x * s + y * c) * camera.scale
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
      y: marble.y + marble.vy * camera.predictiveLookAheadFrames
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
    const followStep = camera.mode === "lockedCenter"
      ? 1
      : 1 - Math.pow(1 - camera.followLag, dt);

    camera.x += (targetX - camera.x) * followStep;
    camera.y += (targetY - camera.y) * followStep;
    applyTransform();
  }

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
      angle: angle(a, b),
      midpoint: midpoint(a, b),
      x: camera.x,
      y: camera.y,
      scale: camera.scale,
      rotation: camera.rotation
    };
  }

  function updateGesture() {
    if (!gesture || pointers.size < 2) return;

    const [a, b] = gesturePoints();
    const nextMidpoint = midpoint(a, b);
    camera.scale = clamp(
      gesture.scale * (distance(a, b) / gesture.distance),
      camera.minScale,
      camera.maxScale
    );
    camera.rotation = camera.rotationEnabled
      ? gesture.rotation + angle(a, b) - gesture.angle
      : 0;
    if (!intro.released) {
      centerOnMarble();
      return;
    }

    if (camera.mode === "lockedCenter") {
      camera.gestureCooldown = 0;
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
    applyTransform,
    camera,
    centerOnMarble,
    onPointerDown,
    onPointerEnd,
    onPointerMove,
    resetGesture,
    updateFollow
  };
}
