import assert from "node:assert/strict";

async function testWakeLockRequestIsNotDuplicatedWhilePending() {
  const originalDocument = globalThis.document;
  const originalNavigator = globalThis.navigator;
  let requestCount = 0;
  let resolveWakeLock;

  globalThis.document = { visibilityState: "visible" };
  globalThis.navigator = {
    wakeLock: {
      request(type) {
        requestCount++;
        assert.equal(type, "screen");
        return new Promise((resolve) => {
          resolveWakeLock = resolve;
        });
      }
    }
  };

  try {
    const { requestWakeLock } = await import("./platform.js?test=" + Date.now());
    const firstRequest = requestWakeLock();
    const secondRequest = requestWakeLock();

    assert.equal(requestCount, 1);
    resolveWakeLock({ addEventListener() {} });
    await Promise.all([firstRequest, secondRequest]);
    assert.equal(requestCount, 1);
  } finally {
    globalThis.document = originalDocument;
    globalThis.navigator = originalNavigator;
  }
}

await testWakeLockRequestIsNotDuplicatedWhilePending();

console.log("Platform tests passed.");
