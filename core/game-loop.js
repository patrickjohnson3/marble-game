import { copy } from "./copy.js";
import { SURFACE_TYPES, updatePhysicsInput, updatePhysics } from "./physics.js";
import { GAME_PHASES } from "./runtime-states.js";

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
  goalTarget = () => null,
  marble,
  marbleView,
  physicsContext,
  scheduleFrame,
  resetGoalProgress = () => {},
  runTimeLabel = () => "",
  spawnTarget = () => null,
  timing,
  trailRenderer,
  ui,
  visualConfig,
  now = () => performance.now(),
}) {
  let lastFrame = now();
  let lastSurfaceType = SURFACE_TYPES.floor;
  let hazardArmed = true;

  function resetClock() {
    lastFrame = now();
    lastSurfaceType = SURFACE_TYPES.floor;
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

  function onTerrain(surfaceType) {
    if (surfaceType === lastSurfaceType) return;

    lastSurfaceType = surfaceType;
    if (surfaceType === SURFACE_TYPES.roughPatch) {
      ui.setHint(copy.hints.roughPatch);
    } else if (surfaceType === SURFACE_TYPES.icePatch) {
      ui.setHint(copy.hints.icePatch);
    }
  }

  function onHazard() {
    if (!hazardArmed) return;

    const spawn = spawnTarget();
    if (!spawn) return;

    hazardArmed = false;
    marble.x = spawn.x;
    marble.y = spawn.y;
    marble.vx = 0;
    marble.vy = 0;
    marble.roll = 0;
    resetGoalProgress();
    trailRenderer.clear();
    effectsRenderer.clear();
    effectsRenderer.spawnImpact(12);
    hapticFeedback.pulseImpact(12);
    ui.setHint(copy.hints.hazardPatch);
    cameraController.centerOnMarble();
  }

  function updateGoalIndicator(context) {
    const goal = goalTarget();
    if (!context.intro.released || !goal) {
      ui.setGoalIndicator({ visible: false });
      return;
    }

    const dx = goal.x - marble.x;
    const dy = goal.y - marble.y;
    const distance = Math.hypot(dx, dy);
    ui.setGoalIndicator({
      visible: distance > goal.r * 2.4,
      angle: Math.atan2(dy, dx),
    });
  }

  function updateHazardArmed() {
    const spawn = spawnTarget();
    if (!spawn) return;

    const distanceFromSpawn = Math.hypot(
      marble.x - spawn.x,
      marble.y - spawn.y,
    );
    if (distanceFromSpawn > marble.r * 3) hazardArmed = true;
  }

  const physicsFeedback = {
    onImpact,
    onHazard,
    onSurface,
    onTerrain,
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
    const active = game.phase !== GAME_PHASES.waiting && !game.paused;

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
      ui.setRunTimeLabel(runTimeLabel(currentTime));
      updateGoalIndicator(context);
      updateHazardArmed();
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
