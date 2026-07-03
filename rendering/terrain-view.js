export function createTerrainView({
  roughPatchesEl,
  obstaclesEl,
  roughPatches,
  obstacles,
  intro,
  marble,
  marbleOverRect,
  renderMapElements
}) {
  function renderObstacles() {
    renderMapElements(obstaclesEl, "obstacle", obstacles);
  }

  function renderRoughPatches() {
    renderMapElements(roughPatchesEl, "roughPatch", roughPatches);
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
    renderObstacles,
    renderRoughPatches,
    updateRoughPatchFeedback
  };
}
