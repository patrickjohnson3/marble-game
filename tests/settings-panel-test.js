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
  const cameraModeSetting = fakeControl("follow");
  let applyCount = 0;
  let fpsChangeCount = 0;
  let statsChangeCount = 0;
  let saveCount = 0;
  let renderCount = 0;
  const settings = {
    maxSpeed: 14,
    acceleration: 0.115,
    hapticsEnabled: true,
    trailEnabled: false,
    fullscreenEnabled: true,
    fpsEnabled: false,
    statsEnabled: false,
    cameraMode: "follow",
  };
  const fpsSetting = fakeControl();
  const statsSetting = fakeControl();

  bindSettingsPanel({
    els: {
      neutralBtn: fakeButton(),
      settingsToggle: fakeButton(),
      settingsOverlay: fakeButton(),
      closeSettings: fakeButton(),
      resumeGame: fakeButton(),
      speedSetting: fakeControl(),
      sensitivitySetting: fakeControl(),
      hapticsSetting: fakeControl(),
      trailSetting: fakeControl(),
      fullscreenSetting: fakeControl(),
      fpsSetting,
      statsSetting,
      cameraModeSetting,
    },
    settings,
    controls: {
      maxSpeed: { min: 8, max: 24, step: 1 },
      acceleration: { min: 0.06, max: 0.18, step: 0.005 },
      cameraModes: ["follow", "lockedCenter", "predictiveLookAhead"],
    },
    applyRangeConfig(input, range) {
      input.min = range.min;
      input.max = range.max;
      input.step = range.step;
    },
    applySettings() {
      applyCount++;
    },
    applyFullscreenSetting() {},
    saveSettings() {
      saveCount++;
    },
    onOpenSettings() {},
    onCloseSettings() {},
    onSetNeutral() {},
    onFpsChanged() {
      fpsChangeCount++;
    },
    onStatsChanged() {
      statsChangeCount++;
    },
    requestRender() {
      renderCount++;
    },
  });

  return {
    cameraModeSetting,
    counts: () => ({
      applyCount,
      fpsChangeCount,
      statsChangeCount,
      saveCount,
      renderCount,
    }),
    fpsSetting,
    statsSetting,
    settings,
  };
}

function testValidCameraModeChangePersists() {
  const { cameraModeSetting, counts, settings } = createPanelHarness();

  cameraModeSetting.value = "lockedCenter";
  cameraModeSetting.listeners.change();

  assert.equal(settings.cameraMode, "lockedCenter");
  assert.deepEqual(counts(), {
    applyCount: 1,
    fpsChangeCount: 0,
    statsChangeCount: 0,
    saveCount: 1,
    renderCount: 1,
  });
}

function testInvalidCameraModeChangeFallsBack() {
  const { cameraModeSetting, counts, settings } = createPanelHarness();

  cameraModeSetting.value = "orbit";
  cameraModeSetting.listeners.change();

  assert.equal(settings.cameraMode, "follow");
  assert.equal(cameraModeSetting.value, "follow");
  assert.deepEqual(counts(), {
    applyCount: 1,
    fpsChangeCount: 0,
    statsChangeCount: 0,
    saveCount: 1,
    renderCount: 1,
  });
}

testValidCameraModeChangePersists();
testInvalidCameraModeChangeFallsBack();

function testFpsTogglePersistsAndRenders() {
  const { counts, fpsSetting, settings } = createPanelHarness();

  fpsSetting.checked = true;
  fpsSetting.listeners.change();

  assert.equal(settings.fpsEnabled, true);
  assert.deepEqual(counts(), {
    applyCount: 0,
    fpsChangeCount: 1,
    statsChangeCount: 0,
    saveCount: 1,
    renderCount: 1,
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
    fpsChangeCount: 0,
    statsChangeCount: 1,
    saveCount: 1,
    renderCount: 1,
  });
}

testStatsTogglePersistsAndRenders();

console.log("Settings panel tests passed.");
