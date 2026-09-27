import {
  computeRuntimeAssetHash,
  readCurrentCacheVersions,
} from "./cache-version.js";

const expectedVersion = computeRuntimeAssetHash();
const { assetVersion, serviceWorkerCacheVersion, serviceWorkerAssetsVersion } =
  readCurrentCacheVersions();

if (
  !assetVersion ||
  assetVersion !== serviceWorkerCacheVersion ||
  assetVersion !== serviceWorkerAssetsVersion
) {
  console.error(
    "index.html, sw.js cacheVersion, and the worker asset-list import must match.",
  );
  console.error("Run: npm run sync-cache");
  process.exit(1);
}

if (assetVersion !== expectedVersion) {
  console.error("Runtime asset hash does not match index.html assetVersion.");
  console.error("Run: npm run sync-cache");
  process.exit(1);
}

console.log("Cache version check passed.");
