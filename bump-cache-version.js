import { readFileSync, writeFileSync } from "node:fs";
import { runtimeModuleScripts } from "./runtime-assets.js";

const version = new Date()
  .toISOString()
  .replace(/[-:]/g, "")
  .replace(/\..+/, "")
  .replace("T", ".");
const indexPath = "index.html";
const html = readFileSync(indexPath, "utf8");
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

writeFileSync(indexPath, nextHtml);
console.log("assetVersion set to " + version);
