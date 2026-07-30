import {
  computeRuntimeAssetHash,
  readCurrentCacheVersions,
} from "./cache-version.js";

const expectedVersion = computeRuntimeAssetHash();
const { assetVersion, serviceWorkerCacheVersion } = readCurrentCacheVersions();

if (!assetVersion || assetVersion !== serviceWorkerCacheVersion) {
  console.error("index.html assetVersion and sw.js cacheVersion must match.");
  console.error("Run: npm run sync-cache");
  process.exit(1);
}

if (assetVersion !== expectedVersion) {
  console.error("Runtime asset hash does not match index.html assetVersion.");
  console.error("Run: npm run sync-cache");
  process.exit(1);
}

console.log("Cache version check passed.");
