import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath, URL } from "node:url";
import { runtimeFiles, runtimeModuleScripts } from "../runtime-assets.js";
import {
  closeServer,
  collectBrowserErrors,
  launchBrowser,
  listen,
} from "../tools/browser-support.js";

const repository = fileURLToPath(new URL("../", import.meta.url));
const scope = "/marble-game/";
const timeout = 15_000;
const contentTypes = {
  ".css": "text/css",
  ".html": "text/html",
  ".js": "text/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
  ".webp": "image/webp",
};

function createRelease(directory, name) {
  for (const file of [
    "index.html",
    "package.json",
    "cache-version.js",
    "bump-cache-version.js",
    ...runtimeFiles,
  ]) {
    const destination = join(directory, file);
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(join(repository, file), destination);
  }

  const extraModules =
    name === "b" ? ["pwa-release-proof.js", "pwa-lazy-proof.js"] : [];
  const extraAsset = `assets/pwa-release-${name}.svg`;
  let manifest = readFileSync(join(directory, "runtime-assets.js"), "utf8");
  manifest = manifest.replace(
    "export const runtimeScripts = [",
    "export const runtimeScripts = [" +
      extraModules.map((file) => JSON.stringify(file) + ",").join(""),
  );
  manifest = manifest.replace(
    "export const pwaFiles = [",
    "export const pwaFiles = [" + JSON.stringify(extraAsset) + ",",
  );
  writeFileSync(join(directory, "runtime-assets.js"), manifest);
  // Keep the retired upload available on the host, but remove it from B's
  // manifest. A stale imported manifest can then install and reveal wrong keys.
  for (const release of ["a", "b"]) {
    writeFileSync(
      join(directory, `assets/pwa-release-${release}.svg`),
      `<svg xmlns="http://www.w3.org/2000/svg"><title>${release}</title></svg>`,
    );
  }
  if (name === "b") {
    writeFileSync(
      join(directory, "pwa-release-proof.js"),
      'window.__pwaRelease = "b";\n',
    );
    writeFileSync(
      join(directory, "pwa-lazy-proof.js"),
      'export const release = "b";\n',
    );
    const bootPath = join(directory, "boot.js");
    writeFileSync(
      bootPath,
      'import "./pwa-release-proof.js";\n' + readFileSync(bootPath, "utf8"),
    );
  }

  // Exercise the actual release generation workflow, including import maps.
  execFileSync(process.execPath, ["bump-cache-version.js"], { cwd: directory });
  if (name === "a") {
    // Existing installations imported the manifest without a version. Preserve
    // that old-client behavior so its fresh HTTP cache participates in upgrade.
    const workerPath = join(directory, "sw.js");
    writeFileSync(
      workerPath,
      readFileSync(workerPath, "utf8").replace(
        /"\.\/runtime-assets\.js\?v=[^"]+"/,
        '"./runtime-assets.js"',
      ),
    );
  }
  const html = readFileSync(join(directory, "index.html"), "utf8");
  const version = html.match(/const assetVersion = "([^"]+)";/)[1];
  const modules = [...runtimeModuleScripts, ...extraModules];
  return {
    directory,
    name,
    version,
    cacheName: "marble-game-" + version,
    cachePaths: [
      "./",
      "index.html",
      ...[...runtimeFiles, extraAsset].filter(
        (file) =>
          file !== "sw.js" && file !== "style.css" && !modules.includes(file),
      ),
      ...[...modules, "style.css"].map((file) => file + "?v=" + version),
    ],
  };
}

function createDeploymentServer(initialRelease) {
  let release = initialRelease;
  const requests = [];
  const server = createServer((request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
    if (!url.pathname.startsWith(scope)) {
      response.writeHead(404).end();
      return;
    }
    const file = url.pathname.slice(scope.length) || "index.html";
    const filePath = resolve(release.directory, file);
    if (!filePath.startsWith(release.directory + sep)) {
      response.writeHead(403).end();
      return;
    }
    requests.push({ release: release.name, file });
    try {
      const content = readFileSync(filePath);
      response.writeHead(200, {
        "content-type":
          contentTypes[extname(file)] ?? "application/octet-stream",
        // Keep shell freshness separate from imported worker module caching.
        "cache-control": file === "index.html" ? "no-store" : "max-age=600",
      });
      response.end(content);
    } catch {
      response.writeHead(404).end();
    }
  });
  return {
    server,
    requests,
    deploy(nextRelease) {
      release = nextRelease;
    },
  };
}

