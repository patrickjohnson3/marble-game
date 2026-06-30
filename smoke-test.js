import { readFileSync } from "fs";
import { spawnSync } from "child_process";

const html = readFileSync("index.html", "utf8");
const scripts = ["app.js", "config.js", "dom.js", "geometry.js", "haptics.js", "rendering.js", "state.js"];
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

const domIdPatterns = [
  /document\.getElementById\("([^"]+)"\)/g,
  /requiredElement\("([^"]+)"\)/g
];
const appIds = domIdPatterns.flatMap((pattern) => (
  [...app.matchAll(pattern)].map((match) => match[1])
));
const htmlIds = new Set(
  [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1])
);
const missingIds = appIds.filter((id) => !htmlIds.has(id));

if (missingIds.length > 0) {
  console.error("Missing DOM ids referenced by app.js:");
  missingIds.forEach((id) => console.error("- " + id));
  process.exit(1);
}

console.log("Smoke test passed.");
