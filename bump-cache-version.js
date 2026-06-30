import { readFileSync, writeFileSync } from "node:fs";

const version = new Date().toISOString()
  .replace(/[-:]/g, "")
  .replace(/\..+/, "")
  .replace("T", ".");
const indexPath = "index.html";
const html = readFileSync(indexPath, "utf8");
const nextHtml = html.replace(
  /const assetVersion = "[^"]+";/,
  'const assetVersion = "' + version + '";'
);

if (nextHtml === html) {
  console.error("Could not find assetVersion assignment in " + indexPath);
  process.exit(1);
}

writeFileSync(indexPath, nextHtml);
console.log("assetVersion set to " + version);
