import assert from "node:assert/strict";
import { baseMapConfig } from "../core/map-config.js";
import {
  createMapRuntime,
  createResolvedMapState,
} from "../core/map-runtime.js";
import { circleObstacleContact } from "../core/physics-collisions.js";
import { validateMapConfig } from "../core/map-validation.js";
import { resolveMapVariantConfig } from "../core/map-variants.js";
import { expandMap } from "../maps/map-authoring.js";
import { mapDefinitions } from "../maps/map-data.js";
import { livingRoomMap } from "../maps/living-room.js";
import { kitchenFloorMap } from "../maps/kitchen-floor.js";

function clone(value) {
  return globalThis.structuredClone(value);
}
function resolved(definition) {
  return resolveMapVariantConfig(
    { ...baseMapConfig, variants: [expandMap(definition)] },
    definition.id,
  );
}
function rejectsEdit(definition, edit, message) {
  const altered = clone(definition);
  edit(altered);
  const errors = validateMapConfig(resolved(altered));
  assert.ok(
    errors.some((error) => error.includes(message)),
    errors.join("\n"),
  );
}

for (const definition of mapDefinitions) {
  const before = clone(definition);
  const first = expandMap(definition);
  const second = expandMap(definition);
  assert.deepEqual(
    first,
    second,
    "expansion must not depend on randomness or invocation order",
  );
  assert.deepEqual(
    definition,
    before,
    "expansion must not mutate its authored input",
  );
  assert.deepEqual(validateMapConfig(resolved(definition)), []);

  const runtime = createMapRuntime({ initialMap: resolved(definition) });
  const active = runtime.state.activeMap;
  active.objective.type = "changed";
  if (active.regions?.length) active.regions[0].x += 200;
  if (active.clusters?.length) active.clusters[0].ants[0][0] += 200;
  if (active.scenery?.length) active.scenery[0].x += 200;
  runtime.setActiveMap(resolved(definition));
  assert.deepEqual(
    runtime.state.activeMap,
    resolved(definition),
    "Retry must get fresh objective, region, scenery, and nested cluster data",
  );
  assert.deepEqual(definition, before);
}

for (const [field, entry] of [
  ["fixtures", { kind: "invisible-sofa", x: 100, y: 100, w: 100, h: 100 }],
  ["surfaces", { kind: "lava", x: 100, y: 100, w: 100, h: 100 }],
  ["scenery", { kind: "ant", x: 100, y: 100, w: 10, h: 10 }],
  ["clusters", { kind: "colony", x: 100, y: 100 }],
]) {
  const bad = clone(livingRoomMap);
  bad[field] = [entry];
  assert.throws(
    () => expandMap(bad),
    /unknown/,
    "unknown primitives must fail visibly rather than silently disappear",
  );
}
for (const field of ["id", "name", "theme", "world", "objective", "spawn"]) {
  const bad = clone(livingRoomMap);
  delete bad[field];
  assert.throws(() => expandMap(bad), /required|dimensions/);
}
assert.throws(
  () => expandMap({ ...livingRoomMap, fixtures: {} }),
  /fixtures must be an array/,
);
assert.throws(
  () => expandMap({ ...livingRoomMap, theme: "banana" }),
  /unknown authoring theme/,
);
assert.ok(
  validateMapConfig({ ...resolved(livingRoomMap), theme: "banana" }).some(
    (error) => error.includes("unknown authoring theme"),
  ),
);

