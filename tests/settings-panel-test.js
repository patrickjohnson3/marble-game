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
  return fakeControl();
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
  const loadedMaps = [];
  let installCount = 0;
  let updateCheckCount = 0;
  let updateCount = 0;
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
  const mapSelect = fakeControl("kitchen-floor");
  const loadMap = fakeButton();
  const fpsSetting = fakeControl();
  const fullscreenSetting = fakeControl();
  const goalIndicatorSetting = fakeControl();
  const hitboxOverlaySetting = fakeControl();
  const installApp = fakeControl();
  const checkAppUpdates = fakeButton();
  const updateApp = fakeButton();
  const statsSetting = fakeControl();
  const speedSetting = fakeControl();
  const speedSettingValue = { textContent: "" };
  const resetSpeedSetting = fakeButton();
  const sensitivitySetting = fakeControl();
  const sensitivitySettingValue = { textContent: "" };
  const resetSensitivitySetting = fakeButton();

  bindSettingsPanel({
    els: {
      neutralBtn: fakeButton(),
      settingsToggle: fakeButton(),
      settingsOverlay: fakeButton(),
      closeSettings: fakeButton(),
      resumeGame: fakeButton(),
      retryMap: fakeButton(),
      retryMotion: fakeButton(),
      mapSelect,
      loadMap,
      installApp,
      checkAppUpdates,
      updateApp,
      speedSetting,
      speedSettingValue,
      resetSpeedSetting,
      sensitivitySetting,
      sensitivitySettingValue,
      resetSensitivitySetting,
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
    defaults: {
      maxSpeed: 14,
      acceleration: 0.115,
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
    onInstallApp() {
      installCount++;
    },
    onCheckAppUpdates() {
      updateCheckCount++;
    },
    onUpdateApp() {
      updateCount++;
    },
    onRetryMap() {
      retryCount++;
    },
    onLoadMap(id) {
      loadedMaps.push(id);
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
    mapSelect,
    loadMap,
    loadedMaps,
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
    installApp,
    installCount: () => installCount,
    checkAppUpdates,
    updateApp,
    updateCheckCount: () => updateCheckCount,
    updateCount: () => updateCount,
    resetSpeedSetting,
    speedSetting,
    speedSettingValue,
    statsSetting,
    settings,
  };
}

function testInstallButtonRunsInstallCommand() {
  const { installApp, installCount } = createPanelHarness();

  installApp.listeners.click();

  assert.equal(installCount(), 1);
}

testInstallButtonRunsInstallCommand();

function testUpdateButtonsUseTheirActionsAndRespectDisabledState() {
  const { checkAppUpdates, updateApp, updateCheckCount, updateCount } =
    createPanelHarness();
  checkAppUpdates.listeners.click();
  updateApp.listeners.click();
  assert.equal(updateCheckCount(), 1);
  assert.equal(updateCount(), 1);
  checkAppUpdates.disabled = updateApp.disabled = true;
  checkAppUpdates.listeners.click();
  updateApp.listeners.click();
  assert.equal(updateCheckCount(), 1);
  assert.equal(updateCount(), 1);
}

testUpdateButtonsUseTheirActionsAndRespectDisabledState();

function testRangeSettingsExposePositionAndResetToDefaults() {
  const {
    counts,
    resetSpeedSetting,
    settings,
    speedSetting,
    speedSettingValue,
  } = createPanelHarness();

  assert.equal(speedSettingValue.textContent, "38%");

  speedSetting.value = 24;
  speedSetting.listeners.input();
  assert.equal(settings.maxSpeed, 24);
  assert.equal(speedSettingValue.textContent, "100%");

  resetSpeedSetting.listeners.click();
  assert.equal(settings.maxSpeed, 14);
  assert.equal(speedSetting.value, 14);
  assert.equal(speedSettingValue.textContent, "38%");
  assert.equal(counts().applyCount, 2);
  assert.equal(counts().saveCount, 2);
}

testRangeSettingsExposePositionAndResetToDefaults();

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
      retryMotion: fakeButton(),
      mapSelect: fakeControl(),
      loadMap: fakeButton(),
      installApp: fakeButton(),
      checkAppUpdates: fakeButton(),
      updateApp: fakeButton(),
      speedSetting: fakeControl(),
      speedSettingValue: { textContent: "" },
      resetSpeedSetting: fakeButton(),
      sensitivitySetting: fakeControl(),
      sensitivitySettingValue: { textContent: "" },
      resetSensitivitySetting: fakeButton(),
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
    defaults: {
      maxSpeed: 14,
      acceleration: 0.115,
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
    onLoadMap() {},
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

function testMapLoadIsAnExplicitCommandNotAPreference() {
  const { mapSelect, loadMap, loadedMaps, counts, settings } =
    createPanelHarness();
  const before = { ...settings };
  mapSelect.value = "living-room";
  assert.deepEqual(
    loadedMaps,
    [],
    "choosing alone must not reset the current run",
  );
  loadMap.disabled = true;
  loadMap.listeners.click();
  assert.deepEqual(loadedMaps, [], "disabled load must not switch maps");
  loadMap.disabled = false;
  loadMap.listeners.click();
  assert.deepEqual(loadedMaps, ["living-room"]);
  assert.deepEqual(settings, before);
  assert.equal(
    counts().saveCount,
    0,
    "map selection is not persisted as a preference",
  );
}

testMapLoadIsAnExplicitCommandNotAPreference();

console.log("Settings panel tests passed.");
