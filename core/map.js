import { validateMapConfig as validateMapConfigWithDeps } from "./map-validation.js";
import {
  MAP_ELEMENT_TYPES,
  mapObstacleElements
} from "./map-elements.js";
import {
  normalizeJoinedObstacleRects
} from "./map-obstacles.js";
import {
  validMapVariants
} from "./map-variants.js";

export {
  introPenWalls,
  mapEdgeWalls,
  setReleasedBounds,
  updateIntroBounds
} from "./map-bounds.js";
export {
  isObstacleElement,
  isRoughPatchElement,
  mapObstacleElements,
  mapRoughPatchElements,
  MAP_ELEMENT_TYPES
} from "./map-elements.js";
export {
  normalizeJoinedObstacleRects,
  snapRectToGrid,
  snapToGrid
} from "./map-obstacles.js";
export {
  hashMapSeed,
  resolveMapVariantConfig,
  resolveSeededMapConfig,
  selectNextMapVariant,
  selectSeededMapVariant,
  validMapVariants
} from "./map-variants.js";

export function validateMapConfig(config, options = {}) {
  return validateMapConfigWithDeps(config, options, {
    elementTypes: MAP_ELEMENT_TYPES,
    normalizeJoinedObstacleRects,
    mapObstacleElements,
    validMapVariants
  });
}
