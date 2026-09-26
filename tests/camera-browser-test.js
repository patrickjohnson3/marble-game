import assert from "node:assert/strict";
import { timing, tuning } from "../core/game-config.js";
import { collectBrowserErrors } from "../tools/browser-support.js";

export async function testCameraZoomVisibility(browser, baseUrl) {
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
window.__cameraApp = createApp();`,
      }),
    );
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.locator("#start").click();
    await page.keyboard.press("ArrowRight");
    await page.waitForFunction(
      () => window.__cameraApp.state.intro.released,
      null,
      { timeout: timing.introReleaseDelayMs + 5000 },
    );

    for (const viewport of [
      { width: 390, height: 844 },
      { width: 844, height: 390 },
    ]) {
      await page.setViewportSize(viewport);
      const portrait = viewport.width < viewport.height;
      for (const zoomIn of [true, false]) {
        await page.evaluate(
          ({ portrait, zoomIn, duration }) => {
            const app = window.__cameraApp;
            app.gameController.pause();
            const { marble, camera, input } = app.state;
            // Authored open floor lanes isolate camera tracking from fixture
            // impacts. Keep the antagonist away from these test runs too.
            Object.assign(marble, {
              x: portrait ? 1400 : 3900,
              y: portrait ? 3900 : 1400,
              vx: 0,
              vy: 0,
              impactSquash: 0,
            });
            Object.assign(input.tilt, { smoothX: 0, smoothY: 0 });
            Object.assign(app.mapRuntime.state.cockroach, {
              x: 600,
              y: 600,
              mode: "scurry",
              harassmentIn: 10000,
            });
            camera.scale = zoomIn ? 1 : camera.maxScale;
            camera.gestureCooldown = 0;
            app.cameraController.centerOnMarble();
            app.gameController.resume();

            const game = document.getElementById("game");
            const cx = window.innerWidth / 2;
            const cy = window.innerHeight / 2;
            const endDistance = zoomIn ? 100 * camera.maxScale : 40;
            for (const [type, pointerId, clientX] of [
              ["pointerdown", 1, cx - 50],
              ["pointerdown", 2, cx + 50],
              ["pointermove", 1, cx - endDistance / 2],
              ["pointermove", 2, cx + endDistance / 2],
              ["pointerup", 1, cx - endDistance / 2],
              ["pointerup", 2, cx + endDistance / 2],
            ]) {
              game.dispatchEvent(
                new window.PointerEvent(type, {
                  bubbles: true,
                  pointerId,
                  pointerType: "touch",
                  clientX,
                  clientY: cy,
                }),
              );
            }

            const started = performance.now();
            const startX = marble.x;
            const startY = marble.y;
            const sample = (window.__cameraSample = {
              scale: camera.scale,
              maxScale: camera.maxScale,
              cooldownFrames: 0,
              followFrames: 0,
              violations: 0,
              firstViolation: null,
              distance: 0,
              complete: false,
            });
            const marbleEl = document.getElementById("marble");
            function inspectFrame() {
              const rect = marbleEl.getBoundingClientRect();
              if (camera.gestureCooldown > 0) sample.cooldownFrames++;
              else sample.followFrames++;
              if (
                rect.left < -0.1 ||
                rect.top < -0.1 ||
                rect.right > window.innerWidth + 0.1 ||
                rect.bottom > window.innerHeight + 0.1
              ) {
                sample.violations++;
                sample.firstViolation ??= rect.toJSON();
              }
              sample.distance = Math.hypot(
                marble.x - startX,
                marble.y - startY,
              );
              if (performance.now() - started < duration) {
                requestAnimationFrame(inspectFrame);
              } else {
                sample.complete = true;
              }
            }
            requestAnimationFrame(inspectFrame);
          },
          {
            portrait,
            zoomIn,
            duration:
              (tuning.gestureCooldownFrames + 60) * timing.targetFrameMs,
          },
        );
        const key = portrait ? "ArrowRight" : "ArrowDown";
        await page.keyboard.down(key);
        await page.waitForFunction(() => window.__cameraSample.complete);
        await page.keyboard.up(key);
        const sample = await page.evaluate(() => window.__cameraSample);
        const label = `${portrait ? "portrait" : "landscape"} zoom ${zoomIn ? "in" : "out"}`;
        assert.ok(
          zoomIn
            ? sample.scale === sample.maxScale
            : sample.scale < sample.maxScale,
          `${label}: pinch must change zoom in the intended direction`,
        );
        assert.ok(sample.cooldownFrames > 0, `${label}: sampled cooldown`);
        assert.ok(sample.followFrames > 0, `${label}: sampled resumed follow`);
        assert.ok(
          sample.distance * sample.scale >
            Math.min(viewport.width, viewport.height),
          `${label}: keyboard movement must span more than the short viewport axis`,
        );
        assert.equal(
          sample.violations,
          0,
          `${label}: full rendered marble stays visible after release; ${JSON.stringify(sample.firstViolation)}`,
        );
      }
    }
    assert.deepEqual(
      errors,
      [],
      "camera workflows must not log browser errors",
    );
  } finally {
    await page.close();
  }
}
