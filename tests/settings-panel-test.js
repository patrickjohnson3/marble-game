import assert from "node:assert/strict";
import { bindSettingsPanel } from "../settings/settings-panel.js";

function fakeControl(initialValue = "") {
  const listeners = {};

  return {
    checked: false,
    listeners,
    value: initialValue,
    addEventListener(type, listener) {
      listeners[type] = listener;
    },
  };
}

function fakeButton() {
  return {
    addEventListener() {},
  };
}

function createPanelHarness() {
  let applyCount = 0;
  let fullscreenChangeCount = 0;
  let fpsChangeCount = 0;
  let hitboxChangeCount = 0;
  let statsChangeCount = 0;
  let saveCount = 0;
  let renderCount = 0;
  let retryCount = 0;
  const settings = {
    maxSpeed: 14,
    acceleration: 0.115,
    hapticsEnabled: true,
    trailEnabled: false,
    fullscreenEnabled: true,
    goalIndicatorEnabled: false,
    hitboxOverlayEnabled: false,
    fpsEnabled: false,
    statsEnabled: false,
  };
  const fpsSetting = fakeControl();
  const fullscreenSetting = fakeControl();
  const goalIndicatorSetting = fakeControl();
  const hitboxOverlaySetting = fakeControl();
  const statsSetting = fakeControl();

  bindSettingsPanel({
    els: {
      neutralBtn: fakeButton(),
      settingsToggle: fakeButton(),
      settingsOverlay: fakeButton(),
      closeSettings: fakeButton(),
      resumeGame: fakeButton(),
      retryMap: fakeButton(),
      speedSetting: fakeControl(),
      sensitivitySetting: fakeControl(),
      hapticsSetting: fakeControl(),
      trailSetting: fakeControl(),
      fullscreenSetting,
      goalIndicatorSetting,
      hitboxOverlaySetting,
      fpsSetting,
      statsSetting,
    },
    settings,
    controls: {
      maxSpeed: { min: 8, max: 24, step: 1 },
      acceleration: { min: 0.06, max: 0.18, step: 0.005 },
    },
    applyRangeConfig(input, range) {
      input.min = range.min;
      input.max = range.max;
      input.step = range.step;
    },
    applySettings() {
      applyCount++;
    },
    applyFullscreenSetting() {
      fullscreenChangeCount++;
    },
    saveSettings() {
      saveCount++;
    },
    onOpenSettings() {},
    onCloseSettings() {},
    onRetryMap() {
      retryCount++;
    },
    onSetNeutral() {},
    onFpsChanged() {
      fpsChangeCount++;
    },
    onHitboxOverlayChanged() {
      hitboxChangeCount++;
    },
    onStatsChanged() {
      statsChangeCount++;
    },
    requestRender() {
      renderCount++;
    },
    fullscreenManagedByPwa: false,
  });

  return {
    counts: () => ({
      applyCount,
      fullscreenChangeCount,
      fpsChangeCount,
      hitboxChangeCount,
      statsChangeCount,
      saveCount,
      renderCount,
      retryCount,
    }),
    fpsSetting,
    fullscreenSetting,
    goalIndicatorSetting,
    hitboxOverlaySetting,
    statsSetting,
    settings,
  };
}

function testFpsTogglePersistsAndRenders() {
  const { counts, fpsSetting, settings } = createPanelHarness();

  fpsSetting.checked = true;
  fpsSetting.listeners.change();

  assert.equal(settings.fpsEnabled, true);
  assert.deepEqual(counts(), {
    applyCount: 0,
    fullscreenChangeCount: 0,
    fpsChangeCount: 1,
    hitboxChangeCount: 0,
    statsChangeCount: 0,
    saveCount: 1,
    renderCount: 1,
    retryCount: 0,
  });
}

testFpsTogglePersistsAndRenders();

