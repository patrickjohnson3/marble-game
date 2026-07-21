import { spawnSync } from "node:child_process";

const tests = [
  "tests/smoke-test.js",
  "tests/app-boot-test.js",
  "tests/camera-test.js",
  "tests/physics-test.js",
  "tests/haptics-test.js",
  "tests/best-times-test.js",
  "tests/goal-controller-test.js",
  "tests/platform-test.js",
  "tests/intro-sequence-test.js",
  "tests/intro-timers-test.js",
  "tests/config-test.js",
  "tests/map-test.js",
  "tests/map-validation-test.js",
  "tests/map-runtime-test.js",
  "tests/spatial-index-test.js",
  "tests/input-manager-test.js",
  "tests/sensor-controller-test.js",
  "tests/settings-panel-test.js",
  "tests/settings-store-test.js",
  "tests/rendering-test.js",
  "tests/effects-test.js",
  "tests/trail-test.js",
  "tests/lifecycle-test.js",
  "check-cache-version.js",
];

for (const test of tests) {
  const result = spawnSync(process.execPath, [test], {
    encoding: "utf8",
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}
