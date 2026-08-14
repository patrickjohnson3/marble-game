import assert from "node:assert/strict";

const originalGlobals = {
  caches: globalThis.caches,
  fetch: globalThis.fetch,
  self: globalThis.self,
};
const listeners = {};
const writes = [];
const cacheMatches = [];
const deletedCaches = [];
let claimedClients = 0;
let installedFiles = [];
let openedCacheName = "";
let skippedWaiting = 0;
let resolveWrite;

globalThis.self = {
  addEventListener(type, listener) {
    listeners[type] = listener;
  },
  location: {
    href: "https://example.test/app/",
    origin: "https://example.test",
  },
  clients: {
    claim() {
      claimedClients++;
      return Promise.resolve();
    },
  },
  skipWaiting() {
    skippedWaiting++;
    return Promise.resolve();
  },
};
globalThis.caches = {
  match(request, options) {
    cacheMatches.push({ request, options });
    return Promise.resolve(null);
  },
  keys() {
    return Promise.resolve(["marble-game-old", openedCacheName, "unrelated"]);
  },
  delete(name) {
    deletedCaches.push(name);
    return Promise.resolve(true);
  },
  open(name) {
    openedCacheName = name;
    return Promise.resolve({
      addAll(files) {
        installedFiles = files;
        return Promise.resolve();
      },
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

  let installPromise;
  listeners.install({
    waitUntil(promise) {
      installPromise = promise;
    },
  });
  await installPromise;
  assert.equal(skippedWaiting, 1);
  assert.equal(
    installedFiles.some((url) => url.endsWith("app.js")),
    true,
  );

  let activatePromise;
  listeners.activate({
    waitUntil(promise) {
      activatePromise = promise;
    },
  });
  await activatePromise;
  assert.deepEqual(deletedCaches, ["marble-game-old"]);
  assert.equal(claimedClients, 1);

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
  assert.equal(
    cacheMatches[0].options,
    undefined,
    "runtime cache lookup must preserve asset-version query strings",
  );
  console.log("Service worker tests passed.");
} finally {
  globalThis.caches = originalGlobals.caches;
  globalThis.fetch = originalGlobals.fetch;
  globalThis.self = originalGlobals.self;
}
