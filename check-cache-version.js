import { spawnSync } from "node:child_process";
import { runtimeFiles } from "./runtime-assets.js";

function git(args) {
  return spawnSync("git", args, {
    encoding: "utf8"
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

if (latestRuntimeCommit && latestIndexCommit && latestRuntimeCommit > latestIndexCommit) {
  console.error("index.html assetVersion is older than the latest runtime asset change.");
  console.error("Run: node bump-cache-version.js");
  process.exit(1);
}

console.log("Cache version check passed.");
