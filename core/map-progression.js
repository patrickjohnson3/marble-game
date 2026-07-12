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
	  copy = {
	    goalNoNextMap: "goal reached. no next map available.",
	    goalNextMapInvalid: "goal reached. next map invalid.",
	    goalNextMap: (variantId) => "goal reached. next map: " + variantId + "."
	  },
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
	      return blockAdvance(copy.goalNoNextMap);
	    }

    const nextMap = resolveMapVariantConfig(baseMapConfig, variant.id, variant.id);
    const validationErrors = validateMapConfig(nextMap);
	    if (validationErrors.length > 0) {
	      logger.error("Invalid next map:", validationErrors);
	      return blockAdvance(copy.goalNextMapInvalid);
	    }

    applyMap(nextMap);
    resetForNextMap();
	    ui.setHint(copy.goalNextMap(getCurrentMap().variantId));
    requestRender();
    return true;
  }

  return {
    advanceToNextMap,
    nextMapVariant
  };
}
