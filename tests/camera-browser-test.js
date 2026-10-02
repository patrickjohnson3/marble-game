import assert from "node:assert/strict";
import { timing, tuning } from "../core/game-config.js";
import { collectBrowserErrors } from "../tools/browser-support.js";

export async function testCameraViewportResize(browser, baseUrl) {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
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
    await page.evaluate(() => {
      // Pause motion to isolate viewport-induced jumps from actual travel.
      window.__cameraApp.gameController.pause();
      window.__resizeViews = [];
      window.__readCameraView = () => {
        const rect = document.getElementById("marble").getBoundingClientRect();
        return {
          offsetX: (rect.left + rect.right - window.innerWidth) / 2,
          offsetY: (rect.top + rect.bottom - window.innerHeight) / 2,
          left: rect.left,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          width: window.innerWidth,
          height: window.innerHeight,
        };
      };
      // Registered after the app listener: inspect its immediate response,
      // before a later frame could hide the jump by following the marble.
      window.addEventListener("resize", () => {
        window.__resizeViews.push(window.__readCameraView());
      });
    });
    for (const scale of [1, 2.5]) {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.evaluate((scale) => {
        const { state, cameraController } = window.__cameraApp;
        Object.assign(state.marble, {
          x: 2200,
          y: 2200,
          vx: 0,
          vy: 0,
          impactSquash: 0,
        });
        state.camera.scale = scale;
        cameraController.centerOnMarble();
        state.camera.x += 40;
        state.camera.y -= 30;
        cameraController.applyTransform();
        state.camera.gestureCooldown = 30;
        window.dispatchEvent(new window.Event("resize"));
      }, scale);
      await page.evaluate(
        () => new Promise((done) => requestAnimationFrame(done)),
      );
      const before = await page.evaluate(() => window.__readCameraView());
      for (const viewport of [
        { width: 844, height: 390 },
        { width: 700, height: 500 },
        { width: 390, height: 844 },
      ]) {
        await page.evaluate(() => (window.__resizeViews.length = 0));
        await page.setViewportSize(viewport);
        await page.waitForFunction(() => window.__resizeViews.length > 0);
        const views = await page.evaluate(() => [
          ...window.__resizeViews,
          window.__readCameraView(),
        ]);
        for (const view of views) {
          assert.ok(
            Math.abs(view.offsetX - before.offsetX) < 0.1 &&
              Math.abs(view.offsetY - before.offsetY) < 0.1,
            `resize at zoom ${scale} preserves the rendered view before follow: ${JSON.stringify(view)}`,
          );
          assert.ok(
            view.left >= 0 &&
              view.top >= 0 &&
              view.right <= view.width &&
              view.bottom <= view.height,
            "the full marble is visible immediately after resize",
          );
        }
      }
    }
    assert.deepEqual(
      errors,
      [],
      "viewport changes must not log browser errors",
    );
  } finally {
    await page.close();
  }
}

export async function testCameraZoomVisibility(browser, baseUrl) {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    serviceWorkers: "block",
  });
  const errors = collectBrowserErrors(page);
  try {
    const cdp = await page.context().newCDPSession(page);
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
        const start = await page.evaluate(
          ({ portrait, zoomIn }) => {
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

            return { x: marble.x, y: marble.y, maxScale: camera.maxScale };
          },
          { portrait, zoomIn },
        );
        const cx = viewport.width / 2;
        const cy = viewport.height / 2;
        const endDistance = zoomIn ? 100 * start.maxScale : 40;
        // Native touch input exercises hit testing, capture and CSS gesture
        // arbitration, which dispatching PointerEvents directly bypasses.
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [
            { id: 1, x: cx - 50, y: cy },
            { id: 2, x: cx + 50, y: cy },
          ],
        });
        for (let step = 1; step <= 5; step++) {
          const fraction = step / 5;
          const halfDistance = (100 + (endDistance - 100) * fraction) / 2;
          await cdp.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [
              {
                id: 1,
                x: cx + 20 * fraction - halfDistance,
                y: cy + 20 * fraction,
              },
              {
                id: 2,
                x: cx + 20 * fraction + halfDistance,
                y: cy + 20 * fraction,
              },
            ],
          });
          await page.waitForTimeout(20);
        }
        const held = await page.evaluate(({ x, y }) => {
          const transform = new window.DOMMatrix(
            window.getComputedStyle(document.getElementById("world")).transform,
          );
          return {
            scale: transform.a,
            anchorX: transform.e + x * transform.a,
            anchorY: transform.f + y * transform.d,
          };
        }, start);
        const label = `${portrait ? "portrait" : "landscape"} zoom ${zoomIn ? "in" : "out"}`;
        assert.ok(
          Math.abs(
            held.scale - (zoomIn ? start.maxScale : start.maxScale * 0.4),
          ) < 0.001,
          `${label}: native pinch must reach the requested zoom`,
        );
        assert.ok(
          Math.abs(held.anchorX - (cx + 20)) < 1,
          `${label}: pan X follows the fingers`,
        );
        assert.ok(
          Math.abs(held.anchorY - (cy + 20)) < 1,
          `${label}: pan Y follows the fingers`,
        );
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchEnd",
          touchPoints: [],
        });
        await page.evaluate(
          (duration) => {
            const { marble, camera } = window.__cameraApp.state;
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
          (tuning.gestureCooldownFrames + 60) * timing.targetFrameMs,
        );
        const key = portrait ? "ArrowRight" : "ArrowDown";
        await page.keyboard.down(key);
        await page.waitForFunction(() => window.__cameraSample.complete);
        await page.keyboard.up(key);
        const sample = await page.evaluate(() => window.__cameraSample);
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
