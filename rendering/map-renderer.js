import { getObjectiveRegion } from "../core/map-objectives.js";

export function createTerrainView({
  mapThemeEl,
  mapThemeOverlayEl,
  terrainContainers = {},
  obstaclesEl,
  hitboxesEl,
  goalEl,
  mapState,
  dynamicsState = { ants: [], cheerios: [] },
  renderTerrainPatches: drawTerrainPatches = () => {},
  renderMapTheme: drawMapTheme = () => {},
  renderMapThemeDynamics: drawMapThemeDynamics = () => {},
  renderObstacleWalls,
  renderObstacleHitboxes,
  goalFillEdgePercent = 70.8,
  hitboxOverlayEnabled = false,
}) {
  let currentHitboxOverlayEnabled = hitboxOverlayEnabled;
  const themeState = {};

  function applyHitboxOverlayVisibility() {
    hitboxesEl?.classList.toggle("show", currentHitboxOverlayEnabled);
  }

  function renderMapTheme() {
    drawMapTheme({
      container: mapThemeEl,
      dynamicsState,
      overlayContainer: mapThemeOverlayEl,
      mapConfig: mapState.activeMap,
      themeState,
      world: mapState.activeMap.world,
    });
  }

  function renderObstacles() {
    renderObstacleWalls(
      obstaclesEl,
      mapState.obstacles,
      mapState.obstacleBounds,
      mapState.activeMap,
    );
  }

  function renderHitboxes() {
    if (!currentHitboxOverlayEnabled) {
      hitboxesEl?.replaceChildren();
      applyHitboxOverlayVisibility();
      return;
    }

    renderObstacleHitboxes?.(hitboxesEl, mapState.obstacles, {
      bounds: mapState.obstacleBounds,
    });
    applyHitboxOverlayVisibility();
  }

  function setHitboxOverlayEnabled(enabled) {
    const nextEnabled = Boolean(enabled);
    if (currentHitboxOverlayEnabled === nextEnabled) {
      applyHitboxOverlayVisibility();
      return;
    }

    currentHitboxOverlayEnabled = nextEnabled;
    renderHitboxes();
  }

  function renderMovedObstacles() {
    renderObstacles();
    if (currentHitboxOverlayEnabled) renderHitboxes();
  }

  function renderTerrainType(type) {
    const container = terrainContainers[type];
    if (!container) return;

    const terrain = mapState.terrainByType[type] ?? {
      bounds: null,
      elements: [],
    };
    drawTerrainPatches(type, container, terrain.elements, terrain.bounds);
  }

  function renderTerrainPatches() {
    Object.keys(terrainContainers).forEach(renderTerrainType);
  }

  function renderGoal() {
    const goal = getObjectiveRegion(mapState.activeMap);
    goalEl.hidden = !goal;
    const reach = mapState.activeMap.objective?.type === "reach";
    goalEl.classList.toggle("destination", reach);
    goalEl.textContent = reach ? (goal.label ?? "Exit") : "";
    if (!goal) return;

    goalEl.style.left = (reach ? goal.x : goal.x - goal.r) + "px";
    goalEl.style.top = (reach ? goal.y : goal.y - goal.r) + "px";
    goalEl.style.width = (reach ? goal.w : goal.r * 2) + "px";
    goalEl.style.height = (reach ? goal.h : goal.r * 2) + "px";
    updateGoalProgress(0);
  }

  function renderTerrain() {
    renderMapTheme();
    renderGoal();
    renderTerrainPatches();
    renderObstacles();
    renderHitboxes();
  }

  function updateGoalProgress(progress) {
    const clampedProgress = Math.max(0, Math.min(progress, 1));
    goalEl.classList.toggle("active", clampedProgress > 0);
    goalEl.style.setProperty(
      "--goal-fill-radius",
      (clampedProgress * goalFillEdgePercent).toFixed(1) + "%",
    );
  }

  function renderMapThemeDynamics() {
    drawMapThemeDynamics({
      dynamicsState,
      mapConfig: mapState.activeMap,
      themeState,
    });
  }

  return {
    renderMovedObstacles,
    renderTerrain,
    renderTerrainType,
    setHitboxOverlayEnabled,
    updateGoalProgress,
    renderMapThemeDynamics,
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
  mapState,
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
      world: mapState.activeMap.world,
    });
    renderOuterWalls(introWallsEl, introPenWalls(bounds, intro));
  }

  function setReleasedBounds() {
    setReleasedMapBounds(bounds, mapState.activeMap.world);
  }

  function renderWorldFrame() {
    const world = mapState.activeMap.world;
    worldEl.style.width = world.width + "px";
    worldEl.style.height = world.height + "px";
    trailEl.setAttribute("viewBox", "0 0 " + world.width + " " + world.height);
    renderOuterWalls(mapWallsEl, mapEdgeWalls(world, intro));
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

  function syncWorld() {
    renderWorldFrame();
    setReleasedBounds();
  }

  return {
    openMap,
    resetIntroPen,
    syncWorld,
    setup,
    updateIntroBounds,
  };
}
