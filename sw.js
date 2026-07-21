import { runtimeFiles } from "./runtime-assets.js";

const cacheVersion = "marble-game-20260721.134941";
const cacheableFiles = [
  "./",
  "index.html",
  ...runtimeFiles.filter((file) => file !== "sw.js"),
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

function cacheFirst(request) {
  return caches.match(request, { ignoreSearch: true }).then((cached) => {
    if (cached) return cached;

    return fetch(request).then((response) => {
      if (!response.ok) return response;

      const responseToCache = response.clone();
      caches
        .open(cacheVersion)
        .then((cache) => cache.put(request, responseToCache));
      return response;
    });
  });
}

function navigationFirst(request) {
  return fetch(request)
    .then((response) => {
      if (!response.ok) return response;

      const responseToCache = response.clone();
      caches.open(cacheVersion).then((cache) => {
        cache.put(cacheKey("index.html"), responseToCache);
      });
      return response;
    })
    .catch(() => caches.match(cacheKey("index.html")));
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || !sameOrigin(request)) return;

  if (request.mode === "navigate") {
    event.respondWith(navigationFirst(request));
    return;
  }

  event.respondWith(cacheFirst(request));
});
