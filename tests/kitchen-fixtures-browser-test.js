import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { timing } from "../core/game-config.js";
import { collectBrowserErrors } from "../tools/browser-support.js";

// These assertions check layering and state transitions. The optional captures
// below are real-renderer evidence for visual judgment, not pixel goldens.
function containerAppearance() {
  const app = window.__cupApp;
  const container = app.mapRuntime.state.containers[0];
  const sprite = document.querySelector(".kitchenCupSprite");
  const interior = document.querySelector(".kitchenCupInterior");
  const marble = document.getElementById("marble");
  const roachLayer = document.querySelector(".cockroachCanvas").parentElement;
  const clip = window.getComputedStyle(sprite, "::before").clipPath;
  // Test geometric occlusion using the browser's real path parser. This does
  // not depend on colors, antialiasing, or a screenshot golden.
  const path = new window.Path2D(clip.match(/"([^"]+)"/)[1]);
  const backdrop = new window.Path2D(
    window.getComputedStyle(interior).clipPath.match(/"([^"]+)"/)[1],
  );
  const context = document.createElement("canvas").getContext("2d");
  const ceramicAt = (x, y) =>
    context.isPointInPath(
      path,
      x + container.width / 2,
      y + container.height / 2,
      "evenodd",
    );
  const mouth = container.opening;
  const centerY = (mouth.top + mouth.bottom) / 2;
  const mouthRadius = (mouth.right - mouth.left) / 2;
  const backdropAt = (x, y) =>
    context.isPointInPath(
      backdrop,
      x + container.width / 2,
      y + container.height / 2,
    );
  let rearRoof = null;
  const centersVisible = [
    app.state.marble,
    app.mapRuntime.state.cockroach,
  ].every((entity) => {
    if (!entity) return true;
    const dx = entity.x - container.centerX,
      dy = entity.y - container.centerY;
    const x = container.cos * dx + container.sin * dy;
    const y = -container.sin * dx + container.cos * dy;
    const b = container.interior;
    if (Math.abs(x) < 0.01 && Math.abs(y - centerY) < entity.r * 0.1)
      rearRoof = ceramicAt(
        x,
        centerY - (entity.r + (mouth.bottom - mouth.top) / 2) / 2,
      );
    return (
      x < b.left ||
      x > b.right ||
      y < b.top ||
      y > b.bottom ||
      (!ceramicAt(x, y) && backdropAt(x, y))
    );
  });
  return {
    centersVisible,
    rearRoof,
    // A point inside the radius-24 roach at (-70, 115), clear of both walls.
    rearCornerVisible: !ceramicAt(-86, 125) && backdropAt(-86, 125),
    backdropFitsMouth: [-0.9, 0.9].every(
      (y) =>
        !backdropAt(
          mouth.left + mouthRadius * 1.9,
          centerY + (y * (mouth.bottom - mouth.top)) / 2,
        ),
    ),
    closedWalls:
      ceramicAt(container.interior.left - 1, centerY) &&
      ceramicAt(0, container.interior.top - 1) &&
      ceramicAt(0, container.interior.bottom + 1),
    clearMouth: [-0.5, 0.5].every(
      (y) =>
        !ceramicAt(
          mouth.left + mouthRadius * 1.5,
          centerY + (y * (mouth.bottom - mouth.top)) / 2,
        ),
    ),
    cupOpacity: window.getComputedStyle(sprite).opacity,
    cupArt: window.getComputedStyle(sprite, "::before").backgroundImage,
    clip,
    supported: window.CSS.supports(
      "clip-path",
      sprite.style.getPropertyValue("--cup-clip"),
    ),
    marbleOpacity: window.getComputedStyle(marble).opacity,
    belowCup:
      Number(window.getComputedStyle(marble).zIndex) <
      Number(window.getComputedStyle(sprite).zIndex),
    interiorBelowRoach:
      Number(window.getComputedStyle(interior).zIndex) <
      Number(window.getComputedStyle(roachLayer).zIndex),
    canvasCount: sprite.querySelectorAll("canvas").length,
  };
}

