const bestTimesStorageKey = "marbleGameBestTimes";

function readBestTimes(storage) {
  try {
    if (!storage) return {};
    const parsed = JSON.parse(storage.getItem(bestTimesStorageKey) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeBestTimes(storage, times) {
  try {
    if (!storage) return;
    storage.setItem(bestTimesStorageKey, JSON.stringify(times));
  } catch {
    // Best times are optional; gameplay should continue without storage.
  }
}

export function formatRunTime(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return "--";
  return (ms / 1000).toFixed(1) + "s";
}

export function bestTimeLabel(ms) {
  return "best " + formatRunTime(ms);
}

export function loadBestTime(storage, mapId) {
  const value = readBestTimes(storage)[mapId];
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function recordBestTime(storage, mapId, runMs) {
  if (!mapId || !Number.isFinite(runMs) || runMs <= 0) {
    return loadBestTime(storage, mapId);
  }

  const bestTimes = readBestTimes(storage);
  const currentBest = Number.isFinite(bestTimes[mapId])
    ? bestTimes[mapId]
    : null;
  if (currentBest !== null && currentBest <= runMs) return currentBest;

  bestTimes[mapId] = runMs;
  writeBestTimes(storage, bestTimes);
  return runMs;
}
