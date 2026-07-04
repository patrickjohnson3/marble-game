export function createTerrainView({
  roughPatchesEl,
  obstaclesEl,
  goalEl,
  goal,
  roughPatches,
  obstacles,
  intro,
  marble,
  marbleOverRect,
  renderObstacleWalls,
  renderMapElements
}) {
  let currentGoal = goal;
  let currentObstacles = obstacles;
  let currentRoughPatches = roughPatches;

  function renderObstacles() {
    renderObstacleWalls(obstaclesEl, currentObstacles);
  }

  function renderRoughPatches() {
    renderMapElements(roughPatchesEl, "roughPatch", currentRoughPatches);
  }

  function renderGoal() {
    goalEl.style.left = (currentGoal.x - currentGoal.r) + "px";
    goalEl.style.top = (currentGoal.y - currentGoal.r) + "px";
    goalEl.style.width = (currentGoal.r * 2) + "px";
    goalEl.style.height = (currentGoal.r * 2) + "px";
    updateGoalProgress(0);
  }

  function renderTerrain() {
    renderGoal();
    renderRoughPatches();
    renderObstacles();
  }

  function setTerrain({ goal, obstacles, roughPatches }) {
    currentGoal = goal;
    currentObstacles = obstacles;
    currentRoughPatches = roughPatches;
    renderTerrain();
  }

  function updateGoalProgress(progress) {
    goalEl.classList.toggle("active", progress > 0);
    goalEl.style.setProperty("--goal-progress", Math.max(0, Math.min(progress, 1) * 100).toFixed(1) + "%");
  }

  function updateRoughPatchFeedback() {
    const patchEls = roughPatchesEl.children;
    currentRoughPatches.forEach((patch, index) => {
      patchEls[index]?.classList.toggle(
        "active",
        intro.released && marbleOverRect(marble, patch)
      );
    });
  }

  return {
    renderGoal,
    renderObstacles,
    renderTerrain,
    renderRoughPatches,
    setTerrain,
    updateGoalProgress,
    updateRoughPatchFeedback
  };
}
