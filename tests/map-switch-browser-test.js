import assert from "node:assert/strict";
import { tuning } from "../core/game-config.js";
import { collectBrowserErrors } from "../tools/browser-support.js";

export async function testMapSwitching(browser, baseUrl) {
  const page = await browser.newPage({ viewport: { width: 390, height: 667 } });
  const errors = collectBrowserErrors(page);
  try {
    await page.route("**/boot.js*", (route) =>
      route.fulfill({
        contentType: "text/javascript",
        body: `import { createApp } from "./app.js";
window.__mapSwitchApp = createApp();`,
      }),
    );
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.waitForFunction(() => Boolean(window.__mapSwitchApp));
    await page.locator("#settingsToggle").click();
    assert.equal(await page.locator("#mapSelect").isDisabled(), true);
    assert.equal(await page.locator("#loadMap").isDisabled(), true);
    // Save a real preference so map loading cannot silently reset persistence.
    await page.locator("#trailSetting").check();
    const savedPreferences = await page.evaluate(() => ({ ...localStorage }));
    await page.locator("#closeSettings").click();
    await page.locator("#start").click();
    await page.evaluate((sampleCount) => {
      for (let index = 0; index < sampleCount; index++) {
        const event = new window.Event("deviceorientation");
        Object.defineProperties(event, {
          beta: { value: 12 },
          gamma: { value: 8 },
        });
        window.dispatchEvent(event);
      }
    }, tuning.neutralSampleCount);
    await page.locator("#settingsToggle").click();
    assert.equal(await page.locator("#mapSelect").isEnabled(), true);
    assert.equal(await page.locator("#loadMap").isEnabled(), true);
    assert.equal(
      await page.locator("#mapSelect").inputValue(),
      "kitchen-floor",
    );
    const before = await page.evaluate(() => {
      const { state } = window.__mapSwitchApp;
      return {
        neutralX: state.input.tilt.neutralX,
        neutralY: state.input.tilt.neutralY,
        sensor: { ...state.input.sensor },
        marble: { x: state.marble.x, y: state.marble.y },
      };
    });
    // Native keyboard selection must work while settings owns the game pause.
    await page.locator("#diagnosticsSettingsTitle").click();
    await page.locator("#mapSelect").focus();
    await page.keyboard.press("ArrowDown");
    assert.equal(await page.locator("#mapSelect").inputValue(), "living-room");
    assert.deepEqual(
      await page.evaluate(() => {
        const { x, y } = window.__mapSwitchApp.state.marble;
        return { x, y };
      }),
      before.marble,
      "changing the selection must neither move the marble nor load a map",
    );
    await page.locator("#loadMap").click();
    const loaded = await page.evaluate(() => {
      const { mapRuntime, state } = window.__mapSwitchApp;
      return {
        map: mapRuntime.state.activeMap.variantId,
        spawn: mapRuntime.state.activeMap.spawn,
        marble: { x: state.marble.x, y: state.marble.y },
        bounds: { ...state.bounds },
        released: state.intro.released,
        paused: state.game.paused,
        neutralX: state.input.tilt.neutralX,
        neutralY: state.input.tilt.neutralY,
        sensor: { ...state.input.sensor },
      };
    });
    assert.equal(loaded.map, "living-room");
    assert.equal(
      loaded.paused,
      false,
      "loading resumes a settings-owned pause",
    );
    assert.equal(await page.locator("#settingsOverlay").isVisible(), false);
    assert.equal(loaded.released, false, "switch during the initial countdown");
    assert.deepEqual(loaded.marble, { x: loaded.spawn.x, y: loaded.spawn.y });
    assert.deepEqual(
      {
        x: (loaded.bounds.left + loaded.bounds.right) / 2,
        y: (loaded.bounds.top + loaded.bounds.bottom) / 2,
      },
      loaded.marble,
      "the intro pen must relocate to the newly loaded spawn",
    );
    assert.equal(loaded.neutralX, before.neutralX);
    assert.equal(loaded.neutralY, before.neutralY);
    assert.deepEqual(loaded.sensor, before.sensor);
    assert.deepEqual(
      await page.evaluate(() => ({ ...localStorage })),
      savedPreferences,
    );

    await page.evaluate(() => window.__mapSwitchApp.gameController.pause());
    await page.locator("#settingsToggle").click();
    await page.locator("#mapSelect").selectOption("kitchen-floor");
    await page.locator("#loadMap").click();
    assert.equal(
      await page.evaluate(() => window.__mapSwitchApp.state.game.paused),
      true,
      "loading must preserve an independently paused game",
    );
    const antCount = await page.evaluate(() => {
      const { kitchenDynamics } = window.__mapSwitchApp;
      window.__oldAnts = kitchenDynamics.state.ants;
      kitchenDynamics.state.ants[0].alive = false;
      return kitchenDynamics.state.ants.length;
    });
    await page.locator("#settingsToggle").click();
    assert.equal(
      await page.locator("#mapSelect").inputValue(),
      "kitchen-floor",
    );
    await page.locator("#loadMap").click();
    assert.deepEqual(
      await page.evaluate(() => {
        const { kitchenDynamics } = window.__mapSwitchApp;
        return {
          fresh: kitchenDynamics.state.ants !== window.__oldAnts,
          living: kitchenDynamics.state.ants.filter((ant) => ant.alive).length,
        };
      }),
      { fresh: true, living: antCount },
      "loading the current map must start a fresh run",
    );
    await page.locator("#settingsToggle").click();
    await page.locator("#mapSelect").selectOption("living-room");
    await page.locator("#loadMap").click();
    await page.locator("#settingsToggle").click();
    await page.locator("#retryMap").click();
    assert.equal(
      await page.evaluate(
        () => window.__mapSwitchApp.mapRuntime.state.activeMap.variantId,
      ),
      "living-room",
      "Retry must use the selected map",
    );
    await page.evaluate(() =>
      window.__mapSwitchApp.mapProgression.advanceToNextMap(),
    );
    await page.locator("#settingsToggle").click();
    assert.equal(await page.locator("#mapSelect").inputValue(), "parking-lot");
    assert.deepEqual(errors, [], "map switching must not log browser errors");
  } finally {
    await page.close();
  }
}