for (const field of [
  "fixtures",
  "surfaces",
  "obstacles",
  "scenery",
  "clusters",
  "regions",
  "views",
  "route",
]) {
  for (const invalidEntry of [null, 4, []]) {
    assert.throws(
      () => expandMap({ ...livingRoomMap, [field]: [invalidEntry] }),
      new RegExp(field + " 0 must be an object"),
      "authored null/primitive entries must fail before destructuring",
    );
  }
}
for (const field of [
  "elements",
  "regions",
  "clusters",
  "scenery",
  "views",
  "route",
]) {
  const map = resolved(livingRoomMap);
  assert.deepEqual(validateMapConfig({ ...map, [field]: [null] }), [
    `${field} 0 must be an object`,
  ]);
  assert.deepEqual(validateMapConfig({ ...map, [field]: {} }), [
    `${field} must be an array`,
  ]);
}
const missingSpawn = resolved(livingRoomMap);
delete missingSpawn.spawn;
assert.ok(validateMapConfig(missingSpawn).includes("spawn is required"));
assert.deepEqual(
  validateMapConfig(missingSpawn, { spawn: livingRoomMap.spawn }),
  [],
  "geometry validation honors the existing spawn override",
);
assert.ok(
  validateMapConfig({
    ...resolved(livingRoomMap),
    spawn: { x: NaN, y: 100, r: 29 },
  }).some((error) => error.includes("non-finite x")),
);

for (const field of ["hitboxW", "hitboxH"]) {
  rejectsEdit(
    livingRoomMap,
    (map) => {
      map.fixtures[0][field] = 100;
    },
    "hitbox dimensions must match",
  );
}

// A rounded generic block has the same curved silhouette as a named fixture.
const roundedBlockMap = clone(livingRoomMap);
roundedBlockMap.fixtures = [];
roundedBlockMap.obstacles = [
  { x: 100, y: 100, w: 200, h: 100, cornerRadius: 40 },
];
const roundedBlock = createResolvedMapState(expandMap(roundedBlockMap))
  .obstacles[0];
assert.equal(
  circleObstacleContact({ x: 103, y: 103, r: 1 }, roundedBlock).intersects,
  false,
  "rounded empty corners cannot retain square collision",
);
assert.equal(
  circleObstacleContact({ x: 103, y: 150, r: 4 }, roundedBlock).intersects,
  true,
  "the visible side remains solid",
);

// Wall joining must not stretch furniture placed beside another household prop.
const touchingFurniture = clone(livingRoomMap);
touchingFurniture.fixtures = [
  { kind: "sofa", x: 100, y: 100, w: 200, h: 100 },
  { kind: "bookcase", x: 200, y: 50, w: 100, h: 200 },
];
const expandedFurniture = expandMap(touchingFurniture);
const authoredFurniture = expandedFurniture.elements.filter(
  (element) => element.type === "obstacle",
);
const normalizedFurniture = createResolvedMapState(expandedFurniture).obstacles;
for (let index = 0; index < normalizedFurniture.length; index++) {
  for (const field of ["x", "y", "w", "h"]) {
    assert.equal(
      normalizedFurniture[index][field],
      authoredFurniture[index][field],
      "touching furniture must retain its authored footprint",
    );
  }
}

