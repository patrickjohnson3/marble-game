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
  renderWalls,
  introPenWalls,
  mapEdgeWalls,
  setReleasedMapBounds,
  updateIntroMapBounds
}) {
  function updateIntroBounds() {
    updateIntroMapBounds({
      bounds,
      intro,
      marble,
      viewport: { width: viewport.width(), height: viewport.height() },
      world
    });
    renderWalls(introWallsEl, introPenWalls(bounds, intro));
  }

  function setReleasedBounds() {
    setReleasedMapBounds(bounds, world);
  }

  function setup() {
    worldEl.style.width = world.width + "px";
    worldEl.style.height = world.height + "px";
    trailEl.setAttribute("viewBox", "0 0 " + world.width + " " + world.height);
    setReleasedBounds();
    renderWalls(mapWallsEl, mapEdgeWalls(world, intro));
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
    updateIntroBounds
  };
}