async function waitForBoot(page, version) {
  await page.waitForFunction(
    (expected) =>
      window.__marbleAppBooted === true &&
      document
        .querySelector('script[type="module"]')
        .src.endsWith("boot.js?v=" + expected),
    version,
    { timeout },
  );
  assert.equal(await page.locator("#bootError").isHidden(), true);
  assert.equal(await page.locator("#start").isVisible(), true);
}

async function cacheState(page) {
  return page.evaluate(async () => {
    const names = await window.caches.keys();
    return Promise.all(
      names.map(async (name) => ({
        name,
        urls: (await (await window.caches.open(name)).keys()).map(
          (request) => request.url,
        ),
      })),
    );
  });
}

async function testModuleWorkerUpgrade(browser, releases) {
  const deployment = createDeploymentServer(releases.a);
  const port = await listen(deployment.server);
  const baseUrl = `http://127.0.0.1:${port}${scope}`;
  const context = await browser.newContext({ serviceWorkers: "allow" });
  const page = await context.newPage();
  const errors = collectBrowserErrors(page);
  let navigations = 0;
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) navigations++;
  });

  try {
    await page.goto(baseUrl);
    await waitForBoot(page, releases.a.version);
    await page.waitForFunction(
      () => navigator.serviceWorker.controller !== null,
      null,
      { timeout },
    );
    assert.deepEqual(
      (await cacheState(page)).map((cache) => cache.name),
      [releases.a.cacheName],
    );
    assert.ok(
      deployment.requests.some(
        (request) =>
          request.release === "a" && request.file === "runtime-assets.js",
      ),
      "the first worker must fetch its imported manifest with max-age=600",
    );

    deployment.deploy(releases.b);
    const beforeUpgrade = navigations;
    // An ordinary visit must check imported worker modules. registration.update()
    // bypasses their HTTP cache and would hide this regression.
    await page.goto(baseUrl);
    await waitForBoot(page, releases.b.version);
    await page.waitForFunction(
      async (expected) => {
        const names = await window.caches.keys();
        const registration = await navigator.serviceWorker.getRegistration();
        return (
          names.includes(expected) &&
          !names.some(
            (name) => name.startsWith("marble-game-") && name !== expected,
          ) &&
          registration.active?.state === "activated" &&
          !registration.installing
        );
      },
      releases.b.cacheName,
      { timeout },
    );
    const currentCaches = await cacheState(page);
    assert.deepEqual(
      currentCaches.map((cache) => cache.name),
      [releases.b.cacheName],
      "activation must remove the retired release cache",
    );
    assert.deepEqual(
      currentCaches[0].urls.sort(),
      releases.b.cachePaths.map((path) => new URL(path, baseUrl).href).sort(),
      "the upgraded worker must precache the full new manifest, including unused modules and assets",
    );
    assert.equal(await page.evaluate(() => window.__pwaRelease), "b");
    assert.ok(
      navigations - beforeUpgrade <= 2,
      "the upgrade must not repeatedly reload the page",
    );

    // Disable HTTP cache only after the upgrade, so a browser cache hit cannot
    // masquerade as service-worker offline coverage or mask stale imports.
    const session = await context.newCDPSession(page);
    await session.send("Network.enable");
    await session.send("Network.setCacheDisabled", { cacheDisabled: true });
    await context.setOffline(true);
    const beforeOffline = navigations;
    await page.goto(baseUrl);
    await waitForBoot(page, releases.b.version);
    assert.equal(await page.evaluate(() => window.__pwaRelease), "b");
    assert.equal(
      navigations - beforeOffline,
      1,
      "offline boot must not reload",
    );
    assert.deepEqual(
      errors,
      [],
      "PWA upgrade and offline boot must not log errors",
    );
  } finally {
    await context.close();
    await closeServer(deployment.server);
  }
}

const temporaryDirectory = mkdtempSync(join(tmpdir(), "marble-pwa-browser-"));
let browser;
try {
  const releases = {
    a: createRelease(join(temporaryDirectory, "a"), "a"),
    b: createRelease(join(temporaryDirectory, "b"), "b"),
  };
  browser = await launchBrowser();
  await testModuleWorkerUpgrade(browser, releases);
  console.log("PWA browser regression tests passed.");
} finally {
  await browser?.close();
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
