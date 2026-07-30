import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { runtimeFiles } from "./runtime-assets.js";

const assetVersionPattern = /const assetVersion = "[^"]+";/;
const cacheVersionPattern = /const cacheVersion = "marble-game-[^"]+";/;

function normalizedCacheFile(path) {
  if (path === "index.html") {
    return readFileSync(path, "utf8").replace(
      assetVersionPattern,
      'const assetVersion = "__CACHE_VERSION__";',
    );
  }

  if (path === "sw.js") {
    return readFileSync(path, "utf8").replace(
      cacheVersionPattern,
      'const cacheVersion = "marble-game-__CACHE_VERSION__";',
    );
  }

  return readFileSync(path);
}

export function computeRuntimeAssetHash() {
  const hash = createHash("sha256");

  ["index.html", ...runtimeFiles].forEach((path) => {
    hash.update(path);
    hash.update("\0");
    hash.update(normalizedCacheFile(path));
    hash.update("\0");
  });

  return hash.digest("hex").slice(0, 16);
}

export function readCurrentCacheVersions() {
  const html = readFileSync("index.html", "utf8");
  const serviceWorker = readFileSync("sw.js", "utf8");

  return {
    assetVersion: html.match(/const assetVersion = "([^"]+)";/)?.[1],
    serviceWorkerCacheVersion: serviceWorker.match(
      /const cacheVersion = "marble-game-([^"]+)";/,
    )?.[1],
  };
}
