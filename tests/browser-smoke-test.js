import assert from "node:assert/strict";
import { existsSync, readFile } from "node:fs";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";
import { URL } from "node:url";
import { chromium } from "playwright-core";

const root = process.cwd();
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json; charset=utf-8",
};

function chromeExecutable() {
  const candidates = [
    process.env.CHROME_PATH,
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter(Boolean);
  const executable = candidates.find(existsSync);
  if (!executable) {
    throw new Error("Chrome not found. Set CHROME_PATH to run browser tests.");
  }
  return executable;
}

function createStaticServer() {
  return createServer((request, response) => {
    const requestUrl = new URL(request.url, "http://127.0.0.1");
    const pathname = decodeURIComponent(requestUrl.pathname);
    const relativePath = pathname === "/" ? "index.html" : pathname.slice(1);
    const filePath = resolve(root, relativePath);

    if (filePath !== root && !filePath.startsWith(root + sep)) {
      response.writeHead(403).end();
      return;
    }

    readFile(filePath, (error, content) => {
      if (error) {
        response.writeHead(error.code === "ENOENT" ? 404 : 500).end();
        return;
      }

      response.writeHead(200, {
        "cache-control": "no-store",
        "content-type":
          contentTypes[extname(filePath)] ?? "application/octet-stream",
      });
      response.end(content);
    });
  });
}

function listen(server) {
  return new Promise((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolveListen(server.address().port));
  });
}

function closeServer(server) {
  return new Promise((resolveClose, reject) => {
    server.close((error) => (error ? reject(error) : resolveClose()));
  });
}

async function marbleTransform(page) {
  return page.locator("#marble").evaluate((element) => element.style.transform);
}

const server = createStaticServer();
const port = await listen(server);
const browser = await chromium.launch({
  executablePath: chromeExecutable(),
  headless: true,
});

try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const browserErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));

  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.__marbleAppBooted === true);

  const start = page.locator("#start");
  assert.equal(
    await start.isVisible(),
    true,
    "Start must be visible after boot",
  );
  assert.equal(
    await page.locator("#bootError").isHidden(),
    true,
    "the fatal boot layer must stay hidden after a successful boot",
  );

  const initialTransform = await marbleTransform(page);
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(100);
  assert.equal(
    await marbleTransform(page),
    initialTransform,
    "keyboard movement must remain gated until Start is pressed",
  );

  await start.click();
  await page.keyboard.down("ArrowRight");
  await page.waitForFunction(
    (before) => document.getElementById("marble").style.transform !== before,
    initialTransform,
  );
  await page.keyboard.up("ArrowRight");

  await page.locator("#settingsToggle").click();
  assert.equal(
    await page
      .locator("#settingsOverlay")
      .evaluate((element) => element.classList.contains("open")),
    true,
    "settings must open",
  );
  const pausedTransform = await marbleTransform(page);
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(150);
  assert.equal(
    await marbleTransform(page),
    pausedTransform,
    "opening settings must pause movement",
  );

  await page.locator("#resumeGame").click();
  await page.keyboard.down("ArrowRight");
  await page.waitForFunction(
    (before) => document.getElementById("marble").style.transform !== before,
    pausedTransform,
  );
  await page.keyboard.up("ArrowRight");

  assert.deepEqual(browserErrors, [], "browser smoke test must not log errors");
  console.log("Browser smoke test passed.");
} finally {
  await browser.close();
  await closeServer(server);
}
