export function createAppMapController({
  cameraController,
  copy,
  effectsRenderer,
  intro,
  introSequence,
  mapRenderer,
  mapRuntime,
  marble,
  terrainView,
  trailRenderer,
  ui,
}) {
  const mapState = mapRuntime.state;

  function releaseMap() {
    intro.released = true;
    mapRenderer.openMap();
    introSequence.hideMessage();
    ui.setHint(copy.mapOpen);
  }

  function setCurrentMap(nextMap) {
    mapRuntime.setActiveMap(nextMap);
    terrainView.setTerrain({
      goal: mapState.goal,
      icePatches: mapState.icePatches,
      icePatchBounds: mapState.icePatchBounds,
      obstacles: mapState.obstacles,
      obstacleBounds: mapState.obstacleBounds,
      roughPatches: mapState.roughPatches,
      roughPatchBounds: mapState.roughPatchBounds,
    });
  }

  function resetForNextMap() {
    marble.x = mapState.spawn.x;
    marble.y = mapState.spawn.y;
    marble.vx = 0;
    marble.vy = 0;
    marble.roll = 0;
    trailRenderer.clear();
    effectsRenderer.clear();
    cameraController.centerOnMarble();
  }

  return {
    releaseMap,
    resetForNextMap,
    setCurrentMap,
  };
}
