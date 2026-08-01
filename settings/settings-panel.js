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
  onRetryMap,
  onSetNeutral,
  onFpsChanged,
  onHitboxOverlayChanged = () => {},
  onStatsChanged,
  requestRender,
  fullscreenManagedByPwa = false,
}) {
  const {
    neutralBtn,
    settingsToggle,
    settingsOverlay,
    closeSettings,
    resumeGame,
    retryMap,
    speedSetting,
    sensitivitySetting,
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
  hapticsSetting.checked = settings.hapticsEnabled;
  trailSetting.checked = settings.trailEnabled;
  fullscreenSetting.checked = settings.fullscreenEnabled;
  fullscreenSetting.disabled = fullscreenManagedByPwa;
  goalIndicatorSetting.checked = settings.goalIndicatorEnabled;
  hitboxOverlaySetting.checked = settings.hitboxOverlayEnabled;
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
  neutralBtn.addEventListener("click", onSetNeutral);

  bindRangeSetting(speedSetting, "maxSpeed");
  bindRangeSetting(sensitivitySetting, "acceleration");
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
