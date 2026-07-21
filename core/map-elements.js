export const MAP_ELEMENT_TYPES = Object.freeze({
  icePatch: "icePatch",
  obstacle: "obstacle",
  roughPatch: "roughPatch",
});

export const MAP_ELEMENT_REGISTRY = Object.freeze({
  [MAP_ELEMENT_TYPES.icePatch]: Object.freeze({
    type: MAP_ELEMENT_TYPES.icePatch,
    terrain: true,
  }),
  [MAP_ELEMENT_TYPES.obstacle]: Object.freeze({
    type: MAP_ELEMENT_TYPES.obstacle,
    obstacle: true,
  }),
  [MAP_ELEMENT_TYPES.roughPatch]: Object.freeze({
    type: MAP_ELEMENT_TYPES.roughPatch,
    terrain: true,
  }),
});

export const MAP_ELEMENT_TYPE_VALUES = Object.freeze(
  Object.keys(MAP_ELEMENT_REGISTRY),
);

export const MAP_TERRAIN_TYPES = Object.freeze(
  MAP_ELEMENT_TYPE_VALUES.filter((type) => MAP_ELEMENT_REGISTRY[type].terrain),
);

function isElementType(element, type) {
  return element?.type === type;
}

export function mapElementsOfType(elements, type) {
  return Array.isArray(elements)
    ? elements.filter((element) => isElementType(element, type))
    : [];
}

export function mapObstacleElements(elements) {
  return mapElementsOfType(elements, MAP_ELEMENT_TYPES.obstacle);
}

export function mapIcePatchElements(elements) {
  return mapElementsOfType(elements, MAP_ELEMENT_TYPES.icePatch);
}

export function mapRoughPatchElements(elements) {
  return mapElementsOfType(elements, MAP_ELEMENT_TYPES.roughPatch);
}

export function mapElementsByType(elements) {
  return Object.fromEntries(
    MAP_ELEMENT_TYPE_VALUES.map((type) => [
      type,
      mapElementsOfType(elements, type),
    ]),
  );
}
