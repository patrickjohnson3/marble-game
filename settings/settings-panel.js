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
  onRotationDisabled,
  onFpsChanged,
  requestRender
}) {
  const {
    neutralBtn,
    settingsToggle,
    settingsOverlay,
    closeSettings,
    resumeGame,
    speedSetting,
    sensitivitySetting,
    rotationSetting,
    hapticsSetting,
    trailSetting,
    fullscreenSetting,
    fpsSetting,
    cameraModeSetting
  } = els;

  applyRangeConfig(speedSetting, controls.maxSpeed);
  applyRangeConfig(sensitivitySetting, controls.acceleration);
  speedSetting.value = settings.maxSpeed;
  sensitivitySetting.value = settings.acceleration;
  rotationSetting.checked = settings.rotationEnabled;
  hapticsSetting.checked = settings.hapticsEnabled;
  trailSetting.checked = settings.trailEnabled;
  fullscreenSetting.checked = settings.fullscreenEnabled;
  fpsSetting.checked = settings.fpsEnabled;
  cameraModeSetting.value = settings.cameraMode;

  settingsToggle.addEventListener("click", onOpenSettings);
  closeSettings.addEventListener("click", onCloseSettings);
  resumeGame.addEventListener("click", onCloseSettings);
  neutralBtn.addEventListener("click", onSetNeutral);

  speedSetting.addEventListener("input", () => {
    settings.maxSpeed = Number(speedSetting.value);
    applySettings();
    saveSettings();
  });
  sensitivitySetting.addEventListener("input", () => {
    settings.acceleration = Number(sensitivitySetting.value);
    applySettings();
    saveSettings();
  });
  rotationSetting.addEventListener("change", () => {
    settings.rotationEnabled = rotationSetting.checked;
    applySettings();
    saveSettings();
    if (!settings.rotationEnabled) onRotationDisabled();
    requestRender();
  });
  hapticsSetting.addEventListener("change", () => {
    settings.hapticsEnabled = hapticsSetting.checked;
    applySettings();
    saveSettings();
  });
  trailSetting.addEventListener("change", () => {
    settings.trailEnabled = trailSetting.checked;
    applySettings();
    saveSettings();
  });
  fullscreenSetting.addEventListener("change", () => {
    settings.fullscreenEnabled = fullscreenSetting.checked;
    saveSettings();
    applyFullscreenSetting();
  });
  fpsSetting.addEventListener("change", () => {
    settings.fpsEnabled = fpsSetting.checked;
    onFpsChanged(settings.fpsEnabled);
    saveSettings();
    requestRender();
  });
  cameraModeSetting.addEventListener("change", () => {
    if (controls.cameraModes.includes(cameraModeSetting.value)) {
      settings.cameraMode = cameraModeSetting.value;
    } else {
      cameraModeSetting.value = settings.cameraMode;
    }
    applySettings();
    saveSettings();
    requestRender();
  });
  settingsOverlay.addEventListener("click", (event) => {
    if (event.target === settingsOverlay) onCloseSettings();
  });
}
