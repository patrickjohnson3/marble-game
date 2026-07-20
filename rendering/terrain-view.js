export function createTerrainView({
  icePatchesEl,
  roughPatchesEl,
  obstaclesEl,
  goalEl,
  goal,
  icePatches,
  icePatchBounds,
  roughPatches,
  roughPatchBounds,
  obstacles,
  obstacleBounds,
  renderIcePatches: drawIcePatches = () => {},
  renderObstacleWalls,
  renderRoughPatches: drawRoughPatches,
  goalFillEdgePercent = 70.8,
}) {
  let currentGoal = goal;
  let currentObstacles = obstacles;
  let currentObstacleBounds = obstacleBounds;
  let currentIcePatches = icePatches;
  let currentIcePatchBounds = icePatchBounds;
  let currentRoughPatches = roughPatches;
  let currentRoughPatchBounds = roughPatchBounds;

  function renderIcePatches() {
    drawIcePatches(icePatchesEl, currentIcePatches, currentIcePatchBounds);
  }

  function renderObstacles() {
    renderObstacleWalls(obstaclesEl, currentObstacles, currentObstacleBounds);
  }

  function renderRoughPatches() {
    drawRoughPatches(
      roughPatchesEl,
      currentRoughPatches,
      currentRoughPatchBounds,
    );
  }

  function renderGoal() {
    goalEl.style.left = currentGoal.x - currentGoal.r + "px";
    goalEl.style.top = currentGoal.y - currentGoal.r + "px";
    goalEl.style.width = currentGoal.r * 2 + "px";
    goalEl.style.height = currentGoal.r * 2 + "px";
    updateGoalProgress(0);
  }

  function renderTerrain() {
    renderGoal();
    renderIcePatches();
    renderRoughPatches();
    renderObstacles();
  }

  function terrainMatches({
    goal,
    icePatches,
    icePatchBounds,
    obstacles,
    obstacleBounds,
    roughPatches,
    roughPatchBounds,
  }) {
    return (
      currentGoal === goal &&
      currentIcePatches === icePatches &&
      currentIcePatchBounds === icePatchBounds &&
      currentObstacles === obstacles &&
      currentObstacleBounds === obstacleBounds &&
      currentRoughPatches === roughPatches &&
      currentRoughPatchBounds === roughPatchBounds
    );
  }

  function setTerrain({
    goal,
    icePatches,
    icePatchBounds,
    obstacles,
    obstacleBounds,
    roughPatches,
    roughPatchBounds,
  }) {
    if (
      terrainMatches({
        goal,
        icePatches,
        icePatchBounds,
        obstacles,
        obstacleBounds,
        roughPatches,
        roughPatchBounds,
      })
    )
      return;

    currentGoal = goal;
    currentIcePatches = icePatches;
    currentIcePatchBounds = icePatchBounds;
    currentObstacles = obstacles;
    currentObstacleBounds = obstacleBounds;
    currentRoughPatches = roughPatches;
    currentRoughPatchBounds = roughPatchBounds;
    renderTerrain();
  }

  function updateGoalProgress(progress) {
    const clampedProgress = Math.max(0, Math.min(progress, 1));
    goalEl.classList.toggle("active", clampedProgress > 0);
    goalEl.style.setProperty(
      "--goal-fill-radius",
      (clampedProgress * goalFillEdgePercent).toFixed(1) + "%",
    );
  }

  return {
    renderGoal,
    renderIcePatches,
    renderObstacles,
    renderTerrain,
    renderRoughPatches,
    setTerrain,
    updateGoalProgress,
  };
}
