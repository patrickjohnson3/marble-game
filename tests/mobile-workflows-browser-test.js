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
