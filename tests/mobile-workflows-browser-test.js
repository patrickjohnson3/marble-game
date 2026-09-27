import assert from "node:assert/strict";
import { timing } from "../core/game-config.js";

export async function testStartupRecovery(browser, baseUrl) {
  for (const asset of ["style.css", "boot.js"]) {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      serviceWorkers: "block",
    });
    try {
      const failedAsset = `**/${asset}*`;
      await page.route(failedAsset, (route) => route.abort("failed"));
      await page.goto(baseUrl, { waitUntil: "networkidle" });
      assert.equal(
        await page.evaluate(() => window.__marbleAppBooted),
        false,
        `missing ${asset} must not be reported as a successful boot`,
      );
      assert.equal(
        await page.locator("#bootError").isVisible(),
        true,
        `missing ${asset} must expose recovery without game modules or CSS`,
      );
      const retry = page.getByRole("button", { name: "Retry", exact: true });
      assert.equal(await retry.isVisible(), true);
      const retryBox = await retry.boundingBox();
      assert.ok(
        retryBox.width >= 44 && retryBox.height >= 44,
        "the self-contained recovery action must be usable by touch",
      );

      // Model connectivity returning, then use the visible in-app action.
      await page.unroute(failedAsset);
      await Promise.all([
        page.waitForNavigation({ waitUntil: "networkidle" }),
        retry.tap(),
      ]);
      await page.waitForFunction(() => window.__marbleAppBooted === true);
      assert.equal(await page.locator("#bootError").isHidden(), true);
      const start = page.locator("#start");
      assert.equal(await start.isVisible(), true);
      assert.ok(
        (await start.boundingBox()).height >= 44,
        "Retry must restore the styled application, not only its modules",
      );
      await start.tap();
      assert.equal(await start.isHidden(), true);
    } finally {
      await page.close();
    }
  }

  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    serviceWorkers: "block",
  });
  let releaseStylesheet;
  const stylesheetRequested = new Promise((resolve) => {
    releaseStylesheet = resolve;
  });
  try {
    await page.route("**/style.css*", (route) => releaseStylesheet(route));
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    const stylesheet = await stylesheetRequested;
    await page.waitForFunction(() => document.getElementById("start"));
    // A stalled dependency must not expose a partially initialized game.
    await page.waitForTimeout(150);
    assert.equal(
      await page.evaluate(() => window.__marbleAppBooted),
      false,
      "startup must wait for the required stylesheet",
    );
    assert.equal(await page.locator("#bootError").isHidden(), true);
    await stylesheet.continue();
    await page.waitForFunction(() => window.__marbleAppBooted === true);
    assert.equal(await page.locator("#start").isVisible(), true);
    assert.equal(await page.locator("#bootError").isHidden(), true);
  } finally {
    await page.close();
  }
}

