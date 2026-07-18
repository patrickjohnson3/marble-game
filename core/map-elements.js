export const MAP_ELEMENT_TYPES = Object.freeze({
  obstacle: "obstacle",
  roughPatch: "roughPatch",
  slope: "slope",
});

export function isObstacleElement(element) {
  return element?.type === MAP_ELEMENT_TYPES.obstacle;
}

export function isRoughPatchElement(element) {
  return element?.type === MAP_ELEMENT_TYPES.roughPatch;
}

export function isSlopeElement(element) {
  return element?.type === MAP_ELEMENT_TYPES.slope;
}

export function mapObstacleElements(elements) {
  return Array.isArray(elements) ? elements.filter(isObstacleElement) : [];
}

export function mapRoughPatchElements(elements) {
  return Array.isArray(elements) ? elements.filter(isRoughPatchElement) : [];
}

export function mapSlopeElements(elements) {
  return Array.isArray(elements) ? elements.filter(isSlopeElement) : [];
}
