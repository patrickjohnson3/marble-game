import { distance } from "./geometry.js";
import {
  getObjectiveRegion,
  livingAntCount,
  marbleInsideRegion,
  mouseDefeatRequired,
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
    const departureAvailable =
      mapState.departureReady && !mapState.goalCompleted;
    ui.setDepartureAvailable?.(departureAvailable);
    ui.setObjectiveStatus?.(
      mapState.goalCompleted
        ? "Map complete"
        : departureAvailable
          ? "Kitchen clear · Explore or choose Next room"
          : objectiveStatusText(mapState.activeMap, remaining, mapState.mouse),
    );
    return remaining;
  }

  function complete() {
    // Latch before callbacks: a final-ant objective stays true after completion,
    // including when this map has no available successor.
    const celebrate = !mapState.departureReady;
    mapRuntime.completeGoal();
    onComplete(mapState.activeMap);
    if (celebrate) hapticFeedback.pulseGoal("complete");
    goalHapticActive = false;
    mapProgression.advanceToNextMap();
    refreshStatus();
    // Map activation clears old particles. Celebrate at the new spawn so
    // completion remains visible when the destination renders.
    if (celebrate) effectsRenderer.spawnGoalComplete();
  }

  function depart() {
    if (
      !intro.released ||
      mapState.activeMap.objective?.type !== "eliminate" ||
      !mapState.departureReady ||
      mapState.goalCompleted
    )
      return false;
    complete();
    return true;
  }

  function update(frameDelta) {
    const remaining = refreshStatus();
    if (mapState.goalCompleted) return;

    const objective = mapState.activeMap.objective;
    if (objective?.type === "eliminate") {
      goalHapticActive = false;
      // Validation rejects empty populations; don't treat uninitialized dynamics
      // as a victory if a caller updates before map activation has finished.
      if (
        intro.released &&
        kitchenState.ants.length > 0 &&
        remaining === 0 &&
        !mapState.departureReady
      ) {
        // Keep the final crush and room live until the player chooses to leave.
        mapState.departureReady = true;
        hapticFeedback.pulseGoal("complete");
        effectsRenderer.spawnGoalComplete();
        refreshStatus();
      }
      return;
    }

    const region = getObjectiveRegion(mapState.activeMap);
    if (objective?.type === "reach") {
      goalHapticActive = false;
      if (
        intro.released &&
        !mouseDefeatRequired(mapState.activeMap, mapState.mouse) &&
        marbleInsideRegion(marble, region)
      )
        complete();
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
    depart,
    refreshStatus,
    update,
  };
}
