import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { baseMapConfig } from "../core/map-config.js";
import {
  closeServer,
  collectBrowserErrors,
  createStaticServer,
  launchBrowser,
  listen,
} from "./browser-support.js";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Shared with ad-hoc browser playtests. Only this intercepted development boot
// exposes the app; normal boot.js and the production renderer remain untouched.
export async function openMapPreview({ mapId, phone = false }) {
  if (!baseMapConfig.variants.some((variant) => variant.id === mapId)) {
    throw new Error(`Unknown map: ${mapId}`);
  }
  const server = createStaticServer(repositoryRoot);
  await listen(server);
  let browser;
  let errors = [];
  try {
    browser = await launchBrowser();
    const page = await browser.newPage({
      viewport: phone
        ? { width: 390, height: 844 }
        : { width: 1000, height: 960 },
      deviceScaleFactor: 1,
      serviceWorkers: "block",
    });
    errors = collectBrowserErrors(page);
    await page.route("**/boot.js*", (route) =>
      route.fulfill({
        contentType: "text/javascript",
        body: `import { createApp } from "./app.js";
import { baseMapConfig } from "./core/map-config.js";
import { resolveMapVariantConfig } from "./core/map-variants.js";
window.__mapPreview = createApp({
  initialMap: resolveMapVariantConfig(baseMapConfig, ${JSON.stringify(mapId)}),
});`,
      }),
    );
    await page.goto(`http://127.0.0.1:${server.address().port}/`, {
      waitUntil: "networkidle",
    });
    await page.waitForFunction(() => window.__mapPreview !== undefined);
    await page.locator("#start").click();
    await page.keyboard.press("ArrowRight");
    await page.waitForFunction(
      () => window.__mapPreview.state.intro.released,
      null,
      { timeout: 15000 },
    );
    // Allow normal active frames before reading the game's existing metrics.
    await page.waitForTimeout(1000);
    return {
      page,
      errors,
      async close() {
        await browser.close();
        await closeServer(server);
      },
    };
  } catch (error) {
    await browser?.close();
    await closeServer(server);
    if (errors.length) {
      throw new Error([error.message, ...errors].join("\n"), { cause: error });
    }
    throw error;
  }
}

// Runs inside the real browser page. Check identity before Retry can reset a
// successor map and produce apparently successful evidence for the wrong room.
export function prepareMapCapture(mapId) {
  const app = window.__mapPreview;
  const activeMapId = app.mapRuntime.state.activeMap.variantId;
  if (activeMapId !== mapId) {
    throw new Error(
      `Cannot capture '${mapId}': preview has already advanced to '${activeMapId}'.`,
    );
  }
  const liveFrameMetrics = { ...app.state.perf };
  app.state.game.paused = true;
  // Retry restores the authored spawn, all dynamic actors and mutable props.
  // No screenshot contains the small keyboard nudge used to start input.
  app.mapProgression.retryCurrentMap();
  const map = app.mapRuntime.state.activeMap;
  return {
    mapId: map.variantId,
    name: map.name,
    world: map.world,
    objective: map.objective,
    regions: map.regions,
    spawn: map.spawn,
    views: map.views ?? [],
    liveFrameMetrics,
    canvasBytes: [...document.querySelectorAll("canvas")].reduce(
      (sum, canvas) => sum + canvas.width * canvas.height * 4,
      0,
    ),
    elementCount: map.elements.length,
  };
}

export async function renderMap({ mapId, phone = false, out }) {
  const directory = resolve(
    out ?? join(tmpdir(), "marble-map", mapId, phone ? "phone" : "desktop"),
  );
  await mkdir(directory, { recursive: true });
  const preview = await openMapPreview({ mapId, phone });
  try {
    const { page, errors } = preview;
    const report = await page.evaluate(prepareMapCapture, mapId);
    const viewport = page.viewportSize();
    const overviewScale = Math.min(
      (viewport.width - 32) / report.world.width,
      (viewport.height - 32) / report.world.height,
    );
    const views = [
      {
        id: "overview",
        x: report.world.width / 2,
        y: report.world.height / 2,
        scale: overviewScale,
      },
      { id: "spawn", x: report.spawn.x, y: report.spawn.y, scale: 1 },
    ];
    if (report.objective?.type === "reach") {
      const region = report.regions.find(
        (candidate) => candidate.id === report.objective.region,
      );
      if (!region) throw new Error("Reach objective has no declared region");
      views.push({
        id: "objective",
        x: region.x + (region.r ? 0 : region.w / 2),
        y: region.y + (region.r ? 0 : region.h / 2),
        scale: 1,
      });
    }
    views.push(...report.views);
    const files = [];
    const ids = new Set();
    for (const view of views) {
      if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(view.id) || ids.has(view.id)) {
        throw new Error(`View needs a unique filename-safe id: ${view.id}`);
      }
      ids.add(view.id);
      if (
        !Number.isFinite(view.x) ||
        !Number.isFinite(view.y) ||
        !Number.isFinite(view.scale ?? 1) ||
        (view.scale ?? 1) <= 0
      ) {
        throw new Error(`View has invalid coordinates or scale: ${view.id}`);
      }
      await page.evaluate(({ x, y, scale = 1 }) => {
        const { state, cameraController } = window.__mapPreview;
        Object.assign(state.camera, {
          scale,
          x: window.innerWidth / 2 - x * scale,
          y: window.innerHeight / 2 - y * scale,
        });
        cameraController.applyTransform();
      }, view);
      // Let the requested Retry render and CSS layout reach the compositor.
      await page.evaluate(
        () =>
          new Promise((done) =>
            requestAnimationFrame(() => requestAnimationFrame(done)),
          ),
      );
      const filename = `${view.id}.png`;
      await page.screenshot({ path: join(directory, filename) });
      files.push(filename);
    }
    const result = {
      ...report,
      viewport,
      views,
      files,
      errors,
      measurementNote:
        "Desktop headless Chrome JS frame metrics and canvas backing storage; not GPU, compositor, or physical-phone performance.",
    };
    await writeFile(
      join(directory, "report.json"),
      JSON.stringify(result, null, 2) + "\n",
    );
    if (errors.length) throw new Error(errors.join("\n"));
    console.log(`Rendered ${mapId}: ${directory}`);
    console.log(JSON.stringify(result, null, 2));
    return result;
  } finally {
    await preview.close();
  }
}

async function main(args) {
  if (!args.length || args.includes("--help")) {
    console.log(
      "Usage: npm run map:render -- <map-id> [--out <directory>] [--phone]\n" +
        "Maps: " +
        baseMapConfig.variants.map((variant) => variant.id).join(", "),
    );
    return;
  }
  const options = { mapId: args[0] };
  for (let index = 1; index < args.length; index++) {
    if (args[index] === "--phone") options.phone = true;
    else if (args[index] === "--out" && args[index + 1])
      options.out = args[++index];
    else throw new Error(`Unknown or incomplete argument: ${args[index]}`);
  }
  await renderMap(options);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
