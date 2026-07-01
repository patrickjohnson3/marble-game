import { spawnSync } from "node:child_process";

const tests = [
  "smoke-test.js",
  "physics-test.js",
  "intro-timers-test.js",
  "config-test.js",
  "check-cache-version.js"
];

for (const test of tests) {
  const result = spawnSync(process.execPath, [test], {
    encoding: "utf8",
    stdio: "inherit"
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}
