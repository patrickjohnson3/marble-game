import assert from "node:assert/strict";
import { runtimeModuleScripts } from "../runtime-assets.js";
import {
  normalizedCacheContent,
  runtimeModuleScriptsAssignment,
} from "../cache-version.js";

function testRuntimeModuleScriptsAssignmentUsesManifestOrder() {
  const assignment = runtimeModuleScriptsAssignment();
  const scripts = [...assignment.matchAll(/"([^"]+\.js)"/g)].map(
    (match) => match[1],
  );

  assert.deepEqual(scripts, runtimeModuleScripts);
  assert.ok(scripts.includes("app.js"), "app.js must be cache-versioned");
}

function testIndexNormalizationReplacesVersionAndScriptList() {
  const normalized = normalizedCacheContent(
    "index.html",
    [
      'const assetVersion = "old-version";',
      "const runtimeModuleScripts = [",
      '        "stale.js",',
      "      ];",
    ].join("\n"),
  );

  assert.ok(normalized.includes('const assetVersion = "__CACHE_VERSION__";'));
  assert.equal(normalized.includes('"stale.js"'), false);
  assert.ok(normalized.includes('"boot.js"'));
}

function testServiceWorkerNormalizationReplacesVersion() {
  assert.equal(
    normalizedCacheContent(
      "sw.js",
      'const cacheVersion = "marble-game-old-version";',
    ),
    'const cacheVersion = "marble-game-__CACHE_VERSION__";',
  );
}

testRuntimeModuleScriptsAssignmentUsesManifestOrder();
testIndexNormalizationReplacesVersionAndScriptList();
testServiceWorkerNormalizationReplacesVersion();

console.log("Cache version tests passed.");
