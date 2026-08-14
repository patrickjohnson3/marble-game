import { runtimeFiles, runtimeModuleScripts } from "./runtime-assets.js";

const cacheVersion = "marble-game-beb4fd0cccc55a67";
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
    caches
      .open(cacheVersion)
      .then((cache) => cache.addAll(cacheableFiles.map(cacheKey)))
      .then(() => self.skipWaiting()),
  );
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

function keepCacheWriteAlive(event, cacheWrite) {
  event.waitUntil(cacheWrite.catch(() => {}));
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
      keepCacheWriteAlive(event, cacheWrite);
      return response;
    });
  });
}

function navigationFirst(event, request) {
  return fetch(request)
    .then((response) => {
      if (!response.ok) return response;

      const responseToCache = response.clone();
      const cacheWrite = caches
        .open(cacheVersion)
        .then((cache) => cache.put(cacheKey("index.html"), responseToCache));
      keepCacheWriteAlive(event, cacheWrite);
      return response;
    })
    .catch(() => caches.match(cacheKey("index.html")));
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || !sameOrigin(request)) return;

  if (request.mode === "navigate") {
    event.respondWith(navigationFirst(event, request));
    return;
  }

  event.respondWith(cacheFirst(event, request));
});
