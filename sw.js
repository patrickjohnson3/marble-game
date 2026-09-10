import { runtimeFiles, runtimeModuleScripts } from "./runtime-assets.js";

const cacheVersion = "marble-game-685ebe6a81b30aae";
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

function fetchAndCacheNavigation(event, request) {
  return fetch(request)
    .then((response) => {
      if (!response.ok) return response;

      const responseToCache = response.clone();
      const cacheWrite = caches
        .open(cacheVersion)
        .then((cache) => cache.put(cacheKey("index.html"), responseToCache));
      extendEventLifetime(event, cacheWrite);
      return response;
    })
    .catch(() => caches.match(cacheKey("index.html")));
}

function navigationCacheFirst(event, request) {
  const shellKey = cacheKey("index.html");
  return caches.match(shellKey).then((cached) => {
    if (!cached) return fetchAndCacheNavigation(event, request);

    extendEventLifetime(
      event,
      fetchAndCacheNavigation(event, request).then(() => undefined),
    );
    return cached;
  });
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || !sameOrigin(request)) return;

  if (request.mode === "navigate") {
    event.respondWith(navigationCacheFirst(event, request));
    return;
  }

  event.respondWith(cacheFirst(event, request));
});
