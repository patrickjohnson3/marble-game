import { updatePhysicsInput, updatePhysics } from "./physics.js";

function elapsedMsToFrameDelta(elapsedMs, timing, clamp) {
  return clamp(
    elapsedMs / timing.targetFrameMs,
    timing.minFrameDelta,
    timing.maxFrameDelta,
  );
}

export function createGameLoop({
  cameraController,
  clamp,
  effectsRenderer,
  frameLoop,
  game,
  hapticFeedback,
  goalController,
  marble,
  marbleView,
  physicsContext,
  scheduleFrame,
  timing,
  trailRenderer,
  ui,
  visualConfig,
  now = () => performance.now(),
}) {
  let lastFrame = now();

  function resetClock() {
    lastFrame = now();
  }

  function onImpact(impact) {
    marble.impactSquash = Math.max(
      marble.impactSquash,
      clamp(impact / visualConfig.marble.impactSquashDivisor, 0, 1),
    );
    effectsRenderer.spawnImpact(impact);
    hapticFeedback.pulseImpact(impact);
  }

  function onSurface(speed) {
    hapticFeedback.pulseSurface(speed);
  }

  const physicsFeedback = {
    onImpact,
    onSurface,
  };

  function tick() {
    frameLoop.beginFrame();
    const currentTime = now();
    const frameDelta = elapsedMsToFrameDelta(
      currentTime - lastFrame,
      timing,
      clamp,
    );
    lastFrame = currentTime;
    const active = game.phase !== "waiting" && !game.paused;

    if (frameLoop.shouldSkipIdle(active)) {
      ui.updateDebugPanel();
      return;
    }

    if (active) {
      const context = physicsContext();
      updatePhysicsInput(context, frameDelta);
      updatePhysics(context, frameDelta, physicsFeedback);
      marble.roll +=
        (Math.hypot(marble.vx, marble.vy) * frameDelta) / Math.max(marble.r, 1);
      marble.impactSquash = Math.max(
        0,
        marble.impactSquash -
          visualConfig.marble.impactSquashDecay * frameDelta,
      );
      goalController?.update(frameDelta, currentTime);
      cameraController.updateFollow(frameDelta);
    }

    marbleView.render();
    if (!game.paused) trailRenderer.update(currentTime);
    ui.updateFps(currentTime);
    ui.updateDebugPanel();
    frameLoop.markRendered();

    if (active) scheduleFrame();
  }

  return { resetClock, tick };
}
