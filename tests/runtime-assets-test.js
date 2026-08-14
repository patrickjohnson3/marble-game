import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, normalize, relative, resolve } from "node:path";
import { runtimeScripts } from "../runtime-assets.js";

const root = process.cwd();

function relativeModuleImports(source) {
  const imports = [];
  const patterns = [
    /\bimport\s+(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g,
    /\bexport\s+[^"']*?\s+from\s+["']([^"']+)["']/g,
  ];

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      if (match[1].startsWith(".")) imports.push(match[1]);
    }
  }
  return imports;
}

function reachableRuntimeModules(entrypoint) {
  const reachable = new Set();

  function visit(modulePath) {
    const normalizedPath = normalize(modulePath).replaceAll("\\", "/");
    if (reachable.has(normalizedPath)) return;

    reachable.add(normalizedPath);
    const source = readFileSync(resolve(root, normalizedPath), "utf8");
    for (const dependency of relativeModuleImports(source)) {
      visit(relative(root, resolve(root, dirname(normalizedPath), dependency)));
    }
  }

  visit(entrypoint);
  return [...reachable].sort();
}

assert.deepEqual(
  [...runtimeScripts].sort(),
  reachableRuntimeModules("boot.js"),
  "runtime-assets.js must exactly match modules reachable from boot.js",
);

console.log("Runtime asset tests passed.");
