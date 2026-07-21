export const MAP_ELEMENT_TYPES = Object.freeze({
  icePatch: "icePatch",
  obstacle: "obstacle",
  roughPatch: "roughPatch",
});

function isIcePatchElement(element) {
  return element?.type === MAP_ELEMENT_TYPES.icePatch;
}

function isObstacleElement(element) {
  return element?.type === MAP_ELEMENT_TYPES.obstacle;
}

function isRoughPatchElement(element) {
  return element?.type === MAP_ELEMENT_TYPES.roughPatch;
}

export function mapObstacleElements(elements) {
  return Array.isArray(elements) ? elements.filter(isObstacleElement) : [];
}

export function mapIcePatchElements(elements) {
  return Array.isArray(elements) ? elements.filter(isIcePatchElement) : [];
}

export function mapRoughPatchElements(elements) {
  return Array.isArray(elements) ? elements.filter(isRoughPatchElement) : [];
}
