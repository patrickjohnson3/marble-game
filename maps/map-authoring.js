import { KITCHEN_FIXTURES } from "../core/map-elements.js";
import { kitchenClusterPatterns } from "./kitchen-layout.js";

// Concrete authoring vocabulary. Expansion happens once, never in the frame loop.
export const authoredThemes = Object.freeze(["kitchenFloor", "livingRoom"]);
export const surfaceTypes = Object.freeze({
  water: "waterPatch",
  goo: "gooPatch",
  rough: "roughPatch",
  shag: "roughPatch",
  ice: "icePatch",
  hazard: "hazardPatch",
});
export const fixtureKinds = Object.freeze([
  ...Object.values(KITCHEN_FIXTURES),
  "sofa",
  "coffeeTable",
  "bookcase",
  "toyBlock",
]);
export const sceneryKinds = Object.freeze(["sock", "magazine"]);
export const clusterKinds = Object.freeze([
  ...Object.keys(kitchenClusterPatterns),
  "readingPile",
]);

function requireKind(kinds, kind, category, mapId) {
  if (!kinds.includes(kind))
    throw new Error(`${mapId}: unknown ${category} '${kind}'`);
}

export function expandMap(definition) {
  if (!definition || typeof definition !== "object")
    throw new Error("map definition must be an object");
  for (const key of ["id", "name", "theme"]) {
    if (typeof definition[key] !== "string" || !definition[key].trim())
      throw new Error(`map ${key} is required`);
  }
  requireKind(
    authoredThemes,
    definition.theme,
    "authoring theme",
    definition.id,
  );
  if (
    !definition.world ||
    ![definition.world.width, definition.world.height].every(
      (value) => Number.isFinite(value) && value > 0,
    )
  )
    throw new Error(`${definition.id}: world needs positive finite dimensions`);
  for (const key of ["spawn", "objective"]) {
    if (
      !definition[key] ||
      typeof definition[key] !== "object" ||
      Array.isArray(definition[key])
    )
      throw new Error(
        `${definition.id}: ${key} is required and must be an object`,
      );
  }
  for (const key of [
    "surfaces",
    "fixtures",
    "obstacles",
    "clusters",
    "scenery",
    "regions",
    "views",
    "route",
  ]) {
    if (definition[key] !== undefined && !Array.isArray(definition[key]))
      throw new Error(`${definition.id}: ${key} must be an array`);
    for (const [index, item] of (definition[key] ?? []).entries()) {
      if (!item || typeof item !== "object" || Array.isArray(item))
        throw new Error(`${definition.id}: ${key} ${index} must be an object`);
    }
  }
  const {
    surfaces = [],
    fixtures = [],
    obstacles = [],
    clusters = [],
    scenery = [],
    ...map
  } = definition;
  const elements = surfaces.map(({ kind, ...rect }) => {
    requireKind(Object.keys(surfaceTypes), kind, "surface", map.id);
    return {
      ...rect,
      type: surfaceTypes[kind],
      ...(kind === "shag" ? { material: "shag" } : {}),
    };
  });
  for (const { kind, ...rect } of fixtures) {
    requireKind(fixtureKinds, kind, "fixture", map.id);
    elements.push({
      ...rect,
      type: "obstacle",
      fixture: kind,
      angle: rect.angle ?? 0,
    });
  }
  elements.push(
    ...obstacles.map((rect) => ({
      ...rect,
      type: "obstacle",
      ...(rect.cornerRadius !== undefined ? { angle: rect.angle ?? 0 } : {}),
    })),
  );
  const dressing = scenery.map((item) => {
    requireKind(sceneryKinds, item.kind, "scenery", map.id);
    return { ...item };
  });
  if (dressing.length > 0 && map.theme !== "livingRoom")
    throw new Error(`${map.id}: generic scenery needs the livingRoom theme`);
  const kitchenClusters = [];
  for (const cluster of clusters) {
    requireKind(clusterKinds, cluster.kind, "cluster", map.id);
    const pattern = kitchenClusterPatterns[cluster.kind];
    if (pattern) {
      if (map.theme !== "kitchenFloor")
        throw new Error(
          `${map.id}: ${cluster.kind} needs kitchenFloor dynamics`,
        );
      // Retain the kitchen's existing normalized layout and 4400-unit recipes.
      kitchenClusters.push({
        ...cluster,
        x: cluster.x / map.world.width,
        y: cluster.y / map.world.height,
        angle: cluster.angle ?? 0,
        ...pattern,
      });
    } else {
      if (map.theme !== "livingRoom")
        throw new Error(`${map.id}: readingPile needs the livingRoom theme`);
      // A reusable reading spot: two flat magazines and a dropped sock.
      const cos = Math.cos(cluster.angle ?? 0),
        sin = Math.sin(cluster.angle ?? 0);
      for (const item of [
        { kind: "magazine", x: 0, y: 0, w: 190, h: 140, angle: -0.12 },
        { kind: "magazine", x: 100, y: 80, w: 160, h: 120, angle: 0.2 },
        { kind: "sock", x: -120, y: 190, w: 180, h: 70, angle: -0.4 },
      ]) {
        dressing.push({
          ...item,
          x: cluster.x + item.x * cos - item.y * sin,
          y: cluster.y + item.x * sin + item.y * cos,
          angle: (cluster.angle ?? 0) + item.angle,
        });
      }
    }
  }
  return { ...map, elements, clusters: kitchenClusters, scenery: dressing };
}
