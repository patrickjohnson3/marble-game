export function createTerrainView({
  roughPatchesEl,
  obstaclesEl,
  goalEl,
  goal,
  roughPatches,
  roughPatchBounds,
  obstacles,
  obstacleBounds,
  renderObstacleWalls,
  renderRoughPatches: drawRoughPatches,
  goalFillEdgePercent = 70.8
}) {
  let currentGoal = goal;
  let currentObstacles = obstacles;
  let currentObstacleBounds = obstacleBounds;
  let currentRoughPatches = roughPatches;
  let currentRoughPatchBounds = roughPatchBounds;

  function renderObstacles() {
    renderObstacleWalls(obstaclesEl, currentObstacles, currentObstacleBounds);
  }

  function renderRoughPatches() {
    drawRoughPatches(roughPatchesEl, currentRoughPatches, currentRoughPatchBounds);
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

  function setTerrain({ goal, obstacles, obstacleBounds, roughPatches, roughPatchBounds }) {
    currentGoal = goal;
    currentObstacles = obstacles;
    currentObstacleBounds = obstacleBounds;
    currentRoughPatches = roughPatches;
    currentRoughPatchBounds = roughPatchBounds;
    renderTerrain();
  }

  function updateGoalProgress(progress) {
    const clampedProgress = Math.max(0, Math.min(progress, 1));
    goalEl.classList.toggle("active", clampedProgress > 0);
    goalEl.style.setProperty("--goal-fill-radius", (clampedProgress * goalFillEdgePercent).toFixed(1) + "%");
  }

  return {
    renderGoal,
    renderObstacles,
    renderTerrain,
    renderRoughPatches,
    setTerrain,
    updateGoalProgress
  };
}
