import { kitchenPoint } from "../maps/kitchen-layout.js";
import { resolvedMapConfig } from "../core/map-config.js";
import assert from "node:assert/strict";
import {
  closeServer,
  collectBrowserErrors,
  createStaticServer,
  launchBrowser,
  listen,
} from "../tools/browser-support.js";
import { timing, tuning } from "../core/game-config.js";
import { copy } from "../core/copy.js";
import { prepareMapCapture } from "../tools/render-map.js";
import { testCockroachEncounter } from "./cockroach-browser-test.js";
import { testCameraZoomVisibility } from "./camera-browser-test.js";
import { testMapSwitching } from "./map-switch-browser-test.js";
import {
  testMotionPermissionRecovery,
  testSettingsModality,
  testStartupRecovery,
} from "./mobile-workflows-browser-test.js";

async function marbleTransform(page) {
  return page.locator("#marble").evaluate((element) => element.style.transform);
}

async function marblePosition(page) {
  return page.locator("#marble").evaluate((element) => {
    const position = element.style.transform.match(
      /^translate\(([-+\d.e]+)px,\s*([-+\d.e]+)px\)/,
    );
    return { x: Number(position[1]), y: Number(position[2]) };
  });
}

async function dispatchOrientation(page, { beta, gamma, count = 1 }) {
  await page.evaluate(
    ({ beta: eventBeta, gamma: eventGamma, count: eventCount }) => {
      for (let index = 0; index < eventCount; index++) {
        const event = new window.Event("deviceorientation");
        Object.defineProperties(event, {
          beta: { value: eventBeta },
          gamma: { value: eventGamma },
        });
        window.dispatchEvent(event);
      }
    },
    { beta, gamma, count },
  );
}

