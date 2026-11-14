import assert from "node:assert/strict";
import { timing } from "../core/game-config.js";
import { collectBrowserErrors } from "../tools/browser-support.js";

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
    const layers = await page.evaluate(() => {
      const cup = document.querySelector(".kitchenCupSprite");
      const z = (element) => Number(window.getComputedStyle(element).zIndex);
      return {
        parent: cup.parentElement.id,
        opacity: window.getComputedStyle(cup).opacity,
        cup: z(cup),
        marble: z(document.getElementById("marble")),
        hitboxes: z(document.getElementById("hitboxes")),
        ordinaryFixtures: z(document.querySelector(".kitchenObstacleLayer")),
      };
    });
    assert.equal(
      layers.parent,
      "obstacles",
      "the cup must escape the lower fixture stacking context",
    );
    assert.equal(layers.opacity, "1");
    assert.ok(
      layers.ordinaryFixtures < layers.marble && layers.cup > layers.marble,
      "only the overhead cup surface occludes the marble",
    );
    assert.ok(
      layers.hitboxes > layers.cup,
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
      app.mapProgression.loadMap("living-room");
      result.cupsAfterLeaving =
        document.querySelectorAll(".kitchenCupSprite").length;
      return result;
    });
    assert.deepEqual(reset, {
      atSpawn: true,
      oldCupRemoved: true,
      cupCount: 1,
      cupsAfterLeaving: 0,
    });
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
}