export async function testMotionPermissionRecovery(browser, baseUrl) {
  for (const delayedDenial of [false, true]) {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      serviceWorkers: "block",
    });
    try {
      // Test the browser permission boundary without claiming real OS dialogs.
      await page.addInitScript((delayed) => {
        window.DeviceOrientationEvent.requestPermission = () =>
          delayed
            ? new Promise((resolve) => {
                window.__resolveMotionPermission = resolve;
              })
            : Promise.resolve("denied");
      }, delayedDenial);
      await page.goto(baseUrl, { waitUntil: "networkidle" });
      await page.locator("#settingsToggle").tap();
      assert.equal(
        await page.locator("#motionRecovery").isVisible(),
        false,
        "motion recovery must not interrupt onboarding before Start",
      );
      await page.locator("#closeSettings").tap();
      await page.locator("#start").tap();
      if (delayedDenial) {
        await page.keyboard.press("ArrowRight");
        await page.evaluate(() => window.__resolveMotionPermission("denied"));
      }
      await page.waitForTimeout(timing.sensorFallbackMs + 100);
      const status = await page.locator("#gameStatus").textContent();
      if (!delayedDenial) {
        assert.match(
          status,
          /(?:motion|permission).*denied/i,
          "denial must survive watchdog fallback",
        );
        assert.doesNotMatch(
          status,
          /chrome/i,
          "the shared permission message must not give Chrome-only instructions",
        );
        assert.match(status, /settings/i);
      }
      const beforeKeyboard = await page
        .locator("#marble")
        .getAttribute("style");
      await page.keyboard.down("ArrowRight");
      await page.waitForFunction(
        (before) =>
          document.getElementById("marble").getAttribute("style") !== before,
        beforeKeyboard,
      );
      await page.keyboard.up("ArrowRight");

      await page.locator("#settingsToggle").tap();
      assert.equal(await page.locator("#motionRecovery").isVisible(), true);
      const help = await page.locator("#motionRecoveryHelp").textContent();
      assert.match(help, /permission|motion access/i);
      assert.match(
        help,
        /denied/i,
        "Settings must explain even a late denial after keyboard startup",
      );
      assert.match(
        help,
        /restart|reset/i,
        "reload must disclose losing the run",
      );
      assert.doesNotMatch(help, /chrome/i);
      const retry = page.getByRole("button", {
        name: "Reload to retry motion",
        exact: true,
      });
      await Promise.all([
        page.waitForNavigation({ waitUntil: "networkidle" }),
        retry.tap(),
      ]);
      assert.equal(await page.locator("#start").isVisible(), true);
      assert.equal(await page.locator("#motionRecovery").isVisible(), false);
    } finally {
      await page.close();
    }
  }

  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    serviceWorkers: "block",
  });
  try {
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.locator("#start").tap();
    await page.waitForTimeout(timing.sensorFallbackMs + 100);
    await page.locator("#settingsToggle").tap();
    assert.equal(
      await page.locator("#motionRecovery").isVisible(),
      true,
      "a phone receiving no readings must expose recovery even without a denial",
    );
    await page.evaluate(() => {
      const sample = new window.Event("deviceorientation");
      Object.defineProperties(sample, {
        beta: { value: 13 },
        gamma: { value: 7 },
      });
      window.dispatchEvent(sample);
    });
    assert.equal(
      await page.locator("#motionRecovery").isVisible(),
      false,
      "a recovered sensor must remove obsolete reload advice while settings stay open",
    );
    await page.locator("#resumeGame").tap();
    await page.locator("#settingsToggle").tap();
    assert.equal(await page.locator("#motionRecovery").isVisible(), false);
  } finally {
    await page.close();
  }
}

