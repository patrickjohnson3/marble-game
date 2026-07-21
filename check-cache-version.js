import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { runtimeFiles } from "./runtime-assets.js";

function git(args) {
  return spawnSync("git", args, {
    encoding: "utf8",
  });
}

function latestCommitTime(paths) {
  const result = git(["log", "-1", "--format=%ct", "--", ...paths]);
  if (result.status !== 0) return null;

  const timestamp = Number(result.stdout.trim());
  return Number.isFinite(timestamp) ? timestamp : null;
}

if (git(["rev-parse", "--is-inside-work-tree"]).status !== 0) {
  console.log("Cache version check skipped outside git.");
  process.exit(0);
}

const latestRuntimeCommit = latestCommitTime(runtimeFiles);
const latestIndexCommit = latestCommitTime(["index.html"]);
const html = readFileSync("index.html", "utf8");
const serviceWorker = readFileSync("sw.js", "utf8");
const assetVersion = html.match(/const assetVersion = "([^"]+)";/)?.[1];
const serviceWorkerCacheVersion = serviceWorker.match(
  /const cacheVersion = "marble-game-([^"]+)";/,
)?.[1];

if (
  latestRuntimeCommit &&
  latestIndexCommit &&
  latestRuntimeCommit > latestIndexCommit
) {
  console.error(
    "index.html assetVersion is older than the latest runtime asset change.",
  );
  console.error("Run: node bump-cache-version.js");
  process.exit(1);
}

if (!assetVersion || assetVersion !== serviceWorkerCacheVersion) {
  console.error("index.html assetVersion and sw.js cacheVersion must match.");
  console.error("Run: node bump-cache-version.js");
  process.exit(1);
}

console.log("Cache version check passed.");
