export const MAP_ELEMENT_TYPES = Object.freeze({
  gooPatch: "gooPatch",
  hazardPatch: "hazardPatch",
  icePatch: "icePatch",
  obstacle: "obstacle",
  roughPatch: "roughPatch",
  waterPatch: "waterPatch",
});

// Shared by movement, tiny-creature avoidance, and liquid rendering. These
// footprints describe gameplay contact; decorative menisci stay close to them.
export const ELLIPTICAL_SURFACE_SHAPES = Object.freeze({
  [MAP_ELEMENT_TYPES.gooPatch]: Object.freeze({
    centerX: 0.52,
    centerY: 0.5,
    radiusX: 0.5,
    radiusY: 0.47,
    cos: Math.cos(0.1),
    sin: Math.sin(0.1),
  }),
  [MAP_ELEMENT_TYPES.waterPatch]: Object.freeze({
    centerX: 0.5,
    centerY: 0.52,
    radiusX: 0.44,
    radiusY: 0.35,
    cos: 1,
    sin: 0,
  }),
});

export const KITCHEN_FIXTURES = Object.freeze({
  fork: "fork",
  spoon: "spoon",
  sponge: "sponge",
});

const kitchenFixtureValues = new Set(Object.values(KITCHEN_FIXTURES));

export function isKitchenFixture(value) {
  return kitchenFixtureValues.has(value);
}

export const MAP_ELEMENT_TYPE_VALUES = Object.freeze([
  MAP_ELEMENT_TYPES.gooPatch,
  MAP_ELEMENT_TYPES.hazardPatch,
  MAP_ELEMENT_TYPES.icePatch,
  MAP_ELEMENT_TYPES.obstacle,
  MAP_ELEMENT_TYPES.roughPatch,
  MAP_ELEMENT_TYPES.waterPatch,
]);

export const MAP_TERRAIN_TYPES = Object.freeze([
  MAP_ELEMENT_TYPES.gooPatch,
  MAP_ELEMENT_TYPES.hazardPatch,
  MAP_ELEMENT_TYPES.icePatch,
  MAP_ELEMENT_TYPES.roughPatch,
  MAP_ELEMENT_TYPES.waterPatch,
]);

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

export function mapHazardPatchElements(elements) {
  return mapElementsOfType(elements, MAP_ELEMENT_TYPES.hazardPatch);
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
