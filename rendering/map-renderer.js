export function createTerrainView({
  mapThemeEl,
  mapThemeOverlayEl,
  hazardPatchesEl,
  icePatchesEl,
  roughPatchesEl,
  obstaclesEl,
  goalEl,
  goal,
  mapConfig,
  world,
  hazardPatches = [],
  hazardPatchBounds = null,
  icePatches,
  icePatchBounds,
  roughPatches,
  roughPatchBounds,
  obstacles,
  obstacleBounds,
  renderHazardPatches: drawHazardPatches = () => {},
  renderIcePatches: drawIcePatches = () => {},
  renderMapTheme: drawMapTheme = () => {},
  renderObstacleWalls,
  renderRoughPatches: drawRoughPatches,
  goalFillEdgePercent = 70.8,
}) {
  let currentGoal = goal;
  let currentMapConfig = mapConfig;
  let currentHazardPatches = hazardPatches;
  let currentHazardPatchBounds = hazardPatchBounds;
  let currentObstacles = obstacles;
  let currentObstacleBounds = obstacleBounds;
  let currentIcePatches = icePatches;
  let currentIcePatchBounds = icePatchBounds;
  let currentRoughPatches = roughPatches;
  let currentRoughPatchBounds = roughPatchBounds;

  function renderMapTheme() {
    drawMapTheme({
      container: mapThemeEl,
      overlayContainer: mapThemeOverlayEl,
      mapConfig: currentMapConfig,
      world,
    });
  }

  function renderHazardPatches() {
    drawHazardPatches(
      hazardPatchesEl,
      currentHazardPatches,
      currentHazardPatchBounds,
    );
  }

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
    renderMapTheme();
    renderGoal();
    renderHazardPatches();
    renderIcePatches();
    renderRoughPatches();
    renderObstacles();
  }

  function terrainMatches({
    goal,
    mapConfig,
    hazardPatches,
    hazardPatchBounds,
    icePatches,
    icePatchBounds,
    obstacles,
    obstacleBounds,
    roughPatches,
    roughPatchBounds,
  }) {
    return (
      currentGoal === goal &&
      currentMapConfig === mapConfig &&
      currentHazardPatches === hazardPatches &&
      currentHazardPatchBounds === hazardPatchBounds &&
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
    mapConfig = currentMapConfig,
    hazardPatches = currentHazardPatches,
    hazardPatchBounds = currentHazardPatchBounds,
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
        mapConfig,
        hazardPatches,
        hazardPatchBounds,
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
    currentMapConfig = mapConfig;
    currentHazardPatches = hazardPatches;
    currentHazardPatchBounds = hazardPatchBounds;
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
    renderHazardPatches,
    renderIcePatches,
    renderMapTheme,
    renderObstacles,
    renderTerrain,
    renderRoughPatches,
    setTerrain,
    updateGoalProgress,
  };
}

export function createMapRenderer({
  worldEl,
  introWallsEl,
  mapWallsEl,
  trailEl,
  bounds,
  intro,
  marble,
  world,
  viewport,
  terrainView,
  renderOuterWalls,
  introPenWalls,
  mapEdgeWalls,
  setReleasedMapBounds,
  updateIntroMapBounds,
}) {
  function updateIntroBounds() {
    updateIntroMapBounds({
      bounds,
      intro,
      marble,
      viewport: { width: viewport.width(), height: viewport.height() },
      world,
    });
    renderOuterWalls(introWallsEl, introPenWalls(bounds, intro));
  }

  function setReleasedBounds() {
    setReleasedMapBounds(bounds, world);
  }

  function setup() {
    worldEl.style.width = world.width + "px";
    worldEl.style.height = world.height + "px";
    trailEl.setAttribute("viewBox", "0 0 " + world.width + " " + world.height);
    setReleasedBounds();
    renderOuterWalls(mapWallsEl, mapEdgeWalls(world, intro));
    terrainView.renderTerrain();
    updateIntroBounds();
  }

  function openMap() {
    introWallsEl.replaceChildren();
    worldEl.classList.add("map-open");
    setReleasedBounds();
  }

  function resetIntroPen() {
    worldEl.classList.remove("map-open");
    setReleasedBounds();
    updateIntroBounds();
  }

  return {
    openMap,
    resetIntroPen,
    setReleasedBounds,
    setup,
    updateIntroBounds,
  };
}
