export function applyRangeConfig(input, range) {
  input.min = range.min;
  input.max = range.max;
  input.step = range.step;
}

function numberSetting(value, fallback, range, clamp) {
  return Number.isFinite(value) ? clamp(value, range.min, range.max) : fallback;
}

export function loadSettings({ storage, storageKey, defaults, controls, clamp }) {
  try {
    const saved = JSON.parse(storage.getItem(storageKey) || "null");
    if (!saved || typeof saved !== "object") return { ...defaults };

    return {
      maxSpeed: numberSetting(saved.maxSpeed, defaults.maxSpeed, controls.maxSpeed, clamp),
      acceleration: numberSetting(saved.acceleration, defaults.acceleration, controls.acceleration, clamp),
      rotationEnabled: typeof saved.rotationEnabled === "boolean" ? saved.rotationEnabled : defaults.rotationEnabled,
      hapticsEnabled: typeof saved.hapticsEnabled === "boolean" ? saved.hapticsEnabled : defaults.hapticsEnabled,
      trailEnabled: typeof saved.trailEnabled === "boolean" ? saved.trailEnabled : defaults.trailEnabled,
      fullscreenEnabled: typeof saved.fullscreenEnabled === "boolean" ? saved.fullscreenEnabled : defaults.fullscreenEnabled
    };
  } catch {
    return { ...defaults };
  }
}

export function saveSettings({ storage, storageKey, settings }) {
  try {
    storage.setItem(storageKey, JSON.stringify({
      maxSpeed: settings.maxSpeed,
      acceleration: settings.acceleration,
      rotationEnabled: settings.rotationEnabled,
      hapticsEnabled: settings.hapticsEnabled,
      trailEnabled: settings.trailEnabled,
      fullscreenEnabled: settings.fullscreenEnabled
    }));
  } catch {
    // Persistence is optional; gameplay should still work without storage.
  }
}
