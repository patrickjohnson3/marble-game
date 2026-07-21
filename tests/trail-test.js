import assert from "node:assert/strict";
import { createTrailRenderer } from "../rendering/trail.js";
import { FakeElement } from "./test-dom.js";

function withFakeDocument(callback) {
  const originalDocument = globalThis.document;

  globalThis.document = {
    createElementNS() {
      return new FakeElement();
    },
  };
  try {
    callback();
  } finally {
    if (originalDocument === undefined) {
      delete globalThis.document;
    } else {
      globalThis.document = originalDocument;
    }
  }
}

function createHarness() {
  const marble = { x: 0, y: 0 };
  const trailEl = new FakeElement();
  const trailSegmentsEl = new FakeElement();
  const renderer = createTrailRenderer({
    trailEl,
    trailSegmentsEl,
    marble,
    game: { phase: "running" },
    settings: { trailEnabled: true },
    config: {
      durationMs: 3000,
      maxOpacity: 0.6,
      minDistance: 1,
      minIntervalMs: 0,
    },
    clamp(value, min, max) {
      return Math.min(Math.max(value, min), max);
    },
  });

  return { marble, renderer, trailSegmentsEl };
}

function testTrailReusesSegmentElements() {
  const { marble, renderer, trailSegmentsEl } = createHarness();

  withFakeDocument(() => {
    renderer.update(0);
    marble.x = 10;
    renderer.update(16);

    const firstSegment = trailSegmentsEl.childNodes[0];
    marble.x = 20;
    renderer.update(32);
    renderer.clear();
    marble.x = 30;
    renderer.update(48);
    marble.x = 40;
    renderer.update(64);

    assert.equal(trailSegmentsEl.childNodes[0], firstSegment);
  });
}

testTrailReusesSegmentElements();

console.log("Trail tests passed.");
