import {
  resolveMapVariantConfig,
  selectNextMapVariant,
} from "./map-variants.js";

export function createMapProgression({
  baseMapConfig,
  getCurrentMap,
  applyMap,
  resetForNextMap,
  terrainView,
  ui,
  requestRender,
  formatMapLabel = (map) => map?.name ?? "",
  mapLabelDurationMs = 0,
  copy = {
    mapOpen: "map open.",
    goalNoNextMap: "goal reached. no next map available.",
  },
}) {
  function nextMapVariant() {
    const currentMap = getCurrentMap();
    if (!currentMap || typeof currentMap !== "object") return null;

    return selectNextMapVariant(baseMapConfig.variants, currentMap.variantId);
  }

  function blockAdvance(message) {
    terrainView.updateGoalProgress(0);
    ui.setHint(message);
    requestRender();
    return false;
  }

  function advanceToNextMap() {
    const variant = nextMapVariant();
    if (!variant) {
      return blockAdvance(copy.goalNoNextMap);
    }

    const nextMap = resolveMapVariantConfig(baseMapConfig, variant.id);

    applyMap(nextMap);
    resetForNextMap();
    const label = formatMapLabel(nextMap);
    if (label) ui.showLevelLabel(label, mapLabelDurationMs);
    ui.setHint(copy.mapOpen);
    requestRender();
    return true;
  }

  return {
    advanceToNextMap,
  };
}
