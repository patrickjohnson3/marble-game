import assert from "node:assert/strict";
import { getEventListeners } from "node:events";
import { resolvedMapConfig } from "../core/map-config.js";
import { createKitchenDynamics } from "../core/kitchen-dynamics.js";
import { renderMapTheme } from "../rendering/map-theme-rendering.js";
import { FakeCanvasElement, FakeElement } from "./test-dom.js";

const originalDocument = globalThis.document;
const originalImage = globalThis.Image;
const originalRaf = globalThis.requestAnimationFrame;
const images = [];
const frames = [];
globalThis.Image = class extends globalThis.EventTarget {
  complete = false;
  naturalWidth = 0;
  constructor() {
    super();
    images.push(this);
  }
};
globalThis.document = {
  createElement: (tag) =>
    tag === "canvas" ? new FakeCanvasElement() : new FakeElement(),
};
globalThis.requestAnimationFrame = (callback) => frames.push(callback);

try {
  const mapConfig = {
    theme: "kitchenFloor",
    clusters: resolvedMapConfig.clusters,
  };
  const world = { width: 4400, height: 4400 };
  const dynamics = createKitchenDynamics();
  dynamics.reset({ mapConfig, world });
  const themeState = {};
  const container = new FakeElement();
  const overlayContainer = new FakeElement();
  const render = (map = mapConfig) =>
    renderMapTheme({
      container,
      overlayContainer,
      themeState,
      world,
      mapConfig: map,
      dynamicsState: dynamics.state,
    });
  const flushFrames = () => {
    while (frames.length) frames.shift()();
  };
  const drawsSprite = (canvas) =>
    canvas.context.calls.some(([name]) => name === "drawImage");

  render();
  flushFrames();
  const sprite = images.find(
    (image) => image.src === "assets/sprites/cheerio.png",
  );
  assert.ok(sprite);
  const fallback = themeState.kitchenDynamicCanvas;
  assert.equal(drawsSprite(fallback), false);
  assert.ok(fallback.context.calls.some(([name]) => name === "fill"));
  sprite.complete = true;
  sprite.dispatchEvent(new globalThis.Event("error"));
  assert.equal(
    getEventListeners(sprite, "load").length,
    0,
    "failed loading must release the canvas captured by its load callback",
  );
  assert.equal(getEventListeners(sprite, "error").length, 0);
  render();
  flushFrames();
  assert.equal(
    drawsSprite(themeState.kitchenDynamicCanvas),
    false,
    "Retry after failure must keep the fallback usable",
  );

  // Model a pending download across repeated kitchen renders (Retry).
  sprite.complete = false;
  const retired = [];
  for (let retry = 0; retry < 4; retry++) {
    if (retry) retired.push(themeState.kitchenDynamicCanvas);
    render();
    flushFrames();
    assert.equal(
      getEventListeners(sprite, "load").length,
      1,
      "only the current kitchen canvas may wait for the shared sprite",
    );
    assert.equal(getEventListeners(sprite, "error").length, 1);
  }
  for (const canvas of retired) canvas.context.calls.length = 0;
  const current = themeState.kitchenDynamicCanvas;
  current.context.calls.length = 0;
  sprite.complete = true;
  sprite.naturalWidth = 252;
  sprite.dispatchEvent(new globalThis.Event("load"));
  assert.equal(getEventListeners(sprite, "load").length, 0);
  assert.equal(getEventListeners(sprite, "error").length, 0);
  assert.equal(frames.length, 1, "success schedules only the current canvas");
  flushFrames();
  assert.ok(
    drawsSprite(current),
    "paused games repaint when the image arrives",
  );
  for (const canvas of retired) assert.equal(canvas.context.calls.length, 0);

  sprite.complete = false;
  render();
  flushFrames();
  const replaced = themeState.kitchenDynamicCanvas;
  replaced.context.calls.length = 0;
  render({ theme: "livingRoom" });
  assert.equal(
    getEventListeners(sprite, "load").length,
    0,
    "leaving the kitchen must release a still-pending subscription",
  );
  assert.equal(getEventListeners(sprite, "error").length, 0);
  sprite.complete = true;
  sprite.dispatchEvent(new globalThis.Event("load"));
  assert.equal(frames.length, 0);
  assert.equal(replaced.context.calls.length, 0);

  // Loading may finish just before a transition but its rAF runs afterward.
  sprite.complete = false;
  render();
  flushFrames();
  const queued = themeState.kitchenDynamicCanvas;
  queued.context.calls.length = 0;
  sprite.complete = true;
  sprite.dispatchEvent(new globalThis.Event("load"));
  render({ theme: "livingRoom" });
  flushFrames();
  assert.equal(queued.context.calls.length, 0);
} finally {
  if (originalDocument === undefined) delete globalThis.document;
  else globalThis.document = originalDocument;
  if (originalImage === undefined) delete globalThis.Image;
  else globalThis.Image = originalImage;
  if (originalRaf === undefined) delete globalThis.requestAnimationFrame;
  else globalThis.requestAnimationFrame = originalRaf;
}

console.log("Kitchen image lifecycle tests passed.");
