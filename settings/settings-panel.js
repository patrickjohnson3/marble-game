export function bindSettingsPanel({
  els,
  settings,
  controls,
  defaults,
  applySettings,
  applyFullscreenSetting,
  saveSettings,
  onOpenSettings,
  onCloseSettings,
  onInstallApp = () => {},
  onRetryMap,
  onSetNeutral,
  onFpsChanged,
  onHitboxOverlayChanged = () => {},
  onStatsChanged,
  requestRender,
  fullscreenManagedByPwa = false,
}) {
  function applyRangeConfig(input, range) {
    input.min = range.min;
    input.max = range.max;
    input.step = range.step;
  }

  const {
    neutralBtn,
    installApp,
    settingsToggle,
    settingsOverlay,
    closeSettings,
    resumeGame,
    retryMap,
    speedSetting,
    speedSettingValue,
    resetSpeedSetting,
    sensitivitySetting,
    sensitivitySettingValue,
    resetSensitivitySetting,
    hapticsSetting,
    trailSetting,
    fullscreenSetting,
    goalIndicatorSetting,
    hitboxOverlaySetting,
    fpsSetting,
    statsSetting,
  } = els;

  applyRangeConfig(speedSetting, controls.maxSpeed);
  applyRangeConfig(sensitivitySetting, controls.acceleration);
  speedSetting.value = settings.maxSpeed;
  sensitivitySetting.value = settings.acceleration;

  function updateRangeOutput(input, output) {
    const min = Number(input.min);
    const max = Number(input.max);
    const value = Number(input.value);
    const percent = max > min ? ((value - min) / (max - min)) * 100 : 0;
    output.textContent = Math.round(percent) + "%";
  }

  updateRangeOutput(speedSetting, speedSettingValue);
  updateRangeOutput(sensitivitySetting, sensitivitySettingValue);
  hapticsSetting.checked = settings.hapticsEnabled;
  trailSetting.checked = settings.trailEnabled;
  fullscreenSetting.checked = settings.fullscreenEnabled;
  fullscreenSetting.disabled = fullscreenManagedByPwa;
  goalIndicatorSetting.checked = settings.goalIndicatorEnabled;
  hitboxOverlaySetting.checked = settings.hitboxOverlayEnabled;
  fpsSetting.checked = settings.fpsEnabled;
  statsSetting.checked = settings.statsEnabled;

  function bindRangeSetting(input, output, key) {
    input.addEventListener("input", () => {
      settings[key] = Number(input.value);
      updateRangeOutput(input, output);
      applySettings();
      saveSettings();
    });
  }

  function bindRangeReset(button, input, output, key) {
    button.addEventListener("click", () => {
      input.value = defaults[key];
      settings[key] = defaults[key];
      updateRangeOutput(input, output);
      applySettings();
      saveSettings();
    });
  }

  function bindCheckboxSetting(input, key, afterChange = applySettings) {
    input.addEventListener("change", () => {
      if (input.disabled) return;

      settings[key] = input.checked;
      afterChange(settings[key]);
      saveSettings();
    });
  }

  settingsToggle.addEventListener("click", onOpenSettings);
  closeSettings.addEventListener("click", onCloseSettings);
  resumeGame.addEventListener("click", onCloseSettings);
  retryMap.addEventListener("click", onRetryMap);
  installApp.addEventListener("click", onInstallApp);
  neutralBtn.addEventListener("click", onSetNeutral);

  bindRangeSetting(speedSetting, speedSettingValue, "maxSpeed");
  bindRangeSetting(sensitivitySetting, sensitivitySettingValue, "acceleration");
  bindRangeReset(
    resetSpeedSetting,
    speedSetting,
    speedSettingValue,
    "maxSpeed",
  );
  bindRangeReset(
    resetSensitivitySetting,
    sensitivitySetting,
    sensitivitySettingValue,
    "acceleration",
  );
  bindCheckboxSetting(hapticsSetting, "hapticsEnabled");
  bindCheckboxSetting(trailSetting, "trailEnabled");
  bindCheckboxSetting(fullscreenSetting, "fullscreenEnabled", () => {
    applyFullscreenSetting();
  });
  bindCheckboxSetting(goalIndicatorSetting, "goalIndicatorEnabled", () => {
    requestRender();
  });
  bindCheckboxSetting(
    hitboxOverlaySetting,
    "hitboxOverlayEnabled",
    (enabled) => {
      onHitboxOverlayChanged(enabled);
      requestRender();
    },
  );
  bindCheckboxSetting(fpsSetting, "fpsEnabled", (enabled) => {
    onFpsChanged(enabled);
    requestRender();
  });
  bindCheckboxSetting(statsSetting, "statsEnabled", (enabled) => {
    onStatsChanged(enabled);
    requestRender();
  });
  settingsOverlay.addEventListener("click", (event) => {
    if (event.target === settingsOverlay) onCloseSettings();
  });
}
