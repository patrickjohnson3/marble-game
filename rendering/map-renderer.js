export function createTerrainView({
  mapThemeEl,
  mapThemeOverlayEl,
  terrainContainers = {},
  obstaclesEl,
  goalEl,
  goal,
  mapConfig,
  world,
  terrainByType = {},
  obstacles,
  obstacleBounds,
  renderTerrainPatches: drawTerrainPatches = () => {},
  renderMapTheme: drawMapTheme = () => {},
  updateMapThemeDynamics: updateThemeDynamics = () => {},
  renderObstacleWalls,
  goalFillEdgePercent = 70.8,
}) {
  let currentGoal = goal;
  let currentMapConfig = mapConfig;
  let currentTerrainByType = terrainByType;
  let currentObstacles = obstacles;
  let currentObstacleBounds = obstacleBounds;

  function renderMapTheme() {
    drawMapTheme({
      container: mapThemeEl,
      overlayContainer: mapThemeOverlayEl,
      mapConfig: currentMapConfig,
      world,
    });
  }

  function renderObstacles() {
    renderObstacleWalls(
      obstaclesEl,
      currentObstacles,
      currentObstacleBounds,
      currentMapConfig,
    );
  }

  function renderTerrainPatches() {
    Object.entries(terrainContainers).forEach(([type, container]) => {
      const terrain = currentTerrainByType[type] ?? {
        bounds: null,
        elements: [],
      };
      drawTerrainPatches(type, container, terrain.elements, terrain.bounds);
    });
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
    renderTerrainPatches();
    renderObstacles();
  }

  function setTerrain({
    goal,
    mapConfig = currentMapConfig,
    terrainByType = currentTerrainByType,
    obstacles,
    obstacleBounds,
  }) {
    currentGoal = goal;
    currentMapConfig = mapConfig;
    currentTerrainByType = terrainByType;
    currentObstacles = obstacles;
    currentObstacleBounds = obstacleBounds;
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

  function updateMapThemeDynamics(marble) {
    updateThemeDynamics({
      container: mapThemeEl,
      overlayContainer: mapThemeOverlayEl,
      mapConfig: currentMapConfig,
      marble,
    });
  }

  return {
    renderGoal,
    renderMapTheme,
    renderObstacles,
    renderTerrain,
    renderTerrainPatches,
    setTerrain,
    updateGoalProgress,
    updateMapThemeDynamics,
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
