export const domIds = {
  game: "game",
  world: "world",
  introWalls: "introWalls",
  mapWalls: "mapWalls",
  mapTheme: "mapTheme",
  gooPatches: "gooPatches",
  hazardPatches: "hazardPatches",
  icePatches: "icePatches",
  roughPatches: "roughPatches",
  waterPatches: "waterPatches",
  obstacles: "obstacles",
  hitboxes: "hitboxes",
  mapThemeOverlay: "mapThemeOverlay",
  goal: "goal",
  trail: "trail",
  trailSegments: "trailSegments",
  effects: "effects",
  marble: "marble",
  goalIndicator: "goalIndicator",
  messageOverlay: "messageOverlay",
  gameStatus: "gameStatus",
  controls: "controls",
  startBtn: "start",
  neutralBtn: "neutral",
  settingsToggle: "settingsToggle",
  settingsOverlay: "settingsOverlay",
  settingsTitle: "settingsTitle",
  controlsHelpTitle: "controlsHelpTitle",
  movementHelp: "movementHelp",
  cameraHelp: "cameraHelp",
  goalHelp: "goalHelp",
  gameplaySettingsTitle: "gameplaySettingsTitle",
  deviceSettingsTitle: "deviceSettingsTitle",
  diagnosticsSettingsTitle: "diagnosticsSettingsTitle",
  pwaStatus: "pwaStatus",
  mapObjectsStatus: "mapObjectsStatus",
  closeSettings: "closeSettings",
  resumeGame: "resumeGame",
  installApp: "installApp",
  retryMap: "retryMap",
  speedSetting: "speedSetting",
  speedSettingValue: "speedSettingValue",
  resetSpeedSetting: "resetSpeedSetting",
  sensitivitySetting: "sensitivitySetting",
  sensitivitySettingValue: "sensitivitySettingValue",
  resetSensitivitySetting: "resetSensitivitySetting",
  hapticsSetting: "hapticsSetting",
  trailSetting: "trailSetting",
  fullscreenSetting: "fullscreenSetting",
  goalIndicatorSetting: "goalIndicatorSetting",
  hitboxOverlaySetting: "hitboxOverlaySetting",
  fpsSetting: "fpsSetting",
  statsSetting: "statsSetting",
  hint: "hint",
  levelLabel: "levelLabel",
  fpsCounter: "fpsCounter",
  debug: "debug",
};

export const requiredDomIds = Object.values(domIds);

function requiredElement(documentRef, id) {
  const element = documentRef.getElementById(id);
  if (!element) {
    throw new Error("Missing required DOM element #" + id);
  }
  return element;
}

export function createDomElements(documentRef = document) {
  return Object.fromEntries(
    Object.entries(domIds).map(([key, id]) => [
      key,
      requiredElement(documentRef, id),
    ]),
  );
}
