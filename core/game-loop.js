import { updatePhysicsInput, updatePhysics } from "./physics.js";

export function createGameLoop({
  cameraController,
  clamp,
  effectsRenderer,
  frameLoop,
  game,
  hapticFeedback,
  lifecycle,
  goalController,
  marble,
  marbleView,
  physicsContext,
  scheduleFrame,
  timing,
  trailRenderer,
  ui,
  visualConfig,
  now = () => performance.now()
}) {
  function tick() {
    frameLoop.beginFrame();
    const currentTime = now();
    const dt = clamp(
      (currentTime - lifecycle.getLastFrame()) / timing.targetFrameMs,
      timing.minFrameStep,
      timing.maxFrameStep
    );
    lifecycle.setLastFrame(currentTime);
    const active = game.phase !== "waiting" && !game.paused;

    if (frameLoop.shouldSkipIdle(active)) {
      ui.updateDebugPanel();
      return;
    }

    if (active) {
      const context = physicsContext();
      updatePhysicsInput(context, dt);
      updatePhysics(context, dt, {
        onImpact: (impact) => {
          marble.impactSquash = Math.max(
            marble.impactSquash,
            clamp(impact / visualConfig.marble.impactSquashDivisor, 0, 1)
          );
          effectsRenderer.spawnImpact(impact);
          hapticFeedback.pulseImpact(impact);
        },
        onSurface: (speed) => {
          hapticFeedback.pulseSurface(speed);
        }
      });
      marble.roll += Math.hypot(marble.vx, marble.vy) * dt / Math.max(marble.r, 1);
      marble.impactSquash = Math.max(0, marble.impactSquash - visualConfig.marble.impactSquashDecay * dt);
      goalController?.update(dt, currentTime);
      cameraController.updateFollow(dt);
    }

    marbleView.render();
    if (!game.paused) trailRenderer.update(currentTime);
    ui.updateFps(currentTime);
    ui.updateDebugPanel();
    frameLoop.markRendered();

    if (active) scheduleFrame();
  }

  return { tick };
}