export async function testSettingsModality(browser, baseUrl) {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    serviceWorkers: "block",
  });
  try {
    await page.route("**/boot.js*", (route) =>
      route.fulfill({
        contentType: "text/javascript",
        body: `import { createApp } from "./app.js";
window.__mapPreview = createApp();`,
      }),
    );
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    const focusedId = () => page.evaluate(() => document.activeElement.id);
    const settings = page.locator("#settingsToggle");
    await settings.focus();
    await settings.tap();
    assert.equal(
      await focusedId(),
      "closeSettings",
      "opening Settings must move focus to its close action",
    );
    await page.locator("#start").evaluate((button) => button.focus());
    assert.equal(
      await focusedId(),
      "closeSettings",
      "the covered Start control must be inert while Settings is open",
    );
    const speed = page.locator("#speedSetting");
    const previousSpeed = Number(await speed.inputValue());
    await speed.focus();
    await page.keyboard.press("ArrowRight");
    assert.ok(
      Number(await speed.inputValue()) > previousSpeed,
      "game movement listeners must not swallow Settings slider keys before Start",
    );
    await page.locator("#closeSettings").focus();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    assert.equal(
      await page.evaluate(() => window.__mapPreview.state.game.phase),
      "waiting",
      "Tab and Enter in Settings must not start the covered game",
    );
    for (const key of ["Tab", "Shift+Tab"]) {
      for (let index = 0; index < 24; index++) {
        await page.keyboard.press(key);
        assert.equal(
          await page.evaluate(() => {
            const active = document.activeElement;
            // Native Tab traversal may visit browser chrome (BODY in headless
            // Chromium), but must never reach a background app control.
            return (
              active === document.body || !!active.closest("#settingsOverlay")
            );
          }),
          true,
          `${key} must not reach controls behind Settings`,
        );
      }
    }
    await page.locator("#closeSettings").tap();
    assert.equal(await focusedId(), "settingsToggle");
    assert.equal(await page.locator("#settingsOverlay").isVisible(), false);
    await settings.tap();
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("#settingsOverlay").isVisible(), false);
    assert.equal(await focusedId(), "settingsToggle");
    assert.equal(await page.locator("#start").isVisible(), true);
    await settings.tap();
    await page.touchscreen.tap(2, 2);
    assert.equal(
      await page.locator("#settingsOverlay").isVisible(),
      false,
      "tapping the overlay outside the sheet must retain dismissal behavior",
    );
    assert.equal(await focusedId(), "settingsToggle");

    await page.locator("#start").tap();
    await page.keyboard.press("ArrowRight");
    await settings.tap();
    assert.equal(
      await page.evaluate(() => window.__mapPreview.state.game.paused),
      true,
      "the modal must keep the existing gameplay pause",
    );
    const pausedPosition = await page.evaluate(() => {
      const { x, y } = window.__mapPreview.state.marble;
      return { x, y };
    });
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(100);
    assert.deepEqual(
      await page.evaluate(() => {
        const { x, y } = window.__mapPreview.state.marble;
        return { x, y };
      }),
      pausedPosition,
    );
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("#settingsOverlay").isVisible(), false);
    assert.equal(await focusedId(), "settingsToggle");
    assert.equal(
      await page.evaluate(() => window.__mapPreview.state.game.paused),
      false,
      "Escape must resume a game paused by Settings",
    );

    await page.evaluate(() => window.__mapPreview.gameController.pause());
    await settings.tap();
    await page.locator("#resumeGame").tap();
    assert.equal(
      await page.evaluate(() => window.__mapPreview.state.game.paused),
      true,
      "closing Settings must preserve a pause owned by another workflow",
    );
    assert.equal(await focusedId(), "settingsToggle");

    await page.setViewportSize({ width: 390, height: 300 });
    await settings.tap();
    await page.locator("#resumeGame").tap();
    assert.equal(await page.locator("#settingsOverlay").isVisible(), false);
    assert.equal(await focusedId(), "settingsToggle");
  } finally {
    await page.close();
  }
}
export async function testConstrainedOnboarding(browser, baseUrl) {
  for (const scenario of [
    { width: 320, height: 256, textScale: 1 },
    { width: 320, height: 568, textScale: 2 },
    { width: 844, height: 390, textScale: 1, safeLeft: 44, safeRight: 44 },
    { width: 390, height: 844, textScale: 1, safeTop: 44, safeBottom: 34 },
  ]) {
    const page = await browser.newPage({
      viewport: { width: scenario.width, height: scenario.height },
      isMobile: true,
      hasTouch: true,
      serviceWorkers: "block",
    });
    try {
      await page.goto(baseUrl, { waitUntil: "networkidle" });
      await page.evaluate((view) => {
        for (const side of ["Top", "Right", "Bottom", "Left"]) {
          document.documentElement.style.setProperty(
            `--safe-${side.toLowerCase()}`,
            `${view[`safe${side}`] || 0}px`,
          );
        }
        // Emulate enlarged interface text; this does not claim OS font scaling.
        const fonts = [
          ...document.querySelectorAll("#controls, #controls *"),
        ].map((element) => [
          element,
          parseFloat(window.getComputedStyle(element).fontSize),
        ]);
        for (const [element, size] of fonts) {
          element.style.fontSize = `${size * view.textScale}px`;
        }
      }, scenario);
      const layout = await page.evaluate(() => {
        const rect = (id) => {
          const b = document.getElementById(id).getBoundingClientRect();
          return { left: b.left, right: b.right, top: b.top, bottom: b.bottom };
        };
        const gear = rect("settingsToggle");
        return {
          help: rect("startHelp"),
          start: rect("start"),
          gearAccessible: !!document
            .elementFromPoint(
              (gear.left + gear.right) / 2,
              (gear.top + gear.bottom) / 2,
            )
            ?.closest("#settingsToggle"),
          documentWidth: document.documentElement.scrollWidth,
        };
      });
      assert.equal(
        layout.gearAccessible,
        true,
        "instructions must not cover Settings",
      );
      for (const bounds of [layout.help, layout.start]) {
        assert.ok(
          bounds.top >= 0 &&
            bounds.bottom <= scenario.height - (scenario.safeBottom || 0),
        );
        assert.ok(
          bounds.left >= (scenario.safeLeft || 0) &&
            bounds.right <= scenario.width - (scenario.safeRight || 0),
        );
      }
      assert.ok(
        layout.start.bottom - layout.start.top >= 44,
        "Start must retain its touch target when instructions overflow",
      );
      assert.ok(
        layout.documentWidth <= scenario.width,
        "onboarding must not create horizontal overflow",
      );
      const help = page.locator("#startHelp");
      const overflow = await help.evaluate(
        (element) => element.scrollHeight > element.clientHeight,
      );
      if (overflow) {
        await help.focus();
        await page.keyboard.press("ArrowDown");
        await page.waitForFunction(
          () => document.getElementById("startHelp").scrollTop > 0,
          null,
          { timeout: 1000 },
        );
        await help.evaluate((element) => {
          element.scrollTop = 0;
        });
        const box = await help.boundingBox();
        const cdp = await page.context().newCDPSession(page);
        const x = box.x + box.width / 2;
        const startY = box.y + box.height - 12;
        const endY = box.y + 12;
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [{ x, y: startY }],
        });
        for (let step = 1; step <= 5; step++) {
          await cdp.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{ x, y: startY + ((endY - startY) * step) / 5 }],
          });
          await page.waitForTimeout(20);
        }
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchEnd",
          touchPoints: [],
        });
        assert.ok(
          await help.evaluate((element) => element.scrollTop > 0),
          "overflowed instructions must scroll with a finger",
        );
        await cdp.detach();
      }
      if (scenario.width === 320)
        assert.equal(
          overflow,
          true,
          "constrained instructions should scroll rather than displace controls",
        );
      await page.locator("#settingsToggle").tap();
      assert.equal(await page.locator("#settingsOverlay").isVisible(), true);
      await page.locator("#closeSettings").tap();
      await page.locator("#start").tap();
      assert.equal(await page.locator("#controls").isHidden(), true);
    } finally {
      await page.close();
    }
  }
}

