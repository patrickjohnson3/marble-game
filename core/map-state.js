import {
  mapIcePatchElements,
  mapObstacleElements,
  mapRoughPatchElements,
  normalizeJoinedObstacleRects,
} from "./map.js";
import { rectBounds } from "./rect-bounds.js";
import { createSpatialIndex } from "./spatial-index.js";

export function createResolvedMapState(
  activeMap,
  {
    collisionIndexCellSize = 256,
    normalizeObstacles = normalizeJoinedObstacleRects,
  } = {},
) {
  const elements = activeMap.elements;
  const icePatches = mapIcePatchElements(elements);
  const obstacles = normalizeObstacles(mapObstacleElements(elements));
  const roughPatches = mapRoughPatchElements(elements);
  return {
    activeMap,
    elements,
    icePatches,
    icePatchBounds: rectBounds(icePatches),
    icePatchIndex: createSpatialIndex(icePatches, {
      cellSize: collisionIndexCellSize,
    }),
    obstacles,
    obstacleBounds: rectBounds(obstacles),
    obstacleIndex: createSpatialIndex(obstacles, {
      cellSize: collisionIndexCellSize,
    }),
    roughPatches,
    roughPatchBounds: rectBounds(roughPatches),
    roughPatchIndex: createSpatialIndex(roughPatches, {
      cellSize: collisionIndexCellSize,
    }),
    goal: activeMap.goal,
    spawn: activeMap.spawn,
    world: activeMap.world,
  };
}
