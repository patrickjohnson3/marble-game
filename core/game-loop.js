import { copy } from "./copy.js";
import { SURFACE_TYPES, updatePhysicsInput, updatePhysics } from "./physics.js";
import { GAME_PHASES } from "./runtime-states.js";

export function elapsedMsToFrameDelta(elapsedMs, timing, clamp) {
  // Long frames intentionally run as capped slow-motion instead of catching up
  // with a large physics step that can tunnel through collision geometry.
  return clamp(
    elapsedMs / timing.targetFrameMs,
    timing.minFrameDelta,
    timing.maxFrameDelta,
  );
}

export function updateFrameBudgetMetric(perf, key, elapsedMs, alpha = 0.2) {
  if (!perf || !Number.isFinite(elapsedMs)) return;

  perf[key] = perf[key]
    ? perf[key] + (elapsedMs - perf[key]) * alpha
    : elapsedMs;
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
  perf,
  physicsContext,
  scheduleFrame,
  resetGoalProgress = () => {},
  settings = { goalIndicatorEnabled: false },
  spawnTarget = () => null,
  terrainView,
  timing,
  tuning,
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

  function onSurface(speed, surfaceType) {
    hapticFeedback.pulseSurface(speed, surfaceType);
    if (surfaceType === SURFACE_TYPES.gooPatch) {
      effectsRenderer.spawnGooSplat(speed);
    } else if (surfaceType === SURFACE_TYPES.waterPatch) {
      effectsRenderer.spawnWaterRipple(speed);
    }
  }

  function onTerrain(surfaceType) {
    if (surfaceType === lastSurfaceType) return;

    lastSurfaceType = surfaceType;
    if (surfaceType === SURFACE_TYPES.gooPatch) {
      ui.setHint(copy.hints.gooPatch);
    } else if (surfaceType === SURFACE_TYPES.roughPatch) {
      ui.setHint(copy.hints.roughPatch);
    } else if (surfaceType === SURFACE_TYPES.icePatch) {
      ui.setHint(copy.hints.icePatch);
    } else if (surfaceType === SURFACE_TYPES.waterPatch) {
      ui.setHint(copy.hints.waterPatch);
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
    effectsRenderer.spawnImpact(tuning.hazardResetImpactFeedback);
    hapticFeedback.pulseImpact(tuning.hazardResetImpactFeedback);
    ui.setHint(copy.hints.hazardPatch);
    cameraController.centerOnMarble();
  }

  function updateGoalIndicator(context) {
    const goal = goalTarget();
    if (!settings.goalIndicatorEnabled || !context.intro.released || !goal) {
      ui.setGoalIndicator({ visible: false });
      return;
    }

    const dx = goal.x - marble.x;
    const dy = goal.y - marble.y;
    const distance = Math.hypot(dx, dy);
    ui.setGoalIndicator({
      visible: distance > goal.r * tuning.goalIndicatorDistanceMultiplier,
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
    if (distanceFromSpawn > marble.r * tuning.hazardRearmDistanceMultiplier) {
      hazardArmed = true;
    }
  }

  const physicsFeedback = {
    onImpact,
    onHazard,
    onSurface,
    onTerrain,
  };

  function tick() {
    const frameBudgetStart = performance.now();
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
      const previousMarble = { x: marble.x, y: marble.y };
      const physicsBudgetStart = performance.now();
      updatePhysicsInput(context, frameDelta);
      updatePhysics(context, frameDelta, physicsFeedback);
      updateFrameBudgetMetric(
        perf,
        "physicsMs",
        performance.now() - physicsBudgetStart,
      );
      marble.roll +=
        (Math.hypot(marble.vx, marble.vy) * frameDelta) / Math.max(marble.r, 1);
      marble.impactSquash = Math.max(
        0,
        marble.impactSquash -
          visualConfig.marble.impactSquashDecay * frameDelta,
      );
      goalController?.update(frameDelta, currentTime);
      cameraController.updateFollow(frameDelta);
      updateGoalIndicator(context);
      updateHazardArmed();
      const themeBudgetStart = performance.now();
      const themeEvents = terrainView?.updateMapThemeDynamics(
        marble,
        previousMarble,
        frameDelta,
      );
      if (themeEvents?.squishedAnts > 0) {
        hapticFeedback.pulseImpact(tuning.antSquishImpactFeedback);
      } else if (themeEvents?.splatHits > 0) {
        hapticFeedback.pulseImpact(tuning.antSplatImpactFeedback);
      } else if (themeEvents?.cerealHits > 0) {
        hapticFeedback.pulseImpact(tuning.cerealBumpImpactFeedback);
      }
      updateFrameBudgetMetric(
        perf,
        "themeMs",
        performance.now() - themeBudgetStart,
      );
    }

    const renderBudgetStart = performance.now();
    marbleView.render();
    if (!game.paused) trailRenderer.update(currentTime);
    effectsRenderer.render(currentTime);
    updateFrameBudgetMetric(
      perf,
      "renderMs",
      performance.now() - renderBudgetStart,
    );
    updateFrameBudgetMetric(
      perf,
      "frameMs",
      performance.now() - frameBudgetStart,
    );
    ui.updateFps(currentTime);
    ui.updateDebugPanel();
    frameLoop.markRendered();

    if (active) scheduleFrame();
  }

  return { resetClock, tick };
}
