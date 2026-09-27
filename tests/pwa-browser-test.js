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
import { copy } from "../core/copy.js";
import { tuning } from "../core/game-config.js";
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

  // Expose this release's real app for state-preservation assertions. The worker
  // still installs and serves these generated files, without request routing.
  const bootPath = join(directory, "boot.js");
  writeFileSync(
    bootPath,
    readFileSync(bootPath, "utf8").replace(
      "createApp();",
      "window.__pwaApp = createApp();",
    ),
  );

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

function createDeploymentServer(
  initialRelease,
  shellCacheControl = "no-store",
) {
  let release = initialRelease;
  let unavailableFile;
  const requests = [];
  const server = createServer((request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
    if (url.pathname === "/pwa-probe") {
      response
        .writeHead(200, { "content-type": "text/html" })
        .end(
          '<!doctype html><title>PWA activation probe</title><link rel="icon" href="data:,">',
        );
      return;
    }
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
    if (file === unavailableFile) {
      response.writeHead(503, { "cache-control": "no-store" }).end();
      return;
    }
    try {
      const content = readFileSync(filePath);
      response.writeHead(200, {
        "content-type":
          contentTypes[extname(file)] ?? "application/octet-stream",
        // Keep shell freshness separate from imported worker module caching.
        "cache-control":
          file === "index.html" ? shellCacheControl : "max-age=600",
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
    withhold(file) {
      unavailableFile = file;
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

async function waitForActiveRelease(
  page,
  cacheName,
  registrationUrl = page.url(),
) {
  await page.waitForFunction(
    ({ expected, registrationUrl: url }) => {
      // Poll resolved state: this browser runner treats a Promise predicate as
      // truthy before its asynchronous cache lookup has completed.
      Promise.all([
        window.caches.keys(),
        navigator.serviceWorker.getRegistration(url),
      ]).then(([names, registration]) => {
        window.__pwaActiveCache =
          names.includes(expected) &&
          !names.some(
            (name) => name.startsWith("marble-game-") && name !== expected,
          ) &&
          registration?.active?.state === "activated" &&
          !registration.installing
            ? expected
            : null;
      });
      return window.__pwaActiveCache === expected;
    },
    { expected: cacheName, registrationUrl },
    { timeout },
  );
}

async function waitForWaitingRelease(page, release) {
  await page.waitForFunction(
    () => {
      navigator.serviceWorker.getRegistration().then((registration) => {
        window.__pwaWaiting = registration?.waiting?.state === "installed";
      });
      return window.__pwaWaiting === true;
    },
    null,
    { timeout },
  );
  assert.ok(
    (await cacheState(page)).some((cache) => cache.name === release.cacheName),
  );
}

async function reopenAfterClosing(context, page, baseUrl, release) {
  await page.close();
  const reopened = await context.newPage();
  const errors = collectBrowserErrors(reopened);
  // Wait outside worker scope: opening another controlled app page too early
  // can keep the old worker alive and prevent normal waiting-worker activation.
  await reopened.goto(new URL("/pwa-probe", baseUrl).href);
  await waitForActiveRelease(reopened, release.cacheName, baseUrl);
  let navigations = 0;
  reopened.on("framenavigated", (frame) => {
    if (frame === reopened.mainFrame()) navigations++;
  });
  await reopened.goto(baseUrl);
  await waitForBoot(reopened, release.version);
  await reopened.waitForLoadState("networkidle");
  assert.equal(
    navigations,
    1,
    "reopening the updated game must boot without a reload loop",
  );
  assert.deepEqual(
    errors,
    [],
    "reopening an updated release must not log errors",
  );
  return reopened;
}

async function assertCachedShellVersion(page, baseUrl, release) {
  const versions = await page.evaluate(
    async ({ cacheName, url }) => {
      const cache = await window.caches.open(cacheName);
      return Promise.all(
        [url, url + "index.html"].map(async (key) => {
          const response = await cache.match(key);
          const html = await response?.text();
          return html?.match(/const assetVersion = "([^"]+)";/)?.[1];
        }),
      );
    },
    { cacheName: release.cacheName, url: baseUrl },
  );
  assert.deepEqual(
    versions,
    [release.version, release.version],
    "both precached shells must match the release that owns their cache",
  );
}

async function disableHttpCache(context, page) {
  const session = await context.newCDPSession(page);
  await session.send("Network.enable");
  await session.send("Network.setCacheDisabled", { cacheDisabled: true });
}

async function testModuleWorkerUpgrade(browser, releases, shellCacheControl) {
  const deployment = createDeploymentServer(releases.a, shellCacheControl);
  const port = await listen(deployment.server);
  const baseUrl = `http://127.0.0.1:${port}${scope}`;
  const context = await browser.newContext({ serviceWorkers: "allow" });
  let page = await context.newPage();
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
    await waitForWaitingRelease(page, releases.b);
    await waitForBoot(page, releases.a.version);
    await assertCachedShellVersion(page, baseUrl, releases.a);
    page = await reopenAfterClosing(context, page, baseUrl, releases.b);
    await assertCachedShellVersion(page, baseUrl, releases.b);
    await waitForBoot(page, releases.b.version);
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
    assert.equal(
      navigations - beforeUpgrade,
      1,
      "an ordinary visit may install an update but must not force a reload",
    );

    // Disable HTTP cache only after the upgrade, so a browser cache hit cannot
    // masquerade as service-worker offline coverage or mask stale imports.
    await disableHttpCache(context, page);
    await context.setOffline(true);
    let offlineNavigations = 0;
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) offlineNavigations++;
    });
    const offlineErrors = collectBrowserErrors(page);
    await page.goto(baseUrl);
    await waitForBoot(page, releases.b.version);
    assert.equal(await page.evaluate(() => window.__pwaRelease), "b");
    assert.equal(offlineNavigations, 1, "offline boot must not reload");
    assert.deepEqual(
      [...errors, ...offlineErrors],
      [],
      "PWA upgrade and offline boot must not log errors",
    );
  } finally {
    await context.close();
    await closeServer(deployment.server);
  }
}

async function testFailedUpgradePreservesShell(browser, releases) {
  const deployment = createDeploymentServer(releases.a);
  const port = await listen(deployment.server);
  const baseUrl = `http://127.0.0.1:${port}${scope}`;
  const context = await browser.newContext({ serviceWorkers: "allow" });
  await context.addInitScript(() => {
    window.__pwaWorkerStates = [];
    navigator.serviceWorker.ready.then((registration) => {
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        worker.addEventListener("statechange", () => {
          window.__pwaWorkerStates.push(worker.state);
        });
      });
    });
  });
  let page = await context.newPage();
  const errors = collectBrowserErrors(page);

  try {
    await page.goto(baseUrl);
    await waitForBoot(page, releases.a.version);
    await page.waitForFunction(
      () => navigator.serviceWorker.controller !== null,
      null,
      { timeout },
    );
    await assertCachedShellVersion(page, baseUrl, releases.a);

    deployment.deploy(releases.b);
    deployment.withhold("pwa-lazy-proof.js");
    await page.goto(baseUrl);
    await page.waitForFunction(
      () => window.__pwaWorkerStates.includes("redundant"),
      null,
      { timeout },
    );
    await page.waitForLoadState("networkidle");
    await assertCachedShellVersion(page, baseUrl, releases.a);
    await waitForBoot(page, releases.a.version);

    await disableHttpCache(context, page);
    await context.setOffline(true);
    await page.goto(baseUrl);
    await waitForBoot(page, releases.a.version);
    await assertCachedShellVersion(page, baseUrl, releases.a);

    deployment.withhold(undefined);
    await context.setOffline(false);
    await page.goto(baseUrl);
    await waitForWaitingRelease(page, releases.b);
    await waitForBoot(page, releases.a.version);
    await assertCachedShellVersion(page, baseUrl, releases.a);
    page = await reopenAfterClosing(context, page, baseUrl, releases.b);
    await assertCachedShellVersion(page, baseUrl, releases.b);
    await waitForBoot(page, releases.b.version);
    assert.equal(await page.evaluate(() => window.__pwaRelease), "b");

    const recoveredErrors = collectBrowserErrors(page);
    await context.setOffline(true);
    await page.goto(baseUrl);
    await waitForBoot(page, releases.b.version);
    assert.deepEqual(
      [...errors, ...recoveredErrors],
      [],
      "failed upgrade and recovery must preserve boot",
    );
  } finally {
    await context.close();
    await closeServer(deployment.server);
  }
}