async function testInterruptionWorkflow(browser, baseUrl) {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    serviceWorkers: "block",
  });
  const browserErrors = collectBrowserErrors(page);
  try {
    await page.route("**/boot.js*", (route) =>
      route.fulfill({
        contentType: "text/javascript",
        body: `import { createApp } from "./app.js";
window.__mapPreview = createApp();`,
      }),
    );
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.locator("#start").click();
    await dispatchOrientation(page, {
      beta: 13,
      gamma: 7,
      count: tuning.neutralSampleCount,
    });
    await page.waitForFunction(
      () => window.__mapPreview.state.intro.released,
      null,
      { timeout: timing.introReleaseDelayMs + 3000 },
    );

    await page.keyboard.down("ArrowRight");
    await page.keyboard.down("ArrowLeft");
    await page.keyboard.up("ArrowLeft");
    assert.equal(
      await page.evaluate(() => window.__mapPreview.state.input.keyboard.x),
      1,
      "releasing the opposing key must retain the still-held Right input",
    );
    await page.keyboard.down("d");
    await page.keyboard.up("ArrowRight");
    assert.equal(
      await page.evaluate(() => window.__mapPreview.state.input.keyboard.x),
      1,
      "releasing one alias must retain another held key for that direction",
    );
    await page.keyboard.down("ArrowUp");
    await page.evaluate(() => window.dispatchEvent(new window.Event("blur")));
    assert.deepEqual(
      await page.evaluate(() => {
        const { x, y } = window.__mapPreview.state.input.keyboard;
        return { x, y };
      }),
      { x: 0, y: 0 },
      "focus loss must clear both axes even when keyup is missed",
    );
    await page.keyboard.up("d");
    await page.keyboard.up("ArrowUp");

    // Headless Chrome keeps background tabs visible, and its lifecycle CDP
    // command freezes without hiding. Exercise the real visibility listener
    // with an explicit synthetic state; this does not test OS app switching.
    await page.evaluate(() => {
      window.__testVisibility = "visible";
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => window.__testVisibility,
      });
      window.__setTestVisibility = (visibility) => {
        window.__testVisibility = visibility;
        document.dispatchEvent(new window.Event("visibilitychange"));
      };
      window.__encounterSnapshot = () => {
        const { state, mapRuntime, kitchenDynamics } = window.__mapPreview;
        return window.structuredClone({
          marble: state.marble,
          calibration: state.input.calibration,
          neutral: [state.input.tilt.neutralX, state.input.tilt.neutralY],
          ants: kitchenDynamics.state.ants,
          cockroach: mapRuntime.state.cockroach,
          completed: mapRuntime.state.goalCompleted,
          variant: mapRuntime.state.activeMap.variantId,
        });
      };
    });
    await page.keyboard.down("ArrowRight");
    const interrupted = await page.evaluate(() => {
      const before = window.__encounterSnapshot();
      window.__setTestVisibility("hidden");
      return { before, paused: window.__mapPreview.state.game.paused };
    });
    assert.equal(
      interrupted.paused,
      true,
      "hiding an active game must pause it",
    );
    await page.keyboard.up("ArrowRight");
    await page.waitForTimeout(150);
    assert.deepEqual(
      await page.evaluate(() => window.__encounterSnapshot()),
      interrupted.before,
      "a hidden game must preserve encounter, motion and calibration state",
    );
    await page.evaluate(() => window.__setTestVisibility("visible"));
    await page.waitForTimeout(150);
    assert.equal(
      await page.evaluate(() => window.__mapPreview.state.game.paused),
      true,
      "returning to the page must wait for explicit Resume",
    );
    assert.deepEqual(
      await page.evaluate(() => window.__encounterSnapshot()),
      interrupted.before,
      "returning must not reset or advance the interrupted encounter",
    );
    assert.equal(await page.locator("#resumeGame").isVisible(), true);
    assert.equal(await page.locator("#neutral").isVisible(), true);
    await page.locator("#resumeGame").click();
    assert.equal(
      await page.evaluate(() => window.__mapPreview.state.game.paused),
      false,
      "Resume must resume the interrupted game",
    );
    await page.keyboard.down("ArrowLeft");
    await page.keyboard.up("ArrowLeft");
    assert.equal(
      await page.evaluate(() => window.__mapPreview.state.input.keyboard.x),
      0,
      "resume must not restore a key held before the interruption",
    );

    await page.locator("#settingsToggle").click();
    await page.locator("#diagnosticsSettingsTitle").click();
    await page.locator("#mapSelect").selectOption("living-room");
    const settingsPause = await page.evaluate(() => {
      const before = window.__encounterSnapshot();
      window.__setTestVisibility("hidden");
      window.__setTestVisibility("visible");
      return before;
    });
    await page.waitForTimeout(150);
    assert.equal(
      await page.locator("#mapSelect").inputValue(),
      "living-room",
      "interruption must preserve an unconfirmed map selection in open settings",
    );
    assert.deepEqual(
      await page.evaluate(() => window.__encounterSnapshot()),
      settingsPause,
      "an existing settings pause must survive a visibility round trip",
    );
    assert.equal(
      await page.evaluate(() => window.__mapPreview.state.game.paused),
      true,
    );
    await page.locator("#resumeGame").click();
    assert.equal(
      await page.evaluate(() => window.__mapPreview.state.game.paused),
      false,
      "visibility changes must preserve the settings dialog's resume ownership",
    );
    assert.deepEqual(
      browserErrors,
      [],
      "interruption flow must not log errors",
    );
  } finally {
    await page.close();
  }
}