rejectsEdit(
  livingRoomMap,
  (map) => {
    map.objective.type = "collect";
  },
  "unknown objective",
);
rejectsEdit(
  livingRoomMap,
  (map) => {
    map.objective.region = "missing-exit";
  },
  "missing region",
);
rejectsEdit(
  livingRoomMap,
  (map) => {
    map.regions.push({ ...map.regions[0] });
  },
  "unique",
);
rejectsEdit(
  livingRoomMap,
  (map) => {
    map.regions[0].x = 4390;
  },
  "bounds",
);
rejectsEdit(
  livingRoomMap,
  (map) => {
    map.regions[0].r = 1;
  },
  "must be rectangular",
);
for (const id of [
  "overview",
  "spawn",
  "objective",
  "../exit",
  "exit view",
  7,
]) {
  rejectsEdit(
    livingRoomMap,
    (map) => {
      map.views[0].id = id;
    },
    "view ids must be unique, filename-safe",
  );
}
rejectsEdit(
  livingRoomMap,
  (map) => {
    map.views.push({ ...map.views[0] });
  },
  "view ids must be unique, filename-safe",
);
for (const scale of [0, -1, NaN, Infinity, null]) {
  rejectsEdit(
    livingRoomMap,
    (map) => {
      map.views[0].scale = scale;
    },
    "scale must be positive and finite",
  );
}
const zoomedView = clone(livingRoomMap);
zoomedView.views[0].scale = 0.5;
assert.deepEqual(validateMapConfig(resolved(zoomedView)), []);
rejectsEdit(
  livingRoomMap,
  (map) => {
    map.spawn.x = 5;
  },
  "spawn must fit",
);
rejectsEdit(
  livingRoomMap,
  (map) => {
    map.spawn.x = 800;
    map.spawn.y = 900;
  },
  "spawn must not overlap",
);
rejectsEdit(
  livingRoomMap,
  (map) => {
    map.fixtures.push({ kind: "toyBlock", x: 3560, y: 100, w: 180, h: 180 });
  },
  "destination apron",
);
rejectsEdit(
  livingRoomMap,
  (map) => {
    map.fixtures[0].cornerRadius = -1;
  },
  "cornerRadius",
);
rejectsEdit(
  livingRoomMap,
  (map) => {
    map.fixtures[0].kind = "fork";
  },
  "not supported by theme",
);
rejectsEdit(
  livingRoomMap,
  (map) => {
    map.fixtures[3].x = 0;
    map.fixtures[3].angle = Math.PI / 4;
  },
  "rotated footprint",
);
rejectsEdit(
  livingRoomMap,
  (map) => {
    map.route[2] = { x: 2000, y: 2100 };
  },
  "route lacks steering clearance",
);
rejectsEdit(
  livingRoomMap,
  (map) => {
    map.route.pop();
  },
  "route must finish",
);
rejectsEdit(
  livingRoomMap,
  (map) => {
    map.obstacles = [{ x: 0, y: 1360, w: 4400, h: 60 }];
    delete map.route;
  },
  "appear reachable",
);
rejectsEdit(
  kitchenFloorMap,
  (map) => {
    map.objective.target = "crumb";
  },
  "target 'ant'",
);
rejectsEdit(
  kitchenFloorMap,
  (map) => {
    map.clusters = [];
  },
  "authored ant targets",
);
rejectsEdit(
  kitchenFloorMap,
  (map) => {
    map.clusters[0].x = -1000;
  },
  "outside the room",
);
for (const kind of ["sock", "magazine"]) {
  const scenery = [{ kind, x: 600, y: 800, w: 100, h: 80 }];
  assert.throws(
    () => expandMap({ ...kitchenFloorMap, scenery }),
    /generic scenery needs the livingRoom theme/,
  );
  assert.ok(
    validateMapConfig({ ...resolved(kitchenFloorMap), scenery }).includes(
      "generic scenery needs the livingRoom theme",
    ),
    "compiled scenery must not be silently ignored by the kitchen renderer",
  );
}
const readingPile = { kind: "readingPile", x: 600, y: 800 };
assert.throws(
  () =>
    expandMap({
      ...kitchenFloorMap,
      clusters: [...kitchenFloorMap.clusters, readingPile],
    }),
  /readingPile needs the livingRoom theme/,
);
const compiledKitchen = resolved(kitchenFloorMap);
assert.ok(
  validateMapConfig({
    ...compiledKitchen,
    clusters: [...compiledKitchen.clusters, readingPile],
  }).includes("readingPile needs the livingRoom theme"),
);

// Changing scene order must not change which litter/food recipe is requested.
const reordered = clone(kitchenFloorMap);
reordered.clusters.reverse();
const expanded = expandMap(reordered);
assert.equal(expanded.clusters[0].kind, "drinkSpill");
assert.equal(expanded.clusters.at(-1).kind, "cerealPacket");
assert.deepEqual(
  expanded.clusters[0].ants,
  expandMap(kitchenFloorMap).clusters.at(-1).ants,
);

console.log("Map authoring tests passed.");