async function testFirstInstallDocumentUpgrade(browser, releases) {
  const deployment = createDeploymentServer(releases.a);
  const port = await listen(deployment.server);
  const baseUrl = `http://127.0.0.1:${port}${scope}`;
  const context = await browser.newContext({ serviceWorkers: "allow" });
  let page = await context.newPage();
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
    await page.waitForLoadState("networkidle");
    assert.equal(navigations, 1, "the first worker claim must not reload");

    await page.locator("#start").click();
    await page.evaluate((sampleCount) => {
      for (let index = 0; index < sampleCount; index++) {
        const event = new window.Event("deviceorientation");
        Object.defineProperties(event, {
          beta: { value: 12 },
          gamma: { value: 8 },
        });
        window.dispatchEvent(event);
      }
    }, tuning.neutralSampleCount);
    await page.locator("#settingsToggle").click();
    await page.locator("#diagnosticsSettingsTitle").click();
    await page.locator("#mapSelect").selectOption("living-room");
    await page.locator("#loadMap").click();
    await page.locator("#settingsToggle").click();
    const encounter = await page.evaluate(() => {
      const { state, mapRuntime } = window.__pwaApp;
      return {
        marble: state.marble,
        mouse: mapRuntime.state.mouse,
        map: mapRuntime.state.activeMap.variantId,
      };
    });
    assert.equal(encounter.map, "living-room");
    assert.equal(await page.locator("#settingsOverlay").isVisible(), true);

    const secondPage = await context.newPage();
    const secondErrors = collectBrowserErrors(secondPage);
    await secondPage.goto(baseUrl);
    await waitForBoot(secondPage, releases.a.version);
    deployment.deploy(releases.b);
    // Keep both old-release documents open throughout installation. An update
    // must preserve the actual paused encounter and require neither reload.
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      await registration.update();
    });
    await waitForWaitingRelease(page, releases.b);
    assert.equal(
      navigations,
      1,
      "installing an update must not reload a live encounter",
    );
    assert.deepEqual(
      await page.evaluate(() => {
        const { state, mapRuntime } = window.__pwaApp;
        return {
          marble: state.marble,
          mouse: mapRuntime.state.mouse,
          map: mapRuntime.state.activeMap.variantId,
        };
      }),
      encounter,
      "waiting updates must preserve the current map, marble and mouse",
    );
    assert.ok(
      (await page.locator("#pwaStatus").textContent()).includes(
        copy.pwa.updateReady,
      ),
    );
    await assertCachedShellVersion(page, baseUrl, releases.a);
    await page.close();
    page = secondPage;
    await waitForWaitingRelease(page, releases.b);
    await waitForBoot(page, releases.a.version);
    assert.ok(
      (await cacheState(page)).some(
        (cache) => cache.name === releases.a.cacheName,
      ),
      "closing one tab must retain the other tab's release cache",
    );
    page = await reopenAfterClosing(context, page, baseUrl, releases.b);
    await assertCachedShellVersion(page, baseUrl, releases.b);
    assert.equal(await page.evaluate(() => window.__pwaRelease), "b");

    await disableHttpCache(context, page);
    const reopenedErrors = collectBrowserErrors(page);
    await context.setOffline(true);
    let offlineNavigations = 0;
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) offlineNavigations++;
    });
    await page.goto(baseUrl);
    await waitForBoot(page, releases.b.version);
    assert.equal(
      offlineNavigations,
      1,
      "offline boot must not trigger an update loop",
    );
    assert.deepEqual(
      [...errors, ...secondErrors, ...reopenedErrors],
      [],
      "updating a first-install document must preserve normal and offline boot",
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
  await testFailedUpgradePreservesShell(browser, releases);
  await testModuleWorkerUpgrade(browser, releases, "max-age=600");
  await testFirstInstallDocumentUpgrade(browser, releases);
  console.log("PWA browser regression tests passed.");
} finally {
  await browser?.close();
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
