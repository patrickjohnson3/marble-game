export function bindSettingsPanel({
  els,
  settings,
  controls,
  applyRangeConfig,
  applySettings,
  applyFullscreenSetting,
  saveSettings,
  onOpenSettings,
  onCloseSettings,
  onSetNeutral,
  onFpsChanged,
  onStatsChanged,
  requestRender,
}) {
  const {
    neutralBtn,
    settingsToggle,
    settingsOverlay,
    closeSettings,
    resumeGame,
    speedSetting,
    sensitivitySetting,
    hapticsSetting,
    trailSetting,
    fullscreenSetting,
    fpsSetting,
    statsSetting,
  } = els;

  applyRangeConfig(speedSetting, controls.maxSpeed);
  applyRangeConfig(sensitivitySetting, controls.acceleration);
  speedSetting.value = settings.maxSpeed;
  sensitivitySetting.value = settings.acceleration;
  hapticsSetting.checked = settings.hapticsEnabled;
  trailSetting.checked = settings.trailEnabled;
  fullscreenSetting.checked = settings.fullscreenEnabled;
  fpsSetting.checked = settings.fpsEnabled;
  statsSetting.checked = settings.statsEnabled;

  function bindRangeSetting(input, key) {
    input.addEventListener("input", () => {
      settings[key] = Number(input.value);
      applySettings();
      saveSettings();
    });
  }

  function bindCheckboxSetting(input, key, afterChange = applySettings) {
    input.addEventListener("change", () => {
      settings[key] = input.checked;
      afterChange(settings[key]);
      saveSettings();
    });
  }

  settingsToggle.addEventListener("click", onOpenSettings);
  closeSettings.addEventListener("click", onCloseSettings);
  resumeGame.addEventListener("click", onCloseSettings);
  neutralBtn.addEventListener("click", onSetNeutral);

  bindRangeSetting(speedSetting, "maxSpeed");
  bindRangeSetting(sensitivitySetting, "acceleration");
  bindCheckboxSetting(hapticsSetting, "hapticsEnabled");
  bindCheckboxSetting(trailSetting, "trailEnabled");
  bindCheckboxSetting(fullscreenSetting, "fullscreenEnabled", () => {
    applyFullscreenSetting();
  });
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
