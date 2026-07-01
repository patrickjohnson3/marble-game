function requiredElement(id) {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error("Missing required DOM element #" + id);
  }
  return element;
}

export const els = {
  game: requiredElement("game"),
  world: requiredElement("world"),
  introWalls: requiredElement("introWalls"),
  mapWalls: requiredElement("mapWalls"),
  roughPatches: requiredElement("roughPatches"),
  obstacles: requiredElement("obstacles"),
  marble: requiredElement("marble"),
  messageOverlay: requiredElement("messageOverlay"),
  startBtn: requiredElement("start"),
  neutralBtn: requiredElement("neutral"),
  settingsToggle: requiredElement("settingsToggle"),
  settingsOverlay: requiredElement("settingsOverlay"),
  closeSettings: requiredElement("closeSettings"),
  speedSetting: requiredElement("speedSetting"),
  sensitivitySetting: requiredElement("sensitivitySetting"),
  rotationSetting: requiredElement("rotationSetting"),
  hapticsSetting: requiredElement("hapticsSetting"),
  fullscreenSetting: requiredElement("fullscreenSetting"),
  hint: requiredElement("hint"),
  debug: requiredElement("debug")
};
