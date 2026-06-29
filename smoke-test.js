const { readFileSync } = require("fs");
const { spawnSync } = require("child_process");

const html = readFileSync("index.html", "utf8");
const app = readFileSync("app.js", "utf8");

const syntax = spawnSync(process.execPath, ["--check", "app.js"], {
  encoding: "utf8"
});

if (syntax.status !== 0) {
  process.stderr.write(syntax.stderr || syntax.stdout);
  process.exit(syntax.status || 1);
}

const appIds = [...app.matchAll(/document\.getElementById\("([^"]+)"\)/g)]
  .map((match) => match[1]);
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