function testStatsTogglePersistsAndRenders() {
  const { counts, statsSetting, settings } = createPanelHarness();

  statsSetting.checked = true;
  statsSetting.listeners.change();

  assert.equal(settings.statsEnabled, true);
  assert.deepEqual(counts(), {
    applyCount: 0,
    fullscreenChangeCount: 0,
    fpsChangeCount: 0,
    hitboxChangeCount: 0,
    statsChangeCount: 1,
    saveCount: 1,
    renderCount: 1,
    retryCount: 0,
  });
}

testStatsTogglePersistsAndRenders();

function testGoalIndicatorTogglePersistsAndRenders() {
  const { counts, goalIndicatorSetting, settings } = createPanelHarness();

  goalIndicatorSetting.checked = true;
  goalIndicatorSetting.listeners.change();

  assert.equal(settings.goalIndicatorEnabled, true);
  assert.deepEqual(counts(), {
    applyCount: 0,
    fullscreenChangeCount: 0,
    fpsChangeCount: 0,
    hitboxChangeCount: 0,
    statsChangeCount: 0,
    saveCount: 1,
    renderCount: 1,
    retryCount: 0,
  });
}

testGoalIndicatorTogglePersistsAndRenders();

function testHitboxOverlayTogglePersistsAndRenders() {
  const { counts, hitboxOverlaySetting, settings } = createPanelHarness();

  hitboxOverlaySetting.checked = true;
  hitboxOverlaySetting.listeners.change();

  assert.equal(settings.hitboxOverlayEnabled, true);
  assert.deepEqual(counts(), {
    applyCount: 0,
    fullscreenChangeCount: 0,
    fpsChangeCount: 0,
    hitboxChangeCount: 1,
    statsChangeCount: 0,
    saveCount: 1,
    renderCount: 1,
    retryCount: 0,
  });
}

testHitboxOverlayTogglePersistsAndRenders();

function testInstalledPwaDisablesFullscreenToggle() {
  let fullscreenChangeCount = 0;
  let saveCount = 0;
  const settings = {
    maxSpeed: 14,
    acceleration: 0.115,
    hapticsEnabled: true,
    trailEnabled: false,
    fullscreenEnabled: true,
    goalIndicatorEnabled: false,
    hitboxOverlayEnabled: false,
    fpsEnabled: false,
    statsEnabled: false,
  };
  const fullscreenSetting = fakeControl();

  bindSettingsPanel({
    els: {
      neutralBtn: fakeButton(),
      settingsToggle: fakeButton(),
      settingsOverlay: fakeButton(),
      closeSettings: fakeButton(),
      resumeGame: fakeButton(),
      retryMap: fakeButton(),
      speedSetting: fakeControl(),
      sensitivitySetting: fakeControl(),
      hapticsSetting: fakeControl(),
      trailSetting: fakeControl(),
      fullscreenSetting,
      goalIndicatorSetting: fakeControl(),
      hitboxOverlaySetting: fakeControl(),
      fpsSetting: fakeControl(),
      statsSetting: fakeControl(),
    },
    settings,
    controls: {
      maxSpeed: { min: 8, max: 24, step: 1 },
      acceleration: { min: 0.06, max: 0.18, step: 0.005 },
    },
    applyRangeConfig(input, range) {
      input.min = range.min;
      input.max = range.max;
      input.step = range.step;
    },
    applySettings() {},
    applyFullscreenSetting() {
      fullscreenChangeCount++;
    },
    saveSettings() {
      saveCount++;
    },
    onOpenSettings() {},
    onCloseSettings() {},
    onRetryMap() {},
    onSetNeutral() {},
    onFpsChanged() {},
    onHitboxOverlayChanged() {},
    onStatsChanged() {},
    requestRender() {},
    fullscreenManagedByPwa: true,
  });

  fullscreenSetting.checked = false;
  fullscreenSetting.listeners.change();

  assert.equal(fullscreenSetting.disabled, true);
  assert.equal(settings.fullscreenEnabled, true);
  assert.equal(fullscreenChangeCount, 0);
  assert.equal(saveCount, 0);
}

testInstalledPwaDisablesFullscreenToggle();

console.log("Settings panel tests passed.");