export async function testSinglePointerCameraControls(browser, baseUrl) {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    serviceWorkers: "block",
  });
  try {
    await page.route("**/boot.js*", (route) =>
      route.fulfill({
        contentType: "text/javascript",
        body: `import { createApp } from "./app.js";
window.__mapPreview = createApp();`,
      }),
    );
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    const controls = page.locator("#cameraControls");
    assert.equal(
      await controls.count(),
      1,
      "camera exploration must have single-pointer controls",
    );
    assert.equal(await controls.isHidden(), true);
    await page.locator("#start").tap();
    await page.keyboard.press("ArrowRight");
    await page.waitForFunction(
      () => window.__mapPreview.state.intro.released,
      null,
      { timeout: timing.introReleaseDelayMs + 3000 },
    );
    assert.equal(await controls.isVisible(), true);
    assert.equal(
      await controls.evaluate((element) => element.open),
      false,
      "camera controls should start collapsed",
    );
    await page.locator("#cameraControlsTitle").tap();
    const cameraState = () =>
      page.evaluate(() => {
        const { x, y, scale } = window.__mapPreview.state.camera;
        return { x, y, scale };
      });
    const assertMarbleVisible = async () => {
      const bounds = await page.locator("#marble").boundingBox();
      const viewport = page.viewportSize();
      assert.ok(
        bounds.x >= -0.5 &&
          bounds.y >= -0.5 &&
          bounds.x + bounds.width <= viewport.width + 0.5 &&
          bounds.y + bounds.height <= viewport.height + 0.5,
        "camera buttons must keep the complete marble visible",
      );
    };
    for (const [id, name] of [
      ["zoomIn", "Zoom in"],
      ["zoomOut", "Zoom out"],
      ["cameraLeft", "Pan left"],
      ["cameraRight", "Pan right"],
      ["cameraUp", "Pan up"],
      ["cameraDown", "Pan down"],
      ["centerCamera", "Center on marble"],
    ]) {
      assert.equal(
        await page.getByRole("button", { name, exact: true }).count(),
        1,
      );
      const box = await page.locator(`#${id}`).boundingBox();
      assert.ok(
        box.width >= 44 && box.height >= 44,
        `${name} needs a usable touch target`,
      );
    }
    let before = await cameraState();
    await page.getByRole("button", { name: "Zoom in", exact: true }).tap();
    assert.ok((await cameraState()).scale > before.scale);
    await assertMarbleVisible();
    before = await cameraState();
    await page.getByRole("button", { name: "Zoom out", exact: true }).tap();
    assert.ok((await cameraState()).scale < before.scale);
    await assertMarbleVisible();
    for (const [name, axis] of [
      ["Pan left", "x"],
      ["Pan right", "x"],
      ["Pan up", "y"],
      ["Pan down", "y"],
    ]) {
      before = await cameraState();
      await page.getByRole("button", { name, exact: true }).tap();
      assert.notEqual(
        (await cameraState())[axis],
        before[axis],
        `${name} must inspect another part of the map`,
      );
      await assertMarbleVisible();
    }
    before = await cameraState();
    await page.getByRole("button", { name: "Zoom in", exact: true }).focus();
    await page.keyboard.press("Enter");
    assert.ok(
      (await cameraState()).scale > before.scale,
      "camera buttons must support keyboard activation",
    );
    await page.keyboard.down("ArrowRight");
    assert.equal(
      await page.evaluate(() => window.__mapPreview.state.input.keyboard.x),
      1,
      "camera button focus must not swallow subsequent marble steering",
    );
    await page.keyboard.up("ArrowRight");
    await page
      .getByRole("button", { name: "Center on marble", exact: true })
      .tap();
    await assertMarbleVisible();

    await page.locator("#settingsToggle").tap();
    const pausedCamera = await cameraState();
    await page.locator("#zoomIn").evaluate((button) => button.focus());
    assert.equal(
      await page.evaluate(
        () => document.activeElement.closest("#settingsOverlay") !== null,
      ),
      true,
      "Settings must keep camera controls inert",
    );
    await page.locator("#zoomIn").evaluate((button) => button.click());
    assert.deepEqual(
      await cameraState(),
      pausedCamera,
      "paused camera actions must not alter the view",
    );
    await page.locator("#resumeGame").tap();

    for (const viewport of [
      { width: 320, height: 256 },
      { width: 844, height: 390 },
    ]) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(50);
      const box = await controls.boundingBox();
      assert.ok(
        box.x >= 0 &&
          box.y >= 0 &&
          box.x + box.width <= viewport.width &&
          box.y + box.height <= viewport.height,
        "expanded camera controls must fit constrained and rotated viewports",
      );
      await page
        .getByRole("button", { name: "Center on marble", exact: true })
        .tap();
      await assertMarbleVisible();
    }
    await page.evaluate(() => window.__mapPreview.gameController.reset());
    assert.equal(await controls.isHidden(), true);
    assert.equal(await controls.evaluate((element) => element.open), false);
    assert.equal(await page.locator("#start").isVisible(), true);
  } finally {
    await page.close();
  }
}