async function testSyntheticOrientationWorkflow(browser, baseUrl) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const browserErrors = collectBrowserErrors(page);

  try {
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.waitForFunction(() => window.__marbleAppBooted === true);
    await page.locator("#start").click();

    await dispatchOrientation(page, {
      beta: 0,
      gamma: 0,
      count: tuning.neutralSampleCount,
    });
    await page.waitForFunction(
      (expectedHint) =>
        document.getElementById("hint").textContent === expectedHint,
      copy.hints.neutralSet,
    );
    const firstCluster = resolvedMapConfig.clusters[0];
    await page.waitForFunction(
      ({ x, y }) => {
        const canvas = document.querySelector(".kitchenDynamicCanvas");
        const context = canvas?.getContext("2d");
        if (!canvas || !context) return false;

        const sampleSize = 80;
        const pixels = context.getImageData(
          Math.floor(canvas.width * x - sampleSize / 2),
          Math.floor(canvas.height * y - sampleSize / 2),
          sampleSize,
          sampleSize,
        ).data;
        for (let index = 3; index < pixels.length; index += 4) {
          if (pixels[index] > 0) return true;
        }
        return false;
      },
      kitchenPoint(firstCluster, firstCluster.cheerios[0]),
    );

    const neutralTransform = await marbleTransform(page);
    await dispatchOrientation(page, { beta: 0, gamma: 24 });
    await page.waitForFunction(
      (before) => document.getElementById("marble").style.transform !== before,
      neutralTransform,
    );

    assert.deepEqual(
      browserErrors,
      [],
      "synthetic orientation workflow must not log browser errors",
    );
  } finally {
    await page.close();
  }
}

async function testSyntheticPinchWorkflow(page) {
  const pinch = await page.evaluate(() => {
    const game = document.getElementById("game");
    const world = document.getElementById("world");
    const before = new window.DOMMatrix(
      window.getComputedStyle(world).transform,
    );
    const worldPoint = {
      x: (180 - before.e) / before.a,
      y: (300 - before.f) / before.d,
    };
    for (const [type, pointerId, clientX, clientY] of [
      ["pointerdown", 1, 100, 300],
      ["pointerdown", 2, 260, 300],
      ["pointermove", 1, 60, 320],
      ["pointermove", 2, 320, 320],
    ]) {
      game.dispatchEvent(
        new window.PointerEvent(type, {
          bubbles: true,
          pointerId,
          pointerType: "touch",
          clientX,
          clientY,
        }),
      );
    }
    const after = new window.DOMMatrix(
      window.getComputedStyle(world).transform,
    );
    return {
      oldScale: before.a,
      scale: after.a,
      anchorX: after.e + worldPoint.x * after.a,
      anchorY: after.f + worldPoint.y * after.d,
      transform: world.style.transform,
    };
  });
  assert.ok(pinch.scale > pinch.oldScale, "spreading fingers must zoom in");
  assert.ok(Math.abs(pinch.anchorX - 190) < 0.1);
  assert.ok(Math.abs(pinch.anchorY - 320) < 0.1);

  // Keep both fingers still longer than the follow cooldown used to allow.
  await page.waitForTimeout(
    tuning.gestureCooldownFrames * timing.targetFrameMs * 2,
  );
  assert.equal(
    await page.locator("#world").evaluate((world) => world.style.transform),
    pinch.transform,
    "camera following must stay suspended while both fingers remain down",
  );

  await page.evaluate(() => {
    const game = document.getElementById("game");
    for (const pointerId of [1, 2]) {
      game.dispatchEvent(
        new window.PointerEvent("pointerup", {
          bubbles: true,
          pointerId,
          pointerType: "touch",
        }),
      );
    }
  });
  await page.waitForFunction(
    (before) => document.getElementById("world").style.transform !== before,
    pinch.transform,
    { timeout: tuning.gestureCooldownFrames * timing.targetFrameMs + 3000 },
  );
}

