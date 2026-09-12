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
    await page
      .locator("#settingsOverlay")
      .evaluate((element) => element.classList.contains("open")),
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
  await testSyntheticOrientationWorkflow(browser, `http://127.0.0.1:${port}/`);
  await testSyntheticLateSensorRecovery(browser, `http://127.0.0.1:${port}/`);
  await testShortViewportSettingsRemainReachable(
    browser,
    `http://127.0.0.1:${port}/`,
  );
  await testPreviewRejectsCompletedMap(browser, `http://127.0.0.1:${port}/`);
  console.log("Browser smoke test passed.");
} finally {
  await browser.close();
  await closeServer(server);
}
