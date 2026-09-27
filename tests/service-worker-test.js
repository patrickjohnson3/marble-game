import assert from "node:assert/strict";

const originalGlobals = {
  caches: globalThis.caches,
  fetch: globalThis.fetch,
  self: globalThis.self,
};
const listeners = {};
const writes = [];
const cacheMatches = [];
const matchedResponses = new Map();
const deletedCaches = [];
let claimedClients = 0;
let installedFiles = [];
let openedCacheName = "";
let skippedWaiting = 0;
let resolveWrite;
let holdCacheWrites = true;

globalThis.self = {
  addEventListener(type, listener) {
    listeners[type] = listener;
  },
  location: {
    href: "https://example.test/app/sw.js",
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
    return Promise.resolve(matchedResponses.get(String(request)) ?? null);
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
      match(request) {
        cacheMatches.push({ request, cacheName: name });
        return Promise.resolve(matchedResponses.get(String(request)) ?? null);
      },
      addAll(files) {
        installedFiles = files;
        return Promise.resolve();
      },
      put(key) {
        writes.push(key);
        if (!holdCacheWrites) return Promise.resolve();
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
  const activeCacheName = openedCacheName;
  const installedUrls = installedFiles.map((request) => request.url ?? request);
  assert.equal(skippedWaiting, 1);
  assert.equal(
    installedUrls.some((url) => url.includes("app.js?v=")),
    true,
  );
  assert.equal(
    installedUrls.some((url) => url.includes("style.css?v=")),
    true,
  );
  assert.equal(
    installedUrls.some((url) => url.endsWith("runtime-assets.js")),
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

  let responsePromise;
  let lifetimePromise;
  const request = {
    method: "GET",
    mode: "same-origin",
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
  assert.ok(lifetimePromise, "runtime cache writes must extend event lifetime");
  resolveWrite();
  await lifetimePromise;
  assert.equal(writes.length, 1);
  assert.equal(
    cacheMatches[0].options,
    undefined,
    "runtime cache lookup must preserve asset-version query strings",
  );

  const cachedShell = { source: "installed release" };
  const networkShell = {
    ok: true,
    source: "next release whose installation may fail",
    clone() {
      return { cloned: true };
    },
  };
  const shellKey = "https://example.test/app/index.html";
  matchedResponses.set(shellKey, cachedShell);
  holdCacheWrites = false;
  let navigationFetches = 0;
  globalThis.fetch = () => {
    navigationFetches++;
    return Promise.resolve(networkShell);
  };

  async function navigate() {
    let navigationResponse;
    const lifetimes = [];
    listeners.fetch({
      request: {
        method: "GET",
        mode: "navigate",
        url: "https://example.test/app/",
      },
      respondWith(promise) {
        navigationResponse = promise;
      },
      waitUntil(promise) {
        lifetimes.push(promise);
      },
    });
    const response = await navigationResponse;
    await Promise.all(lifetimes);
    return response;
  }

  assert.equal(await navigate(), cachedShell);
  assert.equal(await navigate(), cachedShell);
  assert.equal(
    navigationFetches,
    0,
    "navigation must not replace the active shell before a new release installs",
  );
  assert.equal(
    cacheMatches.at(-1).cacheName,
    activeCacheName,
    "navigation must use the active worker's own precached shell",
  );
  assert.equal(writes.length, 1, "the installed shell must remain unchanged");

  matchedResponses.delete(shellKey);
  assert.equal(await navigate(), networkShell);
  assert.equal(navigationFetches, 1);
  assert.equal(
    writes.length,
    1,
    "a missing shell can fall back to the network without caching another release under the active version",
  );
  assert.ok(
    installedFiles.every((request) => request.cache === "reload"),
    "installation must fetch fresh release files instead of reusing an HTTP-cached shell or unversioned asset",
  );
  console.log("Service worker tests passed.");
} finally {
  globalThis.caches = originalGlobals.caches;
  globalThis.fetch = originalGlobals.fetch;
  globalThis.self = originalGlobals.self;
}
