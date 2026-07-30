import { readFileSync } from "node:fs";

const html = readFileSync("index.html", "utf8");
const serviceWorker = readFileSync("sw.js", "utf8");
const assetVersion = html.match(/const assetVersion = "([^"]+)";/)?.[1];
const serviceWorkerCacheVersion = serviceWorker.match(
  /const cacheVersion = "marble-game-([^"]+)";/,
)?.[1];

if (!assetVersion || assetVersion !== serviceWorkerCacheVersion) {
  console.error("index.html assetVersion and sw.js cacheVersion must match.");
  console.error("Run: npm run sync-cache");
  process.exit(1);
}

console.log("Cache version check passed.");
