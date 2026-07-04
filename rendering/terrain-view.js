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
  function renderObstacles() {
    renderObstacleWalls(obstaclesEl, obstacles);
  }

  function renderRoughPatches() {
    renderMapElements(roughPatchesEl, "roughPatch", roughPatches);
  }

  function renderGoal() {
    goalEl.style.left = (goal.x - goal.r) + "px";
    goalEl.style.top = (goal.y - goal.r) + "px";
    goalEl.style.width = (goal.r * 2) + "px";
    goalEl.style.height = (goal.r * 2) + "px";
  }

  function updateRoughPatchFeedback() {
    const patchEls = roughPatchesEl.children;
    roughPatches.forEach((patch, index) => {
      patchEls[index]?.classList.toggle(
        "active",
        intro.released && marbleOverRect(marble, patch)
      );
    });
  }

  return {
    renderGoal,
    renderObstacles,
    renderRoughPatches,
    updateRoughPatchFeedback
  };
}
