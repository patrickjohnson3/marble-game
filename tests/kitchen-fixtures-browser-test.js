import assert from "node:assert/strict";
import { timing } from "../core/game-config.js";
import { collectBrowserErrors } from "../tools/browser-support.js";

// Inspect actual canvas alpha relative to the geometric roof mask. This is a
// clipping invariant, not a screenshot/color golden or a cosmetic pixel value.
function containerAppearance() {
  const app = window.__cupApp;
  const container = app.mapRuntime.state.containers[0];
  const sprite = document.querySelector(".kitchenCupSprite");
  const marble = document.getElementById("marble");
  const canvas = sprite.querySelector("canvas");
  const result = {
    cupOpacity: window.getComputedStyle(sprite).opacity,
    cupArt: window.getComputedStyle(sprite, "::before").backgroundImage,
    cupFilter: window.getComputedStyle(sprite).filter,
    marbleOpacity: window.getComputedStyle(marble).opacity,
    belowCup:
      Number(window.getComputedStyle(marble).zIndex) <
      Number(window.getComputedStyle(sprite).zIndex),
    canvasCount: document.querySelectorAll(".containerSilhouetteCanvas").length,
    marbleCovered: canvas?.getAttribute("data-marble-covered"),
    roachCovered: canvas?.getAttribute("data-roach-covered"),
    paintInside: 0,
    paintOutside: 0,
    maxAlpha: 0,
  };
  if (!canvas) return result;
  const scale = canvas.width / container.width;
  const pixels = canvas
    .getContext("2d")
    .getImageData(0, 0, canvas.width, canvas.height).data;
  const roof = container.cover;
  for (let y = 0; y < canvas.height; y++)
    for (let x = 0; x < canvas.width; x++) {
      const alpha = pixels[(y * canvas.width + x) * 4 + 3];
      if (!alpha) continue;
      const lx = (x + 0.5 - canvas.width / 2) / scale,
        ly = (y + 0.5 - canvas.height / 2) / scale;
      if (
        lx < roof.left - 2 ||
        lx > roof.right + 2 ||
        ly < roof.top - 2 ||
        ly > roof.bottom + 2
      )
        result.paintOutside++;
      else result.paintInside++;
      result.maxAlpha = Math.max(result.maxAlpha, alpha);
    }
  return result;
}

