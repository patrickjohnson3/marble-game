import assert from "node:assert/strict";
import { cockroachConfig, timing } from "../core/game-config.js";
import { collectBrowserErrors } from "../tools/browser-support.js";

export async function testCockroachEncounter(browser, baseUrl) {
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
window.__cockroachApp = createApp();`,
      }),
    );
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.locator("#start").click();
    await page.keyboard.press("ArrowRight");
    await page.waitForFunction(
      () => window.__cockroachApp.state.intro.released,
      null,
      { timeout: timing.introReleaseDelayMs + 5000 },
    );
    assert.equal(await page.locator(".cockroachCanvas").count(), 1);
    assert.match(
      await page.locator("#objectiveStatus").textContent(),
      /Kill all ants/,
    );

    // Let a ready, scurrying insect acquire from beyond the old 900-unit
    // range and reach the marble using actual game-loop movement.
    await page.evaluate(() => {
      const app = window.__cockroachApp;
      app.gameController.pause();
      Object.assign(app.state.marble, { x: 1400, y: 3650, vx: 0, vy: 0 });
      Object.assign(app.state.input.tilt, { smoothX: 0, smoothY: 0 });
      Object.assign(app.mapRuntime.state.cockroach, {
        x: 2700,
        y: 3650,
        vx: 0,
        vy: 0,
        angle: Math.PI,
        mode: "scurry",
        modeFrames: 0,
        harassmentIn: 1,
        decisionIn: 0,
        pendingFrames: 0,
        contactLatched: false,
      });
      app.cameraController.centerOnMarble();
      app.gameController.resume();
    });
    await page.waitForFunction(
      () => window.__cockroachApp.mapRuntime.state.cockroach.mode === "retreat",
    );
    const attack = await page.evaluate(() => {
      const app = window.__cockroachApp;
      app.gameController.pause();
      return {
        speed: Math.hypot(app.state.marble.vx, app.state.marble.vy),
        cooldown: app.mapRuntime.state.cockroach.harassmentIn,
        squash: app.state.marble.impactSquash,
      };
    });
    assert.ok(attack.speed > 1, "contact visibly disrupts a stationary marble");
    assert.ok(attack.cooldown > 0 && attack.squash > 0);

    // Set a clear run-up, then let real keyboard input and collisions repel it.
    await page.evaluate((config) => {
      const app = window.__cockroachApp;
      Object.assign(app.state.marble, { x: 1930, y: 3650, vx: 0, vy: 0 });
      Object.assign(app.state.input.tilt, { smoothX: 0, smoothY: 0 });
      Object.assign(app.mapRuntime.state.cockroach, {
        x: 2120,
        y: 3650,
        vx: 0,
        vy: 0,
        angle: Math.PI,
        mode: "scurry",
        modeFrames: 0,
        decisionIn: 60,
        harassmentIn: config.harassmentInterval,
        pendingFrames: 0,
        contactLatched: false,
      });
      app.gameController.resume();
    }, cockroachConfig);
    await page.keyboard.down("ArrowRight");
    await page.waitForFunction(
      () => window.__cockroachApp.mapRuntime.state.cockroach.mode === "stunned",
      null,
      { timeout: 3000 },
    );
    await page.keyboard.up("ArrowRight");
    const repel = await page.evaluate(() => {
      const app = window.__cockroachApp;
      app.gameController.pause();
      const roach = app.mapRuntime.state.cockroach;
      Object.assign(app.state.marble, {
        x: roach.x - 200,
        y: roach.y,
        vx: 0,
        vy: 0,
      });
      Object.assign(app.state.input.tilt, { smoothX: 0, smoothY: 0 });
      return { x: roach.x, kick: roach.knockbackX, health: "health" in roach };
    });
    assert.ok(repel.kick > 0, "a strong hit knocks the insect away");
    assert.equal(
      repel.health,
      false,
      "repel does not introduce health/damage state",
    );
    await page.evaluate(() => window.__cockroachApp.gameController.resume());
    await page.waitForTimeout(700);
    assert.ok(
      await page.evaluate((x) => {
        const roach = window.__cockroachApp.mapRuntime.state.cockroach;
        return (
          roach.x > x + 20 && roach.mode === "retreat" && roach.harassmentIn > 0
        );
      }, repel.x),
      "the repelled cockroach disengages instead of immediately homing again",
    );

    await page.locator("#settingsToggle").click();
    await page.locator("#retryMap").click();
    assert.ok(
      await page.evaluate((interval) => {
        const app = window.__cockroachApp;
        app.gameController.pause();
        const roach = app.mapRuntime.state.cockroach;
        return (
          roach.mode === "scurry" &&
          !roach.contactLatched &&
          roach.harassmentIn > interval - 10
        );
      }, cockroachConfig.harassmentInterval),
      "Retry recreates the resting antagonist",
    );

    // Exercise every actual ant crush while the cockroach still exists.
    const completion = await page.evaluate(() => {
      const app = window.__cockroachApp;
      const roach = app.mapRuntime.state.cockroach;
      while (app.kitchenDynamics.state.ants.some((ant) => ant.alive)) {
        const ant = app.kitchenDynamics.state.ants.find((item) => item.alive);
        Object.assign(app.state.marble, { x: ant.x, y: ant.y, vx: 6, vy: 0 });
        app.kitchenDynamics.update(
          app.mapRuntime.state.activeMap,
          app.state.marble,
          { x: ant.x - 6, y: ant.y },
          1,
        );
      }
      app.state.marble.vx = 0;
      app.gameController.resume();
      return { mode: roach.mode };
    });
    assert.equal(completion.mode, "scurry");
    await page.waitForFunction(
      () =>
        window.__cockroachApp.mapRuntime.state.activeMap.variantId ===
        "living-room",
    );
    assert.equal(await page.locator(".cockroachCanvas").count(), 0);
    assert.equal(
      await page.evaluate(
        () => window.__cockroachApp.mapRuntime.state.cockroach,
      ),
      null,
    );
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
}
