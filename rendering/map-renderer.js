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
  let currentWorld = world;
  const themeState = {};

  function renderMapTheme() {
    drawMapTheme({
      container: mapThemeEl,
      overlayContainer: mapThemeOverlayEl,
      mapConfig: currentMapConfig,
      themeState,
      world: currentWorld,
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
    world = currentWorld,
  }) {
    currentGoal = goal;
    currentMapConfig = mapConfig;
    currentTerrainByType = terrainByType;
    currentObstacles = obstacles;
    currentObstacleBounds = obstacleBounds;
    currentWorld = world;
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

  function updateMapThemeDynamics(marble, previousMarble) {
    updateThemeDynamics({
      container: mapThemeEl,
      overlayContainer: mapThemeOverlayEl,
      mapConfig: currentMapConfig,
      marble,
      previousMarble,
      themeState,
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
  let currentWorld = world;

  function updateIntroBounds() {
    updateIntroMapBounds({
      bounds,
      intro,
      marble,
      viewport: { width: viewport.width(), height: viewport.height() },
      world: currentWorld,
    });
    renderOuterWalls(introWallsEl, introPenWalls(bounds, intro));
  }

  function setReleasedBounds() {
    setReleasedMapBounds(bounds, currentWorld);
  }

  function renderWorldFrame() {
    worldEl.style.width = currentWorld.width + "px";
    worldEl.style.height = currentWorld.height + "px";
    trailEl.setAttribute(
      "viewBox",
      "0 0 " + currentWorld.width + " " + currentWorld.height,
    );
    renderOuterWalls(mapWallsEl, mapEdgeWalls(currentWorld, intro));
  }

  function setup() {
    renderWorldFrame();
    setReleasedBounds();
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

  function setWorld(nextWorld) {
    currentWorld = nextWorld;
    renderWorldFrame();
    setReleasedBounds();
  }

  return {
    openMap,
    resetIntroPen,
    setReleasedBounds,
    setWorld,
    setup,
    updateIntroBounds,
  };
}