async function testSyntheticLateSensorRecovery(browser, baseUrl) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const browserErrors = collectBrowserErrors(page);

  try {
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.waitForFunction(() => window.__marbleAppBooted === true);
    await page.locator("#start").click();
    // Synthetic events exercise browser wiring, not physical sensor APIs.
    await page.evaluate(() => {
      const event = new window.Event("devicemotion");
      Object.defineProperty(event, "accelerationIncludingGravity", {
        value: { x: null, y: null, z: null },
      });
      window.dispatchEvent(event);
    });
    await page.waitForFunction(
      (message) =>
        document.getElementById("gameStatus").textContent === message,
      copy.hints.noMotionSensor,
      { timeout: timing.sensorFallbackMs + 3000 },
    );

    const beforeSensor = await marblePosition(page);
    await dispatchOrientation(page, { beta: 30, gamma: 12 });
    assert.equal(
      await page.locator("#gameStatus").textContent(),
      copy.hints.calibrating,
      "a late sensor needs fresh neutral samples after keyboard fallback",
    );
    await page.waitForTimeout(250);
    assert.deepEqual(
      await marblePosition(page),
      beforeSensor,
      "the normal holding angle must not steer during calibration",
    );

    await dispatchOrientation(page, {
      beta: 30,
      gamma: 12,
      count: tuning.neutralSampleCount - 1,
    });
    await page.waitForFunction(
      (message) => document.getElementById("hint").textContent === message,
      copy.hints.neutralSet,
    );
    await page.waitForTimeout(250);
    assert.deepEqual(
      await marblePosition(page),
      beforeSensor,
      "a newly calibrated holding angle must remain neutral",
    );
    assert.equal(
      await page
        .locator("#world")
        .evaluate((world) => world.classList.contains("map-open")),
      false,
      "the intro pen must stay closed until its countdown finishes",
    );
    await page.waitForFunction(
      () => document.getElementById("world").classList.contains("map-open"),
      null,
      { timeout: timing.introReleaseDelayMs + 3000 },
    );

    await testSyntheticPinchWorkflow(page);
    await dispatchOrientation(page, { beta: 30, gamma: 30 });
    await page.waitForFunction((before) => {
      const position = document
        .getElementById("marble")
        .style.transform.match(/^translate\(([-+\d.e]+)px,\s*([-+\d.e]+)px\)/);
      return Number(position[1]) > before.x + 1;
    }, beforeSensor);
    assert.deepEqual(
      browserErrors,
      [],
      "sensor recovery and pinch workflows must not log browser errors",
    );
  } finally {
    await page.close();
  }
}

async function testShortViewportSettingsRemainReachable(browser, baseUrl) {
  const page = await browser.newPage({ viewport: { width: 390, height: 667 } });

  try {
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.waitForFunction(() => window.__marbleAppBooted === true);
    await page.locator("#settingsToggle").click();

    const scrollState = await page
      .locator("#settingsOverlay")
      .evaluate((overlay) => ({
        clientHeight: overlay.clientHeight,
        overflowY: window.getComputedStyle(overlay).overflowY,
        scrollHeight: overlay.scrollHeight,
      }));
    assert.equal(scrollState.overflowY, "auto");
    assert.equal(
      scrollState.scrollHeight > scrollState.clientHeight,
      true,
      "short settings content should use the overlay scroll container",
    );

    await page.locator("#resumeGame").scrollIntoViewIfNeeded();
    assert.equal(
      await page.locator("#resumeGame").isVisible(),
      true,
      "Resume must remain reachable on a short mobile viewport",
    );
  } finally {
    await page.close();
  }
}

