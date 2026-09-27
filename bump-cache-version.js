import { readFileSync, writeFileSync } from "node:fs";
import {
  assetVersionPattern,
  cacheVersionPattern,
  computeRuntimeAssetHash,
  runtimeAssetsImportPattern,
  runtimeModuleScriptsAssignment,
  runtimeModuleScriptsPattern,
} from "./cache-version.js";

const version = computeRuntimeAssetHash();
const indexPath = "index.html";
const serviceWorkerPath = "sw.js";
const html = readFileSync(indexPath, "utf8");
const serviceWorker = readFileSync(serviceWorkerPath, "utf8");

if (
  !assetVersionPattern.test(html) ||
  !runtimeModuleScriptsPattern.test(html)
) {
  console.error(
    "Could not find assetVersion or runtimeModuleScripts assignment in " +
      indexPath,
  );
  process.exit(1);
}

if (
  !cacheVersionPattern.test(serviceWorker) ||
  !runtimeAssetsImportPattern.test(serviceWorker)
) {
  console.error(
    "Could not find cacheVersion or runtime-assets import in " +
      serviceWorkerPath,
  );
  process.exit(1);
}

const nextHtml = html
  .replace(assetVersionPattern, 'const assetVersion = "' + version + '";')
  .replace(runtimeModuleScriptsPattern, runtimeModuleScriptsAssignment());

const nextServiceWorker = serviceWorker
  .replace(
    cacheVersionPattern,
    'const cacheVersion = "marble-game-' + version + '";',
  )
  .replace(
    runtimeAssetsImportPattern,
    'from "./runtime-assets.js?v=' + version + '";',
  );

writeFileSync(indexPath, nextHtml);
writeFileSync(serviceWorkerPath, nextServiceWorker);
console.log("assetVersion set to " + version);
