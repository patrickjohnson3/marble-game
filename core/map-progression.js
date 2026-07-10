import {
  resolveMapVariantConfig,
  selectNextMapVariant,
  validateMapConfig
} from "./map.js";

export function createMapProgression({
  baseMapConfig,
  getCurrentMap,
  applyMap,
  resetForNextMap,
  terrainView,
  ui,
  requestRender,
  logger = console
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
      return blockAdvance("goal reached. no next map available.");
    }

    const nextMap = resolveMapVariantConfig(baseMapConfig, variant.id, variant.id);
    const validationErrors = validateMapConfig(nextMap);
    if (validationErrors.length > 0) {
      logger.error("Invalid next map:", validationErrors);
      return blockAdvance("goal reached. next map invalid.");
    }

    applyMap(nextMap);
    resetForNextMap();
    ui.setHint("goal reached. next map: " + getCurrentMap().variantId + ".");
    requestRender();
    return true;
  }

  return {
    advanceToNextMap,
    nextMapVariant
  };
}
