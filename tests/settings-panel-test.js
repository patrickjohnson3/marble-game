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
    }
  };
}

function fakeButton() {
  return {
    addEventListener() {}
  };
}

function createPanelHarness() {
  const cameraModeSetting = fakeControl("follow");
  let applyCount = 0;
  let saveCount = 0;
  let renderCount = 0;
  const settings = {
    maxSpeed: 14,
    acceleration: 0.115,
    rotationEnabled: false,
    hapticsEnabled: true,
    trailEnabled: false,
    fullscreenEnabled: true,
    cameraMode: "follow"
  };

  bindSettingsPanel({
    els: {
      neutralBtn: fakeButton(),
      settingsToggle: fakeButton(),
      settingsOverlay: fakeButton(),
      closeSettings: fakeButton(),
      resumeGame: fakeButton(),
      speedSetting: fakeControl(),
      sensitivitySetting: fakeControl(),
      rotationSetting: fakeControl(),
      hapticsSetting: fakeControl(),
      trailSetting: fakeControl(),
      fullscreenSetting: fakeControl(),
      cameraModeSetting
    },
    settings,
    controls: {
      maxSpeed: { min: 8, max: 24, step: 1 },
      acceleration: { min: 0.06, max: 0.18, step: 0.005 },
      cameraModes: ["follow", "lockedCenter", "predictiveLookAhead"]
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
    onRotationDisabled() {},
    requestRender() {
      renderCount++;
    }
  });

  return {
    cameraModeSetting,
    counts: () => ({ applyCount, saveCount, renderCount }),
    settings
  };
}

function testValidCameraModeChangePersists() {
  const { cameraModeSetting, counts, settings } = createPanelHarness();

  cameraModeSetting.value = "lockedCenter";
  cameraModeSetting.listeners.change();

  assert.equal(settings.cameraMode, "lockedCenter");
  assert.deepEqual(counts(), { applyCount: 1, saveCount: 1, renderCount: 1 });
}

function testInvalidCameraModeChangeFallsBack() {
  const { cameraModeSetting, counts, settings } = createPanelHarness();

  cameraModeSetting.value = "orbit";
  cameraModeSetting.listeners.change();

  assert.equal(settings.cameraMode, "follow");
  assert.equal(cameraModeSetting.value, "follow");
  assert.deepEqual(counts(), { applyCount: 1, saveCount: 1, renderCount: 1 });
}

testValidCameraModeChangePersists();
testInvalidCameraModeChangeFallsBack();

console.log("Settings panel tests passed.");
