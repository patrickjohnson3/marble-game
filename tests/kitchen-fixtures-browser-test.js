import assert from "node:assert/strict";
import { timing } from "../core/game-config.js";
import { collectBrowserErrors } from "../tools/browser-support.js";

function cupLayers() {
  const cup = document.querySelector(".kitchenCupSprite");
  const marble = document.getElementById("marble");
  const z = (element) => Number(window.getComputedStyle(element).zIndex);
  return {
    parent: cup.parentElement.id,
    cupOpacity: window.getComputedStyle(cup).opacity,
    marbleOpacity: Number(window.getComputedStyle(marble).opacity),
    cup: z(cup),
    marble: z(marble),
    hitboxes: z(document.getElementById("hitboxes")),
    ordinaryFixtures: z(document.querySelector(".kitchenObstacleLayer")),
  };
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
        body: `import { createApp } from "./app.js";
window.__cupApp = createApp();`,
      }),
    );
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.locator("#start").click();
    await page.keyboard.press("ArrowRight");
    await page.waitForFunction(
      () => window.__cupApp.state.intro.released,
      null,
      {
        timeout: timing.introReleaseDelayMs + 5000,
      },
    );
    const centerY = await page.evaluate(() => {
      const app = window.__cupApp;
      app.gameController.pause();
      const cup = app.mapRuntime.state.activeMap.elements.find(
        (item) => item.fixture === "tippedCup",
      );
      // The authored cup opens downward. Position once outside its mouth;
      // all entry/exit movement below comes from ordinary keyboard input.
      if (cup.angle !== Math.PI / 2)
        throw new Error(
          "Update the keyboard approach for the authored cup rotation",
        );
      Object.assign(app.state.marble, {
        x: cup.x + cup.w / 2 - 45,
        y: cup.y + cup.h / 2 + 240,
        vx: 0,
        vy: 0,
      });
      Object.assign(app.state.input.tilt, { smoothX: 0, smoothY: 0 });
      app.mapRuntime.state.cockroach.harassmentIn = 10000;
      app.cameraController.centerOnMarble();
      app.gameController.resume();
      return cup.y + cup.h / 2;
    });
    const outside = await page.evaluate(cupLayers);
    assert.equal(
      outside.marbleOpacity,
      1,
      "the marble remains opaque outside the cup",
    );
    assert.ok(outside.cup > outside.marble);
    await page.keyboard.down("ArrowUp");
    await page.waitForFunction(
      (y) => {
        const app = window.__cupApp;
        if (app.state.marble.y >= y) return false;
        app.gameController.pause();
        return true;
      },
      centerY,
      { timeout: 5000 },
    );
    await page.keyboard.up("ArrowUp");
    await page.waitForFunction(() =>
      document.getElementById("marble").classList.contains("insideCup"),
    );
    const layers = await page.evaluate(cupLayers);
    assert.equal(
      layers.parent,
      "obstacles",
      "the cup must escape the lower fixture stacking context",
    );
    assert.equal(layers.cupOpacity, "1", "the ceramic stays opaque");
    assert.ok(
      layers.marbleOpacity > 0 && layers.marbleOpacity < 1,
      "the marble is visible as a translucent through-surface cue",
    );
    assert.ok(
      layers.ordinaryFixtures < layers.cup && layers.cup < layers.marble,
      "the translucent marble paints above the cup",
    );
    assert.ok(
      layers.hitboxes > layers.marble,
      "debug geometry remains visible inside the cup",
    );
    await page.evaluate(() => window.__cupApp.gameController.resume());
    await page.keyboard.down("ArrowDown");
    await page.waitForFunction(
      (y) => {
        const app = window.__cupApp;
        if (app.state.marble.y <= y + 240) return false;
        app.gameController.pause();
        return true;
      },
      centerY,
      { timeout: 5000 },
    );
    await page.keyboard.up("ArrowDown");
    await page.waitForFunction(
      () => !document.getElementById("marble").classList.contains("insideCup"),
    );
    const exited = await page.evaluate(cupLayers);
    assert.equal(
      exited.marbleOpacity,
      1,
      "leaving restores the normal opaque marble",
    );
    assert.ok(exited.marble < exited.cup, "leaving restores normal layering");
    // Re-enter before Retry so reset cannot pass merely because the cue was
    // already cleared by the preceding exit.
    await page.evaluate(() => window.__cupApp.gameController.resume());
    await page.keyboard.down("ArrowUp");
    await page.waitForFunction(
      (y) => {
        const app = window.__cupApp;
        if (app.state.marble.y >= y) return false;
        app.gameController.pause();
        return true;
      },
      centerY,
      { timeout: 5000 },
    );
    await page.keyboard.up("ArrowUp");
    await page.waitForFunction(() =>
      document.getElementById("marble").classList.contains("insideCup"),
    );
    const reset = await page.evaluate(() => {
      const app = window.__cupApp;
      const oldCup = document.querySelector(".kitchenCupSprite");
      app.mapProgression.retryCurrentMap();
      const spawn = app.mapRuntime.state.activeMap.spawn;
      const result = {
        atSpawn:
          app.state.marble.x === spawn.x && app.state.marble.y === spawn.y,
        oldCupRemoved: !oldCup.isConnected,
        cupCount: document.querySelectorAll(".kitchenCupSprite").length,
      };
      return result;
    });
    assert.deepEqual(reset, {
      atSpawn: true,
      oldCupRemoved: true,
      cupCount: 1,
    });
    await page.waitForFunction(
      () => !document.getElementById("marble").classList.contains("insideCup"),
    );
    assert.equal(
      (await page.evaluate(cupLayers)).marbleOpacity,
      1,
      "Retry inside the cup clears translucency",
    );
    await page.evaluate(() =>
      window.__cupApp.mapProgression.loadMap("living-room"),
    );
    assert.equal(await page.locator(".kitchenCupSprite").count(), 0);
    assert.equal(
      await page
        .locator("#marble")
        .evaluate((element) => window.getComputedStyle(element).opacity),
      "1",
    );
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
}
