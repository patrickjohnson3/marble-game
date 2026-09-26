import assert from "node:assert/strict";
import {
  appendCockroachCanvas,
  renderCockroach,
} from "../rendering/cockroach-rendering.js";
import {
  renderMapTheme,
  renderMapThemeDynamics,
} from "../rendering/map-theme-rendering.js";
import { createTerrainView } from "../rendering/map-renderer.js";
import { FakeCanvasElement, FakeElement } from "./test-dom.js";

const oldDocument = globalThis.document;
globalThis.document = {
  createElement: (tag) =>
    tag === "canvas" ? new FakeCanvasElement() : new FakeElement(),
};

function cockroachState(overrides = {}) {
  return {
    x: 360,
    y: 280,
    r: 24,
    angle: 0,
    gait: 0,
    mode: "scurry",
    modeFrames: 120,
    ...overrides,
  };
}

try {
  let cockroach = Object.freeze(cockroachState());
  const overlay = new FakeElement();
  const themeState = {};
  appendCockroachCanvas(overlay, themeState, cockroach);
  const canvas = themeState.cockroachCanvas;
  const context = canvas.context;
  assert.equal(overlay.children.length, 1);
  assert.equal(canvas.style.transform, "translate(360px, 280px)");
  assert.equal(canvas.attributes["aria-hidden"], "true");
  assert.ok(
    canvas.width * canvas.height * 4 < 128 * 1024,
    "the antagonist needs only a small local canvas, not another world canvas",
  );
  assert.ok(context.calls.some((call) => call[0] === "ellipse"));
  assert.equal(
    context.calls.some((call) => call[0] === "fillRect"),
    false,
    "an invulnerable cockroach must not acquire a health bar",
  );
  context.calls.length = 0;
  renderCockroach(themeState, cockroach);
  assert.equal(context.calls.length, 0, "a static pose reuses its drawing");
  cockroach = Object.freeze({ ...cockroach, x: 390, modeFrames: 119 });
  renderCockroach(themeState, cockroach);
  assert.equal(canvas.style.transform, "translate(390px, 280px)");
  assert.equal(
    context.calls.length,
    0,
    "translation and gameplay timers do not redraw an unchanged walking pose",
  );

  cockroach = Object.freeze({ ...cockroach, gait: 8 });
  renderCockroach(themeState, cockroach);
  const walkingPose = context.calls.slice();
  assert.ok(walkingPose.length > 0, "travelled distance animates the legs");
  context.calls.length = 0;
  cockroach = Object.freeze({ ...cockroach, mode: "stunned", modeFrames: 30 });
  renderCockroach(themeState, cockroach);
  assert.notDeepEqual(context.calls, walkingPose, "stun has a readable pose");
  const stunnedPose = context.calls.slice();
  context.calls.length = 0;
  cockroach = Object.freeze({ ...cockroach, modeFrames: 29 });
  renderCockroach(themeState, cockroach);
  assert.notDeepEqual(
    context.calls,
    stunnedPose,
    "stun can twitch while still",
  );
  context.calls.length = 0;
  cockroach = Object.freeze({
    ...cockroach,
    mode: "harass",
    angle: Math.PI / 2,
  });
  renderCockroach(themeState, cockroach);
  const heading = context.calls.find((call) => call[0] === "transform");
  assert.ok(Math.abs(heading[1]) < 1e-10 && Math.abs(heading[4]) < 1e-10);
  assert.equal(heading[2], 1);
  assert.equal(heading[3], -1);

  // The long antennae must remain visible while the cockroach turns, including
  // when the runtime radius changes. This checks storage, not cosmetic pixels.
  for (const radius of [24, 30]) {
    for (let i = 0; i < 8; i += 1) {
      cockroach = Object.freeze({
        ...cockroach,
        r: radius,
        angle: (i * Math.PI) / 4,
      });
      context.calls.length = 0;
      renderCockroach(themeState, cockroach);
      const rotation = context.calls.find((call) => call[0] === "transform");
      for (const antenna of context.calls.filter(
        (call) => call[0] === "quadraticCurveTo",
      )) {
        const x =
          canvas.width / 2 +
          rotation[1] * antenna[3] +
          rotation[3] * antenna[4];
        const y =
          canvas.height / 2 +
          rotation[2] * antenna[3] +
          rotation[4] * antenna[4];
        assert.ok(x > 0 && x < canvas.width && y > 0 && y < canvas.height);
      }
    }
  }
  renderCockroach(themeState, null);
  assert.equal(overlay.children.length, 0);
  assert.equal(themeState.cockroachCanvas, null);
  assert.equal(themeState.cockroachContext, null);
  assert.equal(themeState.cockroachPose, null);
  context.calls.length = 0;
  renderCockroach(themeState, cockroach);
  assert.equal(context.calls.length, 0, "a retired canvas must not redraw");

  const mapState = {
    activeMap: {
      theme: "kitchenFloor",
      world: { width: 700, height: 700 },
      objective: { type: "eliminate", target: "ant", count: "all" },
    },
    cockroach: cockroachState(),
    obstacles: [],
    terrainByType: {},
  };
  const dynamicOverlay = new FakeElement();
  const view = createTerrainView({
    mapThemeEl: new FakeElement(),
    mapThemeOverlayEl: dynamicOverlay,
    goalEl: new FakeElement(),
    mapState,
    renderMapTheme,
    renderMapThemeDynamics,
    renderObstacleWalls() {},
  });
  const findCanvas = () =>
    dynamicOverlay.firstChild.children.find(
      (child) => child.className === "cockroachCanvas",
    );
  view.renderTerrain();
  const firstCanvas = findCanvas();
  assert.ok(
    firstCanvas,
    "the terrain view must pass the authoritative actor to its renderer",
  );
  mapState.cockroach.x = 430;
  view.renderMapThemeDynamics();
  assert.equal(firstCanvas.style.transform, "translate(430px, 280px)");
  mapState.cockroach = cockroachState();
  view.renderTerrain();
  const resetCanvas = findCanvas();
  assert.notEqual(
    resetCanvas,
    firstCanvas,
    "Retry replaces disposable rendering state",
  );
  assert.equal(resetCanvas.style.transform, "translate(360px, 280px)");
  const previousCalls = resetCanvas.context.calls.length;
  mapState.activeMap = {
    theme: "parkingLot",
    world: { width: 700, height: 700 },
    goal: { x: 100, y: 100, r: 40 },
  };
  mapState.cockroach = null;
  view.renderTerrain();
  view.renderMapThemeDynamics();
  assert.equal(
    findCanvas(),
    undefined,
    "the actor cannot leak into the next map",
  );
  assert.equal(resetCanvas.context.calls.length, previousCalls);
} finally {
  if (oldDocument === undefined) delete globalThis.document;
  else globalThis.document = oldDocument;
}

console.log("Cockroach rendering tests passed");
