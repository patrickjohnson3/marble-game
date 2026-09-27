import assert from "node:assert/strict";
import { cockroachConfig, timing } from "../core/game-config.js";
import { ELLIPTICAL_SURFACE_SHAPES } from "../core/map-elements.js";
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
    assert.equal(await page.locator("#nextRoom").isHidden(), true);

    async function sampleScurry(inGoo) {
      const origin = await page.evaluate(
        ({ inGoo, shape }) => {
          const app = window.__cockroachApp;
          app.gameController.pause();
          const patch = app.mapRuntime.state.terrainByType.gooPatch.elements[0];
          const x = inGoo ? patch.x + patch.w * shape.centerX : patch.x - 200;
          const y = patch.y + patch.h * shape.centerY;
          Object.assign(app.state.marble, { x: 400, y: 500, vx: 0, vy: 0 });
          Object.assign(app.state.input.tilt, { smoothX: 0, smoothY: 0 });
          // Keep the same heading briefly so this compares material behavior
          // through the live physics loop, without steering decisions or contact.
          Object.assign(app.mapRuntime.state.cockroach, {
            x,
            y,
            vx: 0,
            vy: 0,
            angle: Math.PI,
            mode: "scurry",
            modeFrames: 0,
            harassmentIn: 1000,
            decisionIn: 1000,
            pendingFrames: 0,
            knockbackX: 0,
            knockbackY: 0,
            contactLatched: false,
            engaged: false,
            attackRecoveryFrames: 0,
          });
          app.gameController.resume();
          return {
            x,
            outsideX: patch.x - app.mapRuntime.state.cockroach.r - 10,
          };
        },
        { inGoo, shape: ELLIPTICAL_SURFACE_SHAPES.gooPatch },
      );
      await page.waitForFunction(
        () =>
          window.__cockroachApp.mapRuntime.state.cockroach.harassmentIn <= 988,
      );
      return page.evaluate((origin) => {
        const app = window.__cockroachApp;
        app.gameController.pause();
        const roach = app.mapRuntime.state.cockroach;
        return {
          distance: origin.x - roach.x,
          frames: 1000 - roach.harassmentIn,
          outsideX: origin.outsideX,
        };
      }, origin);
    }

    const floorRun = await sampleScurry(false);
    const gooRun = await sampleScurry(true);
    const floorSpeed = floorRun.distance / floorRun.frames;
    const gooSpeed = gooRun.distance / gooRun.frames;
    assert.ok(
      gooSpeed > 0 && gooSpeed < floorSpeed,
      `real kitchen goo must slow scurrying without trapping: floor=${floorSpeed}, goo=${gooSpeed}`,
    );
    await page.evaluate(() => window.__cockroachApp.gameController.resume());
    await page.waitForFunction(
      (outsideX) =>
        window.__cockroachApp.mapRuntime.state.cockroach.x < outsideX,
      gooRun.outsideX,
      { timeout: 5000 },
    );
    const escapedSpeed = await page.evaluate(() => {
      const app = window.__cockroachApp;
      app.gameController.pause();
      const roach = app.mapRuntime.state.cockroach;
      return Math.hypot(roach.vx, roach.vy);
    });
    assert.ok(
      Math.abs(escapedSpeed - floorSpeed) < 1e-8,
      "leaving the actual goo boundary must restore normal scurry speed",
    );

    // The app must supply live kitchen food to the physics-owned roach. Place
    // it facing away from a real cereal cluster and watch it return on its own.
    await page.evaluate(() => {
      const app = window.__cockroachApp;
      app.gameController.pause();
      const food = app.kitchenDynamics.state.cheerios.find(
        (item) => item.active && item.kind === "cheerio",
      );
      Object.assign(app.state.marble, { x: 400, y: 500, vx: 0, vy: 0 });
      Object.assign(app.state.input.tilt, { smoothX: 0, smoothY: 0 });
      Object.assign(app.mapRuntime.state.cockroach, {
        x: food.originX + food.pushX - 350,
        y: food.originY + food.pushY,
        angle: Math.PI,
        mode: "scurry",
        harassmentIn: 600,
        decisionIn: 0,
      });
      app.gameController.resume();
    });
    await page.waitForFunction(
      () => {
        const app = window.__cockroachApp;
        const roach = app.mapRuntime.state.cockroach;
        return (
          roach.mode === "scurry" &&
          app.kitchenDynamics.state.cheerios.some(
            (food) =>
              food.active &&
              food.kind === "cheerio" &&
              Math.hypot(
                food.originX + food.pushX - roach.x,
                food.originY + food.pushY - roach.y,
              ) < 140,
          )
        );
      },
      null,
      { timeout: 5000 },
    );

    // Let a ready, scurrying insect acquire from beyond the old 900-unit
    // range and reach the marble using actual game-loop movement.
    await page.evaluate(() => {
      const app = window.__cockroachApp;
      app.gameController.pause();
      Object.assign(app.state.marble, { x: 2200, y: 600, vx: 0, vy: 0 });
      Object.assign(app.state.input.tilt, { smoothX: 0, smoothY: 0 });
      Object.assign(app.mapRuntime.state.cockroach, {
        x: 3500,
        y: 600,
        vx: 0,
        vy: 0,
        angle: Math.PI,
        mode: "scurry",
        modeFrames: 0,
        harassmentIn: 1,
        decisionIn: 0,
        pendingFrames: 0,
        contactLatched: false,
        engaged: false,
        attackRecoveryFrames: 0,
      });
      app.cameraController.centerOnMarble();
      app.gameController.resume();
    });
    await page.waitForFunction(
      () =>
        window.__cockroachApp.mapRuntime.state.cockroach.engaged &&
        window.__cockroachApp.mapRuntime.state.cockroach.attackRecoveryFrames >
          0,
    );
    const attack = await page.evaluate(() => {
      const app = window.__cockroachApp;
      app.gameController.pause();
      return {
        speed: Math.hypot(app.state.marble.vx, app.state.marble.vy),
        mode: app.mapRuntime.state.cockroach.mode,
        x: app.state.marble.x,
        squash: app.state.marble.impactSquash,
      };
    });
    assert.ok(attack.speed > 8, "contact delivers a strong outward kick");
    assert.equal(attack.mode, "harass", "a hit does not trigger retreat");
    assert.ok(attack.squash > 0);

    await page.evaluate(() => window.__cockroachApp.gameController.resume());
    const repeated = await page.evaluate(async () => {
      const app = window.__cockroachApp;
      let previousRecovery =
        app.mapRuntime.state.cockroach.attackRecoveryFrames;
      const deadline = performance.now() + 4000;
      while (performance.now() < deadline) {
        await new Promise(requestAnimationFrame);
        const roach = app.mapRuntime.state.cockroach;
        if (roach.attackRecoveryFrames > previousRecovery) {
          return {
            mode: roach.mode,
            x: app.state.marble.x,
            engaged: roach.engaged,
          };
        }
        previousRecovery = roach.attackRecoveryFrames;
      }
      return null;
    });
    assert.ok(repeated, "after real separation the roach strikes again");
    assert.equal(repeated.mode, "harass");
    assert.equal(repeated.engaged, true);
    assert.ok(
      repeated.x < attack.x - 60,
      "hits visibly push the marble backward",
    );

    // Escape through real input, then verify the encounter ends and food
    // roaming resumes instead of immediately starting another attack.
    await page.keyboard.down("ArrowLeft");
    await page.waitForFunction(
      () => {
        const roach = window.__cockroachApp.mapRuntime.state.cockroach;
        return (
          !roach.engaged && roach.mode === "scurry" && roach.harassmentIn > 0
        );
      },
      null,
      { timeout: 6000 },
    );
    await page.keyboard.up("ArrowLeft");
    await page.evaluate(() => window.__cockroachApp.gameController.pause());

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
        engaged: false,
        attackRecoveryFrames: 0,
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
          !roach.engaged &&
          roach.attackRecoveryFrames === 0 &&
          roach.harassmentIn > interval - 10
        );
      }, cockroachConfig.harassmentInterval),
      "Retry recreates the resting antagonist",
    );

    async function crushRemainingAnts() {
      // Position on each real ant; use the actual dynamics/crush path rather
      // than setting objective progress or living-ant flags in the test.
      await page.evaluate(() => {
        const app = window.__cockroachApp;
        app.gameController.pause();
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
        app.cameraController.centerOnMarble();
        app.gameController.resume();
      });
      await page.waitForTimeout(150);
    }

    await crushRemainingAnts();
    assert.equal(
      await page.evaluate(
        () => window.__cockroachApp.mapRuntime.state.activeMap.variantId,
      ),
      "kitchen-floor",
      "the final ant must leave the player in the kitchen until departure",
    );
    assert.equal(
      await page.evaluate(() =>
        window.__cockroachApp.kitchenDynamics.state.ants.some(
          (ant) => ant.alive,
        ),
      ),
      false,
    );
    assert.equal(await page.locator("#nextRoom").isVisible(), true);
    assert.match(await page.locator("#nextRoom").textContent(), /Next room/);
    assert.equal(await page.locator(".cockroachCanvas").count(), 1);

    const lingering = await page.evaluate(() => {
      const app = window.__cockroachApp;
      // Give the player a clear, repeatable lane for post-objective input.
      Object.assign(app.state.marble, { x: 400, y: 500, vx: 0, vy: 0 });
      app.cameraController.centerOnMarble();
      return {
        x: app.state.marble.x,
        gait: app.mapRuntime.state.cockroach.gait,
      };
    });
    await page.keyboard.down("ArrowRight");
    await page.waitForFunction((before) => {
      const app = window.__cockroachApp;
      return (
        app.state.marble.x > before.x + 10 &&
        app.mapRuntime.state.cockroach.gait > before.gait
      );
    }, lingering);
    await page.keyboard.up("ArrowRight");
    assert.equal(await page.locator("#nextRoom").isVisible(), true);

    await page.locator("#settingsToggle").click();
    await page.locator("#retryMap").click();
    assert.equal(await page.locator("#nextRoom").isHidden(), true);
    assert.ok(
      await page.evaluate(() =>
        window.__cockroachApp.kitchenDynamics.state.ants.every(
          (ant) => ant.alive,
        ),
      ),
      "Retry must restore the ants and remove permission to depart",
    );
    assert.match(
      await page.locator("#objectiveStatus").textContent(),
      /Kill all ants/,
    );

    await crushRemainingAnts();
    assert.equal(await page.locator("#nextRoom").isVisible(), true);
    await page.evaluate(() => {
      const app = window.__cockroachApp;
      window.__kitchenDepartures = 0;
      const advance = app.mapProgression.advanceToNextMap;
      app.mapProgression.advanceToNextMap = () => {
        window.__kitchenDepartures++;
        return advance();
      };
    });
    await page.locator("#nextRoom").dblclick();
    await page.waitForFunction(
      () =>
        window.__cockroachApp.mapRuntime.state.activeMap.variantId ===
        "living-room",
    );
    assert.equal(await page.evaluate(() => window.__kitchenDepartures), 1);
    assert.equal(await page.locator("#nextRoom").isHidden(), true);
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
