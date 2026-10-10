import assert from "node:assert/strict";
import { timing } from "../core/game-config.js";
import { collectBrowserErrors } from "../tools/browser-support.js";

export async function testSpongeImpactFeedback(browser, baseUrl) {
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
window.__materialApp = createApp();`,
      }),
    );
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.locator("#start").click();
    await page.keyboard.press("ArrowRight");
    await page.waitForFunction(
      () => window.__materialApp.state.intro.released,
      null,
      { timeout: timing.introReleaseDelayMs + 5000 },
    );
    const layers = await page.evaluate(() => {
      const z = (selector) =>
        Number(
          window.getComputedStyle(document.querySelector(selector)).zIndex,
        );
      return {
        feedback: z("#effects canvas"),
        fixture: z(".kitchenObstacleLayer"),
        marble: z("#marble"),
      };
    });
    assert.ok(
      layers.feedback > layers.fixture && layers.feedback < layers.marble,
      "contact marks must paint on fixtures without covering the marble",
    );
    const startY = await page.evaluate(() => {
      const app = window.__materialApp;
      app.gameController.pause();
      const sponge = app.kitchenDynamics.state.sponge;
      Object.assign(app.state.marble, {
        x: sponge.collisionCenterX,
        y:
          sponge.collisionCenterY -
          sponge.hitboxH / 2 -
          app.state.marble.r -
          50,
        vx: 0,
        vy: 0,
      });
      Object.assign(app.state.input.tilt, { smoothX: 0, smoothY: 0 });
      app.state.haptics.enabled = false;
      app.mapRuntime.state.cockroach.harassmentIn = 10000;
      app.gameController.resume();
      return sponge.y;
    });
    await page.keyboard.down("ArrowDown");
    await page.waitForFunction(
      () => {
        const animation = document
          .querySelector(".kitchenSpongeSprite")
          .getAnimations()[0];
        if (!animation) return false;
        // Freeze at observation, not after another browser round trip: the
        // deliberately short reaction must not expire before assertions run.
        window.__materialApp.gameController.pause();
        animation.pause();
        return true;
      },
      null,
      { timeout: 5000 },
    );
    await page.keyboard.up("ArrowDown");
    const reaction = await page.evaluate(() => {
      const app = window.__materialApp;
      const sprite = document.querySelector(".kitchenSpongeSprite");
      const animation = sprite.getAnimations()[0];
      animation.currentTime = animation.effect.getTiming().duration / 4;
      function pose() {
        const m = new window.DOMMatrix(
          window.getComputedStyle(sprite).transform,
        );
        return {
          angle: Math.atan2(m.b, m.a),
          scaleX: Math.hypot(m.a, m.b),
          scaleY: Math.hypot(m.c, m.d),
        };
      }
      const compressed = pose();
      // A running sponge can rotate and swell during the reaction. Exercise
      // the live CSS properties rather than trusting a fake canvas/DOM log.
      sprite.style.setProperty("--fixture-angle", "1rad");
      sprite.style.setProperty("--sponge-scale", "1.04");
      const moved = pose();
      animation.finish();
      const settled = pose();
      const pushedY = app.kitchenDynamics.state.sponge.y;
      app.mapProgression.retryCurrentMap();
      return {
        compressed,
        moved,
        settled,
        pushedY,
        resetY: app.kitchenDynamics.state.sponge.y,
        oldSpriteRemoved: !sprite.isConnected,
        newAnimations: document
          .querySelector(".kitchenSpongeSprite")
          .getAnimations().length,
      };
    });
    assert.ok(reaction.compressed.scaleY < reaction.compressed.scaleX);
    assert.ok(reaction.compressed.scaleY > 0.9, "compression stays restrained");
    assert.ok(Math.abs(reaction.moved.angle - 1) < 0.00001);
    assert.ok(
      Math.abs(reaction.moved.scaleX / reaction.compressed.scaleX - 1.04) <
        0.00001,
    );
    assert.ok(
      Math.abs(reaction.moved.scaleY / reaction.compressed.scaleY - 1.04) <
        0.00001,
    );
    assert.ok(reaction.moved.scaleY < reaction.moved.scaleX);
    assert.ok(Math.abs(reaction.settled.scaleY - 1.04) < 0.00001);
    assert.ok(Math.abs(reaction.settled.scaleX - 1.04) < 0.00001);
    assert.ok(reaction.pushedY > startY, "keyboard contact moves the sponge");
    assert.equal(reaction.oldSpriteRemoved, true);
    assert.equal(reaction.newAnimations, 0, "Retry has no stale compression");
    assert.equal(reaction.resetY, startY, "Retry restores the sponge pose");
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
}
