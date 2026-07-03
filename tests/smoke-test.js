import assert from "node:assert/strict";
import { readFileSync } from "fs";
import { spawnSync } from "child_process";
import { mapConfig } from "../core/config.js";
import { requiredDomIds } from "../core/dom-ids.js";
import { runtimeModuleScripts, runtimeScripts } from "../runtime-assets.js";

const html = readFileSync("index.html", "utf8");
const css = readFileSync("style.css", "utf8");
const scripts = runtimeScripts;
const app = scripts.map((file) => readFileSync(file, "utf8")).join("\n");

for (const script of scripts) {
  const syntax = spawnSync(process.execPath, ["--check", script], {
    encoding: "utf8"
  });

  if (syntax.status !== 0) {
    process.stderr.write(syntax.stderr || syntax.stdout);
    process.exit(syntax.status || 1);
  }
}

const htmlIds = new Set(
  [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1])
);
const missingIds = requiredDomIds.filter((id) => !htmlIds.has(id));

if (missingIds.length > 0) {
  console.error("Missing DOM ids referenced by app.js:");
  missingIds.forEach((id) => console.error("- " + id));
  process.exit(1);
}

const moduleScriptListMatch = html.match(/const runtimeModuleScripts = \[([\s\S]*?)\];/);
if (!moduleScriptListMatch) {
  console.error("index.html is missing runtimeModuleScripts for import map cache busting.");
  process.exit(1);
}

const htmlRuntimeModuleScripts = [...moduleScriptListMatch[1].matchAll(/"([^"]+\.js)"/g)]
  .map((match) => match[1]);

assert.deepEqual(
  htmlRuntimeModuleScripts,
  runtimeModuleScripts,
  "index.html runtimeModuleScripts must match runtime-assets.js"
);

if (!html.includes("./\" + script + \"?v=\" + assetVersion")) {
  console.error("index.html import map must version runtime module imports.");
  process.exit(1);
}

let cssBraceBalance = 0;
for (const char of css) {
  if (char === "{") cssBraceBalance++;
  if (char === "}") cssBraceBalance--;
  if (cssBraceBalance < 0) {
    console.error("style.css has an unmatched closing brace.");
    process.exit(1);
  }
}
if (cssBraceBalance !== 0) {
  console.error("style.css has unbalanced braces.");
  process.exit(1);
}

const allowedElementTypes = new Set(["obstacle", "roughPatch"]);
const mapErrors = [];

for (const [index, element] of mapConfig.elements.entries()) {
  if (!allowedElementTypes.has(element.type)) {
    mapErrors.push("element " + index + " has unknown type " + element.type);
  }

  for (const key of ["x", "y", "w", "h"]) {
    if (!Number.isFinite(element[key])) {
      mapErrors.push("element " + index + " has non-finite " + key);
    }
  }

  if (element.w <= 0 || element.h <= 0) {
    mapErrors.push("element " + index + " must have positive dimensions");
  }

  if (element.x < 0 || element.y < 0 ||
      element.x + element.w > mapConfig.world.width ||
      element.y + element.h > mapConfig.world.height) {
    mapErrors.push("element " + index + " is outside world bounds");
  }
}

if (mapErrors.length > 0) {
  console.error("Invalid map config:");
  mapErrors.forEach((error) => console.error("- " + error));
  process.exit(1);
}

console.log("Smoke test passed.");
