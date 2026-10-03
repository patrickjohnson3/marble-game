import {
  runtimeFiles,
  runtimeModuleScripts,
} from "./runtime-assets.js?v=913544f30032dcc3";

const cacheVersion = "marble-game-913544f30032dcc3";
const assetVersion = cacheVersion.slice("marble-game-".length);
const versionedFiles = [...runtimeModuleScripts, "style.css"].map(
  (file) => file + "?v=" + assetVersion,
);
const cacheableFiles = [
  "./",
  "index.html",
  ...runtimeFiles.filter(
    (file) =>
      file !== "sw.js" &&
      file !== "style.css" &&
      !runtimeModuleScripts.includes(file),
  ),
  ...versionedFiles,
];

function sameOrigin(request) {
  return new URL(request.url).origin === self.location.origin;
}

function cacheKey(path) {
  return new URL(path, self.location.href).toString();
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    // Wait for old game windows to close unless the player explicitly applies
    // the update. Automatic installation must not restart an encounter.
    caches
      .open(cacheVersion)
      .then((cache) =>
        cache.addAll(
          cacheableFiles.map(
            (file) => new Request(cacheKey(file), { cache: "reload" }),
          ),
        ),
      ),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "APPLY_UPDATE") {
    event.waitUntil(self.skipWaiting());
  }
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) => key.startsWith("marble-game-") && key !== cacheVersion,
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function extendEventLifetime(event, work) {
  event.waitUntil(work.catch(() => {}));
}

function cacheFirst(event, request) {
  return caches.match(request).then((cached) => {
    if (cached) return cached;

    return fetch(request).then((response) => {
      if (!response.ok) return response;

      const responseToCache = response.clone();
      const cacheWrite = caches
        .open(cacheVersion)
        .then((cache) => cache.put(request, responseToCache));
      extendEventLifetime(event, cacheWrite);
      return response;
    });
  });
}

function navigationCacheFirst(request) {
  // Keep the shell paired with the assets from this worker's installation.
  return caches
    .open(cacheVersion)
    .then((cache) => cache.match(cacheKey("index.html")))
    .then((cached) => cached || fetch(request));
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || !sameOrigin(request)) return;

  if (request.mode === "navigate") {
    event.respondWith(navigationCacheFirst(request));
    return;
  }

  event.respondWith(cacheFirst(event, request));
});
