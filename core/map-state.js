import {
  mapObstacleElements,
  mapRoughPatchElements,
  mapSlopeElements,
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
  const obstacles = normalizeObstacles(mapObstacleElements(elements));
  const roughPatches = mapRoughPatchElements(elements);
  const slopeZones = mapSlopeElements(elements);
  return {
    activeMap,
    elements,
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
    slopeZones,
    slopeZoneBounds: rectBounds(slopeZones),
    slopeZoneIndex: createSpatialIndex(slopeZones, {
      cellSize: collisionIndexCellSize,
    }),
    goal: activeMap.goal,
    spawn: activeMap.spawn,
    world: activeMap.world,
  };
}
