import {
  resolveMapVariantConfig,
  resolveSeededMapConfig,
  selectNextMapVariant,
} from "./map-variants.js";

export function resolveInitialMapConfig(
  baseMapConfig,
  seed = baseMapConfig.seed,
) {
  return resolveSeededMapConfig(baseMapConfig, seed);
}

export function nextProceduralMapVariant(baseMapConfig, currentVariantId) {
  return selectNextMapVariant(baseMapConfig.variants, currentVariantId);
}

export function resolveProceduralMapConfig(
  baseMapConfig,
  variantId,
  seed = variantId,
) {
  return resolveMapVariantConfig(baseMapConfig, variantId, seed);
}
