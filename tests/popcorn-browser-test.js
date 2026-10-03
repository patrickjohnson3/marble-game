import assert from "node:assert/strict";
import { timing } from "../core/game-config.js";
import { collectBrowserErrors } from "../tools/browser-support.js";

export async function testPopcornSpill(browser, baseUrl) {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    serviceWorkers: "block",
  });
  const errors = collectBrowserErrors(page);
  try {
    await page.route("**/boot.js*", (route) =>
      route.fulfill({
        contentType: "text/javascript",
        body: `import { createApp } from "./app.js";
import { baseMapConfig } from "./core/map-config.js";
import { resolveMapVariantConfig } from "./core/map-variants.js";
window.__popcornApp = createApp({ initialMap: resolveMapVariantConfig(baseMapConfig, "living-room") });`,
      }),
    );
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.locator("#start").click();
    await page.keyboard.press("ArrowRight");
    await page.waitForFunction(
      () => window.__popcornApp.state.intro.released,
      null,
      { timeout: timing.introReleaseDelayMs + 5000 },
    );
    const original = await page.evaluate(() => {
      const app = window.__popcornApp;
      app.gameController.pause();
      app.mapProgression.retryCurrentMap();
      const piece = app.kitchenDynamics.state.cheerios[0];
      Object.assign(app.state.marble, {
        x: piece.x - piece.radius - app.state.marble.r - 8,
        y: piece.y,
        vx: 0,
        vy: 0,
      });
      Object.assign(app.state.input.tilt, {
        rawX: 0,
        rawY: 0,
        neutralX: 0,
        neutralY: 0,
        smoothX: 0,
        smoothY: 0,
      });
      return {
        x: piece.x,
        y: piece.y,
        count: app.kitchenDynamics.state.cheerios.length,
        mouseHealth: app.mapRuntime.state.mouse.health,
      };
    });
    assert.equal(
      await page.locator(".livingRoomPopcorn").count(),
      original.count,
    );
    const painted = page.locator(".livingRoomPopcorn").first();
    const initialTransform = await painted.evaluate(
      (node) => node.style.transform,
    );
    await page.evaluate(() => window.__popcornApp.gameController.resume());
    await page.keyboard.down("ArrowRight");
    await page.waitForFunction(() => {
      const piece = window.__popcornApp.kitchenDynamics.state.cheerios[0];
      return piece.playerDisturbed && piece.vx > 0;
    });
    await page.keyboard.up("ArrowRight");
    const pushed = await page.evaluate(() => {
      const app = window.__popcornApp;
      app.gameController.pause();
      const piece = app.kitchenDynamics.state.cheerios[0];
      return {
        x: piece.x,
        y: piece.y,
        vx: piece.vx,
        mouseHealth: app.mapRuntime.state.mouse.health,
      };
    });
    assert.ok(
      pushed.x > original.x,
      "real keyboard input pushes authored popcorn",
    );
    assert.ok(pushed.vx > 0);
    assert.equal(
      pushed.mouseHealth,
      original.mouseHealth,
      "moving food must not damage the opponent",
    );
    assert.notEqual(
      await painted.evaluate((node) => node.style.transform),
      initialTransform,
      "the live frame loop renders the push",
    );
    assert.match(
      await page.locator("#objectiveStatus").textContent(),
      /Defeat the mouse/,
    );
    // Separate only the test marble so residual food momentum can be observed
    // without further input/contact, through the same running game loop.
    await page.evaluate(() => {
      const app = window.__popcornApp;
      Object.assign(app.state.marble, { x: 500, y: 3600, vx: 0, vy: 0 });
      Object.assign(app.state.input.tilt, { smoothX: 0, smoothY: 0 });
      app.gameController.resume();
    });
    await page.waitForFunction(
      () => window.__popcornApp.kitchenDynamics.state.cheerios[0].vx === 0,
    );
    const coastedX = await page.evaluate(
      () => window.__popcornApp.kitchenDynamics.state.cheerios[0].x,
    );
    assert.ok(
      coastedX > pushed.x,
      "popcorn coasts and settles after contact ends",
    );
    await page.locator("#settingsToggle").click();
    await page.locator("#retryMap").click();
    const retried = await page.evaluate(() => {
      const app = window.__popcornApp;
      app.gameController.pause();
      const piece = app.kitchenDynamics.state.cheerios[0];
      return {
        x: piece.x,
        y: piece.y,
        vx: piece.vx,
        disturbed: piece.playerDisturbed,
      };
    });
    assert.deepEqual(retried, {
      x: original.x,
      y: original.y,
      vx: 0,
      disturbed: false,
    });
    assert.equal(
      await page.locator(".livingRoomPopcorn").count(),
      original.count,
      "Retry replaces rather than duplicates sprites",
    );
    await page.evaluate(() =>
      window.__popcornApp.mapProgression.loadMap("kitchen-floor"),
    );
    assert.equal(
      await page.locator(".livingRoomPopcorn").count(),
      0,
      "changing rooms removes the spill artwork",
    );
    assert.equal(
      await page.evaluate(() =>
        window.__popcornApp.kitchenDynamics.state.cheerios.some(
          (piece) => piece.kind === "popcorn",
        ),
      ),
      false,
    );
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
}
