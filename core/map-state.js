import {
  mapObstacleElements,
  mapRoughPatchElements,
  normalizeJoinedObstacleRects
} from "./map.js";
import { createSpatialIndex } from "./spatial-index.js";

export function createResolvedMapState(activeMap, {
  normalizeObstacles = normalizeJoinedObstacleRects
} = {}) {
  const elements = activeMap.elements;
  const obstacles = normalizeObstacles(mapObstacleElements(elements));
  const roughPatches = mapRoughPatchElements(elements);
  return {
    activeMap,
    elements,
    obstacles,
    obstacleIndex: createSpatialIndex(obstacles),
    roughPatches,
    roughPatchIndex: createSpatialIndex(roughPatches),
    goal: activeMap.goal,
    spawn: activeMap.spawn,
    world: activeMap.world
  };
}
