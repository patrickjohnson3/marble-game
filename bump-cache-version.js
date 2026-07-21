import { readFileSync, writeFileSync } from "node:fs";
import { runtimeModuleScripts } from "./runtime-assets.js";

const version = new Date()
  .toISOString()
  .replace(/[-:]/g, "")
  .replace(/\..+/, "")
  .replace("T", ".");
const indexPath = "index.html";
const serviceWorkerPath = "sw.js";
const html = readFileSync(indexPath, "utf8");
const serviceWorker = readFileSync(serviceWorkerPath, "utf8");
const runtimeModuleScriptList = runtimeModuleScripts
  .map((script) => '        "' + script + '",')
  .join("\n");
const nextHtml = html
  .replace(
    /const assetVersion = "[^"]+";/,
    'const assetVersion = "' + version + '";',
  )
  .replace(
    /const runtimeModuleScripts = \[[\s\S]*?\];/,
    "const runtimeModuleScripts = [\n" + runtimeModuleScriptList + "\n      ];",
  );

if (nextHtml === html) {
  console.error(
    "Could not find assetVersion or runtimeModuleScripts assignment in " +
      indexPath,
  );
  process.exit(1);
}

const nextServiceWorker = serviceWorker.replace(
  /const cacheVersion = "marble-game-[^"]+";/,
  'const cacheVersion = "marble-game-' + version + '";',
);

if (nextServiceWorker === serviceWorker) {
  console.error(
    "Could not find cacheVersion assignment in " + serviceWorkerPath,
  );
  process.exit(1);
}

writeFileSync(indexPath, nextHtml);
writeFileSync(serviceWorkerPath, nextServiceWorker);
console.log("assetVersion set to " + version);
