import {
  mapObstacleElements,
  mapRoughPatchElements,
  normalizeJoinedObstacleRects
} from "./map.js";

export function createResolvedMapState(activeMap, {
  normalizeObstacles = normalizeJoinedObstacleRects
} = {}) {
  const elements = activeMap.elements;
  return {
    activeMap,
    elements,
    obstacles: normalizeObstacles(mapObstacleElements(elements)),
    roughPatches: mapRoughPatchElements(elements),
    goal: activeMap.goal,
    spawn: activeMap.spawn,
    world: activeMap.world
  };
}