async function testLivingRoomMouseEncounter(browser, baseUrl) {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    serviceWorkers: "block",
  });
  const browserErrors = collectBrowserErrors(page);
  try {
    await page.route("**/boot.js*", (route) =>
      route.fulfill({
        contentType: "text/javascript",
        body: `import { createApp } from "./app.js";
import { baseMapConfig } from "./core/map-config.js";
import { resolveMapVariantConfig } from "./core/map-variants.js";
window.__mapPreview = createApp({
  initialMap: resolveMapVariantConfig(baseMapConfig, "living-room"),
});`,
      }),
    );
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.locator("#start").click();
    await page.keyboard.press("ArrowRight");
    await page.waitForFunction(
      () => window.__mapPreview.state.intro.released,
      null,
      { timeout: timing.introReleaseDelayMs + 5000 },
    );
    const floorMaterial = await page
      .locator(".livingRoomSurface")
      .evaluate(async (floor) => {
        const style = window.getComputedStyle(floor);
        const url = style.backgroundImage.match(/url\(["']?(.*?)["']?\)/)?.[1];
        const image = new window.Image();
        image.src = url;
        await image.decode();
        return {
          url,
          loaded: image.naturalWidth > 0,
          inWorld: Boolean(floor.closest("#world")),
          attachment: style.backgroundAttachment,
        };
      });
    assert.match(floorMaterial.url, /oak-floor\.webp/);
    assert.ok(
      floorMaterial.loaded,
      "wood material must decode in the real browser",
    );
    assert.ok(
      floorMaterial.inWorld,
      "floor must move with the world, not the viewport",
    );
    assert.notEqual(floorMaterial.attachment, "fixed");
    assert.equal(await page.locator(".mouseCanvas").count(), 1);
    assert.match(
      await page.locator("#objectiveStatus").textContent(),
      /Defeat the mouse/,
    );
    assert.equal(
      await page.locator("#goalIndicatorSetting").isChecked(),
      false,
    );
    await page.waitForFunction(() => {
      const { state, mapRuntime } = window.__mapPreview;
      const arrow = document.getElementById("goalIndicator");
      const mouse = mapRuntime.state.mouse;
      const bearing = Math.atan2(
        mouse.y - state.marble.y,
        mouse.x - state.marble.x,
      );
      return (
        arrow.classList.contains("show") &&
        arrow.dataset.label === "Mouse" &&
        Math.abs(
          parseFloat(arrow.style.getPropertyValue("--goal-indicator-angle")) -
            bearing,
        ) < 0.001
      );
    });
    await page.evaluate(() => {
      const { state, mapRuntime } = window.__mapPreview;
      const mouse = mapRuntime.state.mouse;
      Object.assign(state.marble, {
        x: mouse.x + 180,
        y: mouse.y,
        vx: 0,
        vy: 0,
      });
    });
    await page.waitForFunction(
      () =>
        !document.getElementById("goalIndicator").classList.contains("show"),
    );

    await page.evaluate(() => {
      const app = window.__mapPreview;
      const exit = app.mapRuntime.state.activeMap.regions.find(
        (region) => region.id === "exit-door",
      );
      Object.assign(app.state.marble, {
        x: exit.x + exit.w / 2,
        y: exit.y + exit.h / 2,
        vx: 0,
        vy: 0,
      });
    });
    await page.waitForTimeout(150);
    assert.equal(
      await page.evaluate(
        () => window.__mapPreview.mapRuntime.state.activeMap.variantId,
      ),
      "living-room",
      "entering the exit cannot skip a living mouse",
    );
    assert.match(await page.locator("#goal").textContent(), /Defeat mouse/);
    assert.equal(
      await page.locator("#goalIndicator.show").count(),
      1,
      "moving away from the mouse restores its locator",
    );
    await page.evaluate(() => window.__mapPreview.gameController.pause());

    async function keyboardRunUp() {
      // Position the actors on clear wood to repeat an attack without turning
      // this smoke test into an autonomous hunter. Velocity starts at zero;
      // real keyboard input, AI, physics and collision code deliver each hit.
      const healthBefore = await page.evaluate(() => {
        const app = window.__mapPreview;
        const mouse = app.mapRuntime.state.mouse;
        Object.assign(mouse, { x: 2300, y: 3650, vx: 0, vy: 0 });
        Object.assign(app.state.marble, {
          // Keep the same free run-up as body size changes.
          x: mouse.x - mouse.r - app.state.marble.r - 107,
          y: 3650,
          vx: 0,
          vy: 0,
        });
        app.cameraController.centerOnMarble();
        app.gameController.resume();
        return mouse.health;
      });
      await page.keyboard.down("ArrowRight");
      await page.waitForFunction(
        (before) => window.__mapPreview.mapRuntime.state.mouse.health < before,
        healthBefore,
        { timeout: 3000 },
      );
      await page.keyboard.up("ArrowRight");
      return page.evaluate(() => {
        const app = window.__mapPreview;
        app.gameController.pause();
        const mouse = app.mapRuntime.state.mouse;
        return {
          health: mouse.health,
          maxHealth: mouse.maxHealth,
          fleeFrames: mouse.fleeFrames,
          gait: mouse.gait,
        };
      });
    }

    const firstHit = await keyboardRunUp();
    assert.ok(firstHit.health > 0 && firstHit.health < firstHit.maxHealth);
    assert.ok(firstHit.fleeFrames > 0, "a real keyboard impact starts flight");
    await page.evaluate(() => {
      const app = window.__mapPreview;
      // Remove the continuing threat; only the hit reaction should persist.
      Object.assign(app.state.marble, { x: 300, y: 500, vx: 0, vy: 0 });
      app.gameController.resume();
    });
    await page.waitForFunction(() => {
      const mouse = window.__mapPreview.mapRuntime.state.mouse;
      return mouse.fleeFrames > 0 && mouse.fleeFrames < 90;
    });
    assert.ok(
      await page.evaluate(
        (gait) => window.__mapPreview.mapRuntime.state.mouse.gait > gait + 100,
        firstHit.gait,
      ),
      "the mouse keeps fleeing after the marble stops threatening it",
    );
    await page.waitForFunction(
      () => window.__mapPreview.mapRuntime.state.mouse.fleeFrames === 0,
      null,
      { timeout: 5000 },
    );
    assert.equal(
      await page.evaluate(() => {
        const app = window.__mapPreview;
        app.gameController.pause();
        return app.mapRuntime.state.mouse.health;
      }),
      firstHit.health,
      "flight expires without another attack or damage",
    );
    const retryHit = await keyboardRunUp();
    assert.ok(retryHit.fleeFrames > 0, "Retry exercises an active escape");
    await page.evaluate(() => {
      window.__previousMouse = window.__mapPreview.mapRuntime.state.mouse;
      window.__mapPreview.gameController.resume();
    });
    await page.locator("#settingsToggle").click();
    await page.locator("#retryMap").click();
    assert.deepEqual(
      await page.evaluate(() => {
        const app = window.__mapPreview;
        app.gameController.pause();
        const mouse = app.mapRuntime.state.mouse;
        return {
          fresh: mouse !== window.__previousMouse,
          fullHealth: mouse.health === mouse.maxHealth,
          contactLatched: mouse.contactLatched,
          fleeFrames: mouse.fleeFrames,
          completed: app.mapRuntime.state.goalCompleted,
        };
      }),
      {
        fresh: true,
        fullHealth: true,
        contactLatched: false,
        fleeFrames: 0,
        completed: false,
      },
      "Retry must restore a fresh enemy and locked objective",
    );

    let health = firstHit.maxHealth;
    for (let hit = 0; hit < 8 && health > 0; hit++) {
      ({ health } = await keyboardRunUp());
    }
    assert.equal(health, 0, "separated keyboard run-ups must defeat the mouse");
    assert.equal(
      await page.evaluate(
        () => window.__mapPreview.mapRuntime.state.mouse.fleeFrames,
      ),
      0,
      "defeat stops any remaining flight",
    );
    const defeated = await page.evaluate(() => {
      const app = window.__mapPreview;
      const mouse = app.mapRuntime.state.mouse;
      app.gameController.resume();
      return { x: mouse.x, y: mouse.y, gait: mouse.gait };
    });
    await page.waitForTimeout(250);
    assert.deepEqual(
      await page.evaluate(() => {
        const mouse = window.__mapPreview.mapRuntime.state.mouse;
        return { x: mouse.x, y: mouse.y, gait: mouse.gait };
      }),
      defeated,
      "defeated mouse must stop walking and animating",
    );
    assert.match(
      await page.locator("#objectiveStatus").textContent(),
      /Mouse defeated.*Reach the exit/,
    );
    assert.match(await page.locator("#goal").textContent(), /Next room/);
    assert.equal(
      await page.locator("#goalIndicator.show").count(),
      0,
      "the automatic mouse cue ends at defeat without enabling optional exit guidance",
    );

    await page.evaluate(() => {
      const app = window.__mapPreview;
      window.__mouseAdvanceCalls = 0;
      const advance = app.mapProgression.advanceToNextMap;
      app.mapProgression.advanceToNextMap = () => {
        window.__mouseAdvanceCalls++;
        return advance();
      };
      const exit = app.mapRuntime.state.activeMap.regions.find(
        (region) => region.id === "exit-door",
      );
      Object.assign(app.state.marble, {
        x: exit.x + exit.w / 2,
        y: exit.y + exit.h / 2,
        vx: 0,
        vy: 0,
      });
    });
    await page.waitForFunction(
      () =>
        window.__mapPreview.mapRuntime.state.activeMap.variantId ===
        "parking-lot",
    );
    await page.waitForTimeout(150);
    assert.equal(await page.evaluate(() => window.__mouseAdvanceCalls), 1);
    assert.equal(
      await page.evaluate(() => window.__mapPreview.mapRuntime.state.mouse),
      null,
      "mouse state must not leak into the next map",
    );
    assert.equal(await page.locator(".mouseCanvas").count(), 0);
    assert.equal(await page.locator("#goalIndicator.show").count(), 0);
    assert.deepEqual(browserErrors, []);
  } finally {
    await page.close();
  }
}

async function testPreviewRejectsCompletedMap(browser, baseUrl) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const browserErrors = collectBrowserErrors(page);
  try {
    // An author can accidentally put spawn in the exit. Let the real game
    // complete that map during startup, rather than faking a progression flag.
    await page.route("**/boot.js*", (route) =>
      route.fulfill({
        contentType: "text/javascript",
        body: `import { createApp } from "./app.js";
import { baseMapConfig } from "./core/map-config.js";
import { resolveMapVariantConfig } from "./core/map-variants.js";
const initialMap = resolveMapVariantConfig(baseMapConfig, "living-room");
const exit = initialMap.regions.find(region => region.id === initialMap.objective.region);
initialMap.spawn = { ...initialMap.spawn, x: exit.x + exit.w / 2, y: exit.y + exit.h / 2 };
window.__mapPreview = createApp({ initialMap });`,
      }),
    );
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.locator("#start").click();
    // Start resets the map; defeat this fixture's mouse after that reset so
    // startup still reaches the exit and exercises stale capture refusal.
    await page.evaluate(() => {
      window.__mapPreview.mapRuntime.state.mouse.health = 0;
    });
    await page.keyboard.press("ArrowRight");
    await page.waitForFunction(
      () =>
        window.__mapPreview.mapRuntime.state.activeMap.variantId ===
        "parking-lot",
      null,
      { timeout: timing.introReleaseDelayMs + 5000 },
    );
    await page.evaluate(() => {
      window.__previewRetryCalls = 0;
      const progression = window.__mapPreview.mapProgression;
      const retry = progression.retryCurrentMap;
      progression.retryCurrentMap = () => {
        window.__previewRetryCalls++;
        return retry();
      };
    });
    await assert.rejects(
      page.evaluate(prepareMapCapture, "living-room"),
      /Cannot capture 'living-room': preview has already advanced to 'parking-lot'/,
    );
    assert.deepEqual(
      await page.evaluate(() => ({
        paused: window.__mapPreview.state.game.paused,
        retries: window.__previewRetryCalls,
      })),
      { paused: false, retries: 0 },
      "reject the wrong map before changing its run state",
    );
    assert.deepEqual(browserErrors, []);
  } finally {
    await page.close();
  }
}

const server = createStaticServer();
const port = await listen(server);
const browser = await launchBrowser();

try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const browserErrors = collectBrowserErrors(page);

  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.__marbleAppBooted === true);

  const renderedMap = await page.evaluate(() => {
    const floor = document.querySelector(".kitchenFloorCanvas");
    const centerPixel = floor
      ?.getContext("2d")
      ?.getImageData(
        Math.floor(floor.width / 2),
        Math.floor(floor.height / 2),
        1,
        1,
      ).data;
    const fixtureClasses = [
      "kitchenForkSprite",
      "kitchenSpoonSprite",
      "kitchenSpongeSprite",
    ];
    return {
      floorHeight: floor?.height ?? 0,
      floorPixelAlpha: centerPixel?.[3] ?? 0,
      floorWidth: floor?.width ?? 0,
      fixtureBackgrounds: fixtureClasses.map((className) => {
        const fixture = document.querySelector("." + className);
        return fixture
          ? window.getComputedStyle(fixture).backgroundImage
          : "none";
      }),
    };
  });
  assert.equal(renderedMap.floorWidth > 0, true);
  assert.equal(renderedMap.floorHeight > 0, true);
  assert.equal(renderedMap.floorPixelAlpha > 0, true);
  assert.equal(
    renderedMap.fixtureBackgrounds.every((value) => value !== "none"),
    true,
    "kitchen fixtures must have visible sprite assets",
  );

  const start = page.locator("#start");
  assert.equal(
    await start.isVisible(),
    true,
    "Start must be visible after boot",
  );
  assert.equal(
    await page.locator("#startHelp").isVisible(),
    true,
    "movement and goal instructions must be visible before starting",
  );
  assert.equal(
    await page.locator("#bootError").isHidden(),
    true,
    "the fatal boot layer must stay hidden after a successful boot",
  );

  await page.evaluate(() => {
    window.__installPromptCount = 0;
    const userChoice = Promise.resolve({ outcome: "accepted" });
    const event = new window.Event("beforeinstallprompt", {
      cancelable: true,
    });
    Object.defineProperties(event, {
      prompt: {
        value() {
          window.__installPromptCount++;
          return userChoice;
        },
      },
      userChoice: { value: userChoice },
    });
    window.dispatchEvent(event);
  });
  await page.locator("#settingsToggle").click();
  assert.equal(await page.locator("#installApp").isVisible(), true);
  await page.locator("#installApp").click();
  assert.equal(await page.locator("#installApp").isHidden(), true);
  assert.equal(await page.evaluate(() => window.__installPromptCount), 1);
  await page.locator("#closeSettings").click();

  const initialTransform = await marbleTransform(page);
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(100);
  assert.equal(
    await marbleTransform(page),
    initialTransform,
    "keyboard movement must remain gated until Start is pressed",
  );

  await start.click();
  assert.equal(
    await page.locator("#startHelp").isHidden(),
    true,
    "start instructions must leave the play surface after starting",
  );
  await page.keyboard.down("ArrowRight");
  await page.waitForFunction(
    (before) => document.getElementById("marble").style.transform !== before,
    initialTransform,
  );
  await page.keyboard.up("ArrowRight");

  await page.locator("#settingsToggle").click();
  assert.equal(
    await page.locator("#settingsOverlay").evaluate((element) => element.open),
    true,
    "settings must open",
  );
  const pausedTransform = await marbleTransform(page);
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(150);
  assert.equal(
    await marbleTransform(page),
    pausedTransform,
    "opening settings must pause movement",
  );

  await page.locator("#resumeGame").click();
  await page.keyboard.down("ArrowRight");
  await page.waitForFunction(
    (before) => document.getElementById("marble").style.transform !== before,
    pausedTransform,
  );
  await page.keyboard.up("ArrowRight");

  assert.deepEqual(browserErrors, [], "browser smoke test must not log errors");
  await testStartupRecovery(browser, `http://127.0.0.1:${port}/`);
  await testMotionPermissionRecovery(browser, `http://127.0.0.1:${port}/`);
  await testSettingsModality(browser, `http://127.0.0.1:${port}/`);
  await testInterruptionWorkflow(browser, `http://127.0.0.1:${port}/`);
  await testSyntheticOrientationWorkflow(browser, `http://127.0.0.1:${port}/`);
  await testSyntheticLateSensorRecovery(browser, `http://127.0.0.1:${port}/`);
  await testShortViewportSettingsRemainReachable(
    browser,
    `http://127.0.0.1:${port}/`,
  );
  await testLivingRoomMouseEncounter(browser, `http://127.0.0.1:${port}/`);
  await testCockroachEncounter(browser, `http://127.0.0.1:${port}/`);
  await testCameraZoomVisibility(browser, `http://127.0.0.1:${port}/`);
  await testPreviewRejectsCompletedMap(browser, `http://127.0.0.1:${port}/`);
  await testMapSwitching(browser, `http://127.0.0.1:${port}/`);
  console.log("Browser smoke test passed.");
} finally {
  await browser.close();
  await closeServer(server);
}