async function captureCupMatrix(page, directory) {
  if (directory) await mkdir(directory, { recursive: true });
  const report = [];
  for (const scale of [0.55, 1]) {
    let ordinaryMouth;
    for (const actors of ["marble", "roach", "both"]) {
      for (const [stage, x] of [
        ["outside", 225],
        ["rim", 135],
        ["inside", 0],
        ["exiting", 170],
        ...(actors === "both" ? [["rear-corner", -70]] : []),
      ]) {
        const pose = await page.evaluate(
          async ({ scale, actors, stage, x }) => {
            const a = window.__cupApp,
              c = a.mapRuntime.state.containers[0];
            a.gameController.pause();
            const world = (x, y) => ({
              x: c.centerX + c.cos * x - c.sin * y,
              y: c.centerY + c.sin * x + c.cos * y,
              vx: 0,
              vy: 0,
            });
            Object.assign(
              a.state.marble,
              world(
                stage === "rear-corner" ? -37 : actors === "roach" ? 240 : x,
                stage === "rear-corner"
                  ? -20
                  : actors === "roach"
                    ? -80
                    : actors === "both"
                      ? 10
                      : 45,
              ),
            );
            Object.assign(
              a.mapRuntime.state.cockroach,
              world(
                actors === "marble" ? -280 : x,
                stage === "rear-corner" ? 115 : actors === "both" ? 80 : 45,
              ),
              {
                mode: "stunned",
                modeFrames: 10000,
                knockbackX: 0,
                knockbackY: 0,
                angle: c.source.angle - Math.PI,
              },
            );
            Object.assign(a.state.input.tilt, {
              rawX: 0,
              rawY: 0,
              smoothX: 0,
              smoothY: 0,
            });
            a.gameController.resume();
            a.cameraController.zoomBy(scale / a.state.camera.scale);
            a.cameraController.centerOnMarble();
            a.cameraController.panBy(
              195 - (c.centerX * scale + a.state.camera.x),
              380 - (c.centerY * scale + a.state.camera.y),
            );
            await new Promise((resolve) =>
              requestAnimationFrame(() => requestAnimationFrame(resolve)),
            );
            a.gameController.pause();
            return {
              marble: { ...a.state.marble },
              roach: { ...a.mapRuntime.state.cockroach },
              camera: { ...a.state.camera },
            };
          },
          { scale, actors, stage, x },
        );
        const appearance = await page.evaluate(containerAppearance);
        assert.equal(appearance.cupOpacity, "1");
        assert.equal(appearance.marbleOpacity, "1");
        assert.equal(appearance.supported, true);
        assert.equal(appearance.belowCup, true);
        assert.equal(
          appearance.interiorBelowRoach,
          true,
          "the cavity cannot cover the real insect",
        );
        assert.equal(appearance.canvasCount, 0);
        assert.equal(
          appearance.backdropFitsMouth,
          true,
          "the interior backdrop cannot leak a rectangle past the curved mouth",
        );
        assert.equal(
          appearance.centersVisible,
          true,
          "interior occupants stay trackable",
        );
        if (stage === "rear-corner")
          assert.equal(
            appearance.rearCornerVisible,
            true,
            "another occupant must not close the cutaway over a body at the rear",
          );
        assert.equal(
          appearance.closedWalls,
          true,
          "the cutaway cannot expose a closed wall or bottom",
        );
        assert.equal(
          appearance.clearMouth,
          true,
          "the exposed mouth cannot narrow as the rear view changes",
        );
        if (stage === "inside" && actors !== "both")
          assert.equal(
            appearance.rearRoof,
            true,
            "ceramic above a single occupant must not become a full-height rectangular slot",
          );
        if (stage === "outside") {
          ordinaryMouth ??= appearance.clip;
          assert.equal(appearance.clip, ordinaryMouth);
        } else if (stage === "exiting")
          assert.equal(appearance.clip, ordinaryMouth);
        else
          assert.notEqual(
            appearance.clip,
            ordinaryMouth,
            "only an interior occupant extends the aperture",
          );
        const id = `${actors}-${stage}-${scale}`;
        if (directory)
          await page.screenshot({ path: join(directory, id + ".png") });
        report.push({ id, ...pose, appearance });
      }
    }
  }
  if (directory)
    await writeFile(
      join(directory, "matrix.json"),
      JSON.stringify(report, null, 2),
    );
}

export async function testCupEntry(
  browser,
  baseUrl,
  { screenshotDirectory } = {},
) {
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
    assert.equal(outside.canvasCount, 0);
    await page.keyboard.down("ArrowUp");
    await page.evaluate(() => window.__cupApp.cameraController.zoomBy(0.55));
    await page.waitForFunction(
      () => {
        const a = window.__cupApp,
          c = a.mapRuntime.state.containers[0],
          m = a.state.marble;
        const dx = m.x - c.centerX,
          dy = m.y - c.centerY,
          x = c.cos * dx + c.sin * dy;
        if (Math.abs(x - (c.opening.left + m.r * 0.5)) > m.r * 0.25)
          return false;
        a.gameController.pause();
        return true;
      },
      null,
      { timeout: 5000 },
    );
    await page.keyboard.up("ArrowUp");
    const partial = await page.evaluate(containerAppearance);
    assert.notEqual(partial.clip, outside.clip);
    assert.equal(partial.marbleOpacity, "1");
    assert.equal(
      partial.belowCup,
      true,
      "entry never raises the marble above ceramic",
    );
    await page.evaluate(() => window.__cupApp.gameController.resume());
    await page.keyboard.down("ArrowUp");
    await page.evaluate(() =>
      window.__cupApp.cameraController.zoomBy(1 / 0.55),
    );
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
    assert.equal(inside.supported, true);
    assert.equal(inside.interiorBelowRoach, true);
    assert.notEqual(inside.clip, partial.clip);
    await page.evaluate(() => window.__cupApp.gameController.resume());
    await page.keyboard.down("ArrowDown");
    await page.evaluate(() => window.__cupApp.cameraController.zoomBy(1.8));
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
    const exited = await page.evaluate(containerAppearance);
    assert.equal(exited.marbleOpacity, "1");
    assert.equal(
      exited.clip,
      outside.clip,
      "exit closes the temporary cutaway",
    );
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
    assert.notEqual(pursued.clip, outside.clip);
    assert.equal(pursued.interiorBelowRoach, true);
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
    await page.waitForFunction(() => window.__cupApp.state.marble.y < 1300);
    await page.evaluate(() => window.__cupApp.gameController.pause());
    const oldInterior = await page
      .locator(".kitchenCupInterior")
      .elementHandle();
    await page.evaluate(() => window.__cupApp.mapProgression.retryCurrentMap());
    assert.equal(
      await oldInterior.evaluate((element) => element.isConnected),
      false,
    );
    await page.waitForSelector(".kitchenCupInterior");
    assert.equal((await page.evaluate(containerAppearance)).clip, outside.clip);
    await captureCupMatrix(page, screenshotDirectory);
    await page.evaluate(() =>
      window.__cupApp.mapProgression.loadMap("living-room"),
    );
    assert.equal(await page.locator(".kitchenCupSprite").count(), 0);
    assert.equal(await page.locator(".kitchenCupInterior").count(), 0);
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
}