export async function testCupEntry(browser, baseUrl) {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    serviceWorkers: "block",
  });
  const errors = collectBrowserErrors(page);
  try {
    await page.route("**/boot.js*", (route) =>
      route.fulfill({
        contentType: "text/javascript",
        body: `import {createApp} from "./app.js"; window.__cupApp=createApp();`,
      }),
    );
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.locator("#start").click();
    await page.keyboard.press("ArrowRight");
    await page.waitForFunction(
      () => window.__cupApp.state.intro.released,
      null,
      { timeout: timing.introReleaseDelayMs + 5000 },
    );
    const centerY = await page.evaluate(() => {
      const app = window.__cupApp;
      app.gameController.pause();
      const c = app.mapRuntime.state.containers[0];
      Object.assign(app.state.marble, {
        x: c.centerX - 45,
        y: c.centerY + 240,
        vx: 0,
        vy: 0,
      });
      Object.assign(app.state.input.tilt, { smoothX: 0, smoothY: 0 });
      app.mapRuntime.state.cockroach.harassmentIn = 10000;
      app.cameraController.centerOnMarble();
      app.gameController.resume();
      return c.centerY;
    });
    const outside = await page.evaluate(containerAppearance);
    assert.equal(outside.marbleOpacity, "1");
    assert.equal(outside.belowCup, true);
    assert.equal(
      outside.canvasCount,
      0,
      "exterior entities allocate no silhouette surface",
    );
    await page.keyboard.down("ArrowUp");
    await page.waitForFunction(
      () => {
        const a = window.__cupApp,
          c = a.mapRuntime.state.containers[0],
          m = a.state.marble;
        const dx = m.x - c.centerX,
          dy = m.y - c.centerY,
          x = c.cos * dx + c.sin * dy;
        if (Math.abs(x - c.cover.right) > m.r * 0.6) return false;
        a.gameController.pause();
        return true;
      },
      null,
      { timeout: 5000 },
    );
    await page.keyboard.up("ArrowUp");
    await page.waitForFunction(
      () =>
        document
          .querySelector(".containerSilhouetteCanvas")
          ?.getAttribute("data-marble-covered") === "true",
    );
    const partial = await page.evaluate(containerAppearance);
    assert.ok(partial.paintInside > 0);
    assert.equal(
      partial.paintOutside,
      0,
      "partial silhouettes never paint over the rim, handle, or exterior",
    );
    assert.equal(partial.marbleOpacity, "1");
    assert.equal(
      partial.belowCup,
      true,
      "partial entry never lifts or fades the entire sphere",
    );
    await page.evaluate(() => window.__cupApp.gameController.resume());
    await page.keyboard.down("ArrowUp");
    await page.waitForFunction(
      (y) => {
        const a = window.__cupApp;
        if (a.state.marble.y >= y) return false;
        a.gameController.pause();
        return true;
      },
      centerY,
      { timeout: 5000 },
    );
    await page.keyboard.up("ArrowUp");
    const inside = await page.evaluate(containerAppearance);
    assert.equal(inside.cupOpacity, "1");
    assert.notEqual(
      inside.cupArt,
      "none",
      "the static ceramic artwork remains visible",
    );
    assert.equal(
      inside.cupFilter,
      "none",
      "live indicators do not repaint a parent shadow filter",
    );
    assert.ok(
      inside.paintInside > 0 && inside.maxAlpha < 255,
      "an opaque cup contains a restrained silhouette, not a solid pasted sphere",
    );
    assert.equal(inside.paintOutside, 0);
    await page.evaluate(() => window.__cupApp.gameController.resume());
    await page.keyboard.down("ArrowDown");
    await page.waitForFunction(
      (y) => {
        const a = window.__cupApp;
        if (a.state.marble.y <= y + 240) return false;
        a.gameController.pause();
        return true;
      },
      centerY,
      { timeout: 5000 },
    );
    await page.keyboard.up("ArrowDown");
    await page.waitForFunction(
      () =>
        document
          .querySelector(".containerSilhouetteCanvas")
          .getAttribute("data-marble-covered") === "false",
    );
    const exited = await page.evaluate(containerAppearance);
    assert.equal(exited.marbleOpacity, "1");
    assert.equal(exited.paintInside, 0);
    assert.equal(exited.belowCup, true);

    // Controlled encounter: a stationary marble inside, a pursuer behind the
    // closed back. Movement, solid avoidance, attacks and rendering stay real.
    await page.evaluate(() => {
      const a = window.__cupApp,
        c = a.mapRuntime.state.containers[0];
      Object.assign(a.state.marble, {
        x: c.centerX - 45,
        y: c.centerY - 20,
        vx: 0,
        vy: 0,
      });
      Object.assign(a.state.input.tilt, {
        rawX: 0,
        rawY: 0,
        smoothX: 0,
        smoothY: 0,
      });
      Object.assign(a.mapRuntime.state.cockroach, {
        x: c.centerX - 45,
        y: c.centerY - 260,
        mode: "harass",
        engaged: true,
        decisionIn: 0,
        modeFrames: 10000,
        contactLatched: false,
        attackRecoveryFrames: 0,
        routeX: null,
        routeY: null,
      });
      a.gameController.resume();
    });
    await page.waitForFunction(
      () => {
        const a = window.__cupApp,
          r = a.mapRuntime.state.cockroach,
          c = a.mapRuntime.state.containers[0];
        const dx = r.x - c.centerX,
          dy = r.y - c.centerY,
          x = c.cos * dx + c.sin * dy,
          y = -c.sin * dx + c.cos * dy;
        if (
          !r.contactLatched ||
          x < c.interior.left ||
          x > c.interior.right ||
          y < c.interior.top ||
          y > c.interior.bottom
        )
          return false;
        a.gameController.pause();
        return true;
      },
      null,
      { timeout: 8000 },
    );
    const pursued = await page.evaluate(containerAppearance);
    assert.equal(
      pursued.roachCovered,
      "true",
      "a pursuer inside the cup gets the same occlusion treatment",
    );
    assert.equal(pursued.paintOutside, 0);
    assert.equal(
      await page.evaluate(
        () => window.__cupApp.mapRuntime.state.cockroach.mode,
      ),
      "harass",
    );
    await page.evaluate(() => {
      const a = window.__cupApp,
        c = a.mapRuntime.state.containers[0];
      Object.assign(a.state.marble, {
        x: c.centerX - 45,
        y: c.centerY + 320,
        vx: 0,
        vy: 0,
      });
      a.gameController.resume();
    });
    await page.waitForFunction(
      (y) => {
        const a = window.__cupApp;
        if (a.mapRuntime.state.cockroach.y <= y + 230) return false;
        a.gameController.pause();
        return true;
      },
      centerY,
      { timeout: 8000 },
    );
    assert.equal(
      await page.evaluate(
        () => window.__cupApp.mapRuntime.state.cockroach.mode,
      ),
      "harass",
      "leaving the cup does not clear pursuit",
    );
    // Retry while occupied, rather than relying on an already-cleared overlay.
    await page.evaluate(() => {
      const a = window.__cupApp,
        c = a.mapRuntime.state.containers[0];
      Object.assign(a.state.marble, {
        x: c.centerX - 45,
        y: c.centerY - 20,
        vx: 0,
        vy: 0,
      });
      a.gameController.resume();
    });
    await page.waitForFunction(() => {
      if (
        document
          .querySelector(".containerSilhouetteCanvas")
          ?.getAttribute("data-marble-covered") !== "true"
      )
        return false;
      window.__cupApp.gameController.pause();
      return true;
    });
    await page.evaluate(() => window.__cupApp.mapProgression.retryCurrentMap());
    assert.equal(
      await page.locator(".containerSilhouetteCanvas").count(),
      0,
      "Retry drops the disposable occupied-container surface",
    );
    await page.evaluate(() =>
      window.__cupApp.mapProgression.loadMap("living-room"),
    );
    assert.equal(await page.locator(".kitchenCupSprite").count(), 0);
    assert.equal(await page.locator(".containerSilhouetteCanvas").count(), 0);
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
}
