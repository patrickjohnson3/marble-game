import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { runtimeFiles, runtimeModuleScripts } from "./runtime-assets.js";

export const assetVersionPattern = /const assetVersion = "[^"]+";/;
export const cacheVersionPattern = /const cacheVersion = "marble-game-[^"]+";/;
export const runtimeModuleScriptsPattern =
  /const runtimeModuleScripts = \[[\s\S]*?\];/;

export function runtimeModuleScriptsAssignment() {
  const runtimeModuleScriptList = runtimeModuleScripts
    .map((script) => '        "' + script + '",')
    .join("\n");

  return (
    "const runtimeModuleScripts = [\n" + runtimeModuleScriptList + "\n      ];"
  );
}

export function normalizedCacheContent(path, content) {
  if (path === "index.html") {
    return content
      .replace(assetVersionPattern, 'const assetVersion = "__CACHE_VERSION__";')
      .replace(runtimeModuleScriptsPattern, runtimeModuleScriptsAssignment());
  }

  if (path === "sw.js") {
    return content.replace(
      cacheVersionPattern,
      'const cacheVersion = "marble-game-__CACHE_VERSION__";',
    );
  }

  return content;
}

function normalizedCacheFile(path) {
  if (path === "index.html" || path === "sw.js") {
    return normalizedCacheContent(path, readFileSync(path, "utf8"));
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
