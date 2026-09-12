import { distance } from "./geometry.js";
import {
  getObjectiveRegion,
  livingAntCount,
  marbleInsideRegion,
  objectiveStatusText,
} from "./map-objectives.js";

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
  kitchenState = { ants: [] },
  mapProgression,
  mapRuntime,
  marble,
  onComplete = () => {},
  terrainView,
  timing,
  ui,
}) {
  const mapState = mapRuntime.state;
  let goalHapticActive = false;

  function refreshStatus() {
    const remaining = livingAntCount(kitchenState.ants);
    ui.setObjectiveStatus?.(
      mapState.goalCompleted
        ? "Map complete"
        : objectiveStatusText(mapState.activeMap, remaining),
    );
    return remaining;
  }

  function complete() {
    // Latch before callbacks: a final-ant objective stays true after completion,
    // including when this map has no available successor.
    mapRuntime.completeGoal();
    onComplete(mapState.activeMap);
    hapticFeedback.pulseGoal("complete");
    goalHapticActive = false;
    mapProgression.advanceToNextMap();
    refreshStatus();
    // Map activation clears old particles. Celebrate at the new spawn so
    // completion remains visible when the destination renders.
    effectsRenderer.spawnGoalComplete();
  }

  function update(frameDelta) {
    const remaining = refreshStatus();
    if (mapState.goalCompleted) return;

    const objective = mapState.activeMap.objective;
    if (objective?.type === "eliminate") {
      goalHapticActive = false;
      // Validation rejects empty populations; don't treat uninitialized dynamics
      // as a victory if a caller updates before map activation has finished.
      if (intro.released && kitchenState.ants.length > 0 && remaining === 0) {
        complete();
      }
      return;
    }

    const region = getObjectiveRegion(mapState.activeMap);
    if (objective?.type === "reach") {
      goalHapticActive = false;
      if (intro.released && marbleInsideRegion(marble, region)) complete();
      return;
    }

    if (!intro.released || !marbleInsideRegion(marble, region)) {
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

    const goal = mapState.activeMap.goal;
    const multiplier = goalHoldMultiplier(marble, goal);
    const progress = mapRuntime.addGoalHold(
      frameDeltaToMs(frameDelta, timing) * multiplier,
    );
    terrainView.updateGoalProgress(progress);
    ui.setHint(goalHoldHint(goal.holdMs - mapState.goalHoldMs, multiplier));
    hapticFeedback.pulseGoal("hold");

    if (mapState.goalHoldMs >= goal.holdMs) {
      complete();
    }
  }

  return {
    refreshStatus,
    update,
  };
}
