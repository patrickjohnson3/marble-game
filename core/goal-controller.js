import { distance } from "./geometry.js";

const maxGoalCenterHoldBonus = 1;

function frameDeltaToMs(frameDelta, timing) {
  return frameDelta * timing.targetFrameMs;
}

export function goalHoldMultiplier(marble, goal) {
  const holdRadius = Math.max(goal.r - marble.r, 1);
  const centerCloseness = 1 - Math.min(distance(marble, goal) / holdRadius, 1);
  return 1 + centerCloseness * maxGoalCenterHoldBonus;
}

export function goalHoldHint(remainingMs, multiplier) {
  const seconds = Math.max(1, Math.ceil(remainingMs / 1000));
  const label = multiplier >= 1.5 ? "hold center" : "hold steady";

  return label + ": " + seconds + "s";
}

export function createGoalController({
  copy,
  effectsRenderer = { spawnGoalComplete() {} },
  hapticFeedback,
  intro,
  mapProgression,
  mapRuntime,
  marble,
  terrainView,
  timing,
  ui,
}) {
  const mapState = mapRuntime.state;
  let goalHapticActive = false;

  function marbleInsideGoal() {
    return (
      intro.released &&
      distance(marble, mapState.goal) + marble.r <= mapState.goal.r
    );
  }

  function update(frameDelta) {
    if (mapState.goalCompleted) return;

    if (!marbleInsideGoal()) {
      if (mapState.goalHoldMs > 0) {
        mapRuntime.resetGoalProgress();
        terrainView.updateGoalProgress(0);
        ui.setHint(copy.mapOpen);
      }
      goalHapticActive = false;
      return;
    }

    if (!goalHapticActive) {
      goalHapticActive = true;
      hapticFeedback.pulseGoal("enter");
    }

    const multiplier = goalHoldMultiplier(marble, mapState.goal);
    const progress = mapRuntime.addGoalHold(
      frameDeltaToMs(frameDelta, timing) * multiplier,
    );
    terrainView.updateGoalProgress(progress);
    ui.setHint(
      goalHoldHint(mapState.goal.holdMs - mapState.goalHoldMs, multiplier),
    );
    hapticFeedback.pulseGoal("hold");

    if (mapState.goalHoldMs >= mapState.goal.holdMs) {
      mapRuntime.completeGoal();
      effectsRenderer.spawnGoalComplete();
      hapticFeedback.pulseGoal("complete");
      goalHapticActive = false;
      if (!mapProgression.advanceToNextMap()) {
        mapRuntime.clearGoalCompleted();
      }
    }
  }

  return {
    marbleInsideGoal,
    update,
  };
}
