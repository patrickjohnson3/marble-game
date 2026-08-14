import assert from "node:assert/strict";

const originalGlobals = {
  caches: globalThis.caches,
  fetch: globalThis.fetch,
  self: globalThis.self,
};
const listeners = {};
const writes = [];
let resolveWrite;

globalThis.self = {
  addEventListener(type, listener) {
    listeners[type] = listener;
  },
  location: {
    href: "https://example.test/app/",
    origin: "https://example.test",
  },
};
globalThis.caches = {
  match() {
    return Promise.resolve(null);
  },
  open() {
    return Promise.resolve({
      put(key) {
        writes.push(key);
        return new Promise((resolve) => {
          resolveWrite = resolve;
        });
      },
    });
  },
};
globalThis.fetch = () =>
  Promise.resolve({
    ok: true,
    clone() {
      return { cloned: true };
    },
  });

try {
  await import("../sw.js?test=" + Date.now());

  for (const mode of ["same-origin", "navigate"]) {
    let responsePromise;
    let lifetimePromise;
    const request = {
      method: "GET",
      mode,
      url: "https://example.test/app/app.js",
    };
    listeners.fetch({
      request,
      respondWith(promise) {
        responsePromise = promise;
      },
      waitUntil(promise) {
        lifetimePromise = promise;
      },
    });

    await responsePromise;
    assert.ok(
      lifetimePromise,
      mode + " cache writes must extend event lifetime",
    );
    resolveWrite();
    await lifetimePromise;
  }

  assert.equal(writes.length, 2);
  console.log("Service worker tests passed.");
} finally {
  globalThis.caches = originalGlobals.caches;
  globalThis.fetch = originalGlobals.fetch;
  globalThis.self = originalGlobals.self;
}
