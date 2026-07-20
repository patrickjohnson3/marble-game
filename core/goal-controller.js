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

export function createGoalController({
  copy,
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

    const progress = mapRuntime.addGoalHold(
      frameDeltaToMs(frameDelta, timing) *
        goalHoldMultiplier(marble, mapState.goal),
    );
    terrainView.updateGoalProgress(progress);
    ui.setHint(
      "hold goal " +
        Math.ceil((mapState.goal.holdMs - mapState.goalHoldMs) / 1000) +
        "s",
    );
    hapticFeedback.pulseGoal("hold");

    if (mapState.goalHoldMs >= mapState.goal.holdMs) {
      mapRuntime.completeGoal();
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
