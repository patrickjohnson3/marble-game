import assert from "node:assert/strict";
import { createAppMapController } from "../core/app-map-controller.js";

const firstMap = {
  elements: [],
  goal: { x: 20, y: 20, r: 10, holdMs: 1000 },
  spawn: { x: 10, y: 10, r: 5 },
};
const nextMap = {
  elements: [{ type: "slope", x: 10, y: 20, w: 30, h: 40, dx: 1, dy: 0 }],
  goal: { x: 40, y: 40, r: 10, holdMs: 1000 },
  spawn: { x: 15, y: 15, r: 5 },
};
const mapState = {
  goal: firstMap.goal,
  obstacles: [],
  obstacleBounds: null,
  roughPatches: [],
  roughPatchBounds: null,
  slopeZones: [],
  slopeZoneBounds: null,
  spawn: firstMap.spawn,
};
let appliedTerrain = null;

const controller = createAppMapController({
  cameraController: {
    centerOnMarble() {},
  },
  copy: { mapOpen: "map open." },
  effectsRenderer: { clear() {} },
  intro: {},
  introSequence: { hideMessage() {} },
  mapRenderer: { openMap() {} },
  mapRuntime: {
    state: mapState,
    setActiveMap(map) {
      mapState.goal = map.goal;
      mapState.spawn = map.spawn;
      mapState.slopeZones = map.elements.filter(
        (element) => element.type === "slope",
      );
      mapState.slopeZoneBounds = {
        left: 10,
        top: 20,
        right: 40,
        bottom: 60,
        width: 30,
        height: 40,
      };
    },
  },
  marble: { x: 0, y: 0, vx: 0, vy: 0, roll: 0 },
  terrainView: {
    setTerrain(terrain) {
      appliedTerrain = terrain;
    },
  },
  trailRenderer: { clear() {} },
  ui: { setHint() {} },
});

controller.setCurrentMap(nextMap);

assert.deepEqual(appliedTerrain.slopeZones, nextMap.elements);
assert.deepEqual(appliedTerrain.slopeZoneBounds, {
  left: 10,
  top: 20,
  right: 40,
  bottom: 60,
  width: 30,
  height: 40,
});

console.log("App map controller tests passed.");
