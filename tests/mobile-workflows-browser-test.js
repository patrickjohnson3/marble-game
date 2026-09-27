import assert from "node:assert/strict";

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
