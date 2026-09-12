// Clone only composed map content; global variant catalogs are shared definitions.
export function cloneMapComposition(map) {
  const fields = {};
  for (const key of [
    "objective",
    "regions",
    "clusters",
    "scenery",
    "views",
    "route",
  ]) {
    if (map[key] !== undefined)
      fields[key] = globalThis.structuredClone(map[key]);
  }
  return fields;
}

export function validMapVariants(variants) {
  return Array.isArray(variants)
    ? variants.filter((variant) => variant && typeof variant === "object")
    : [];
}

export function selectNextMapVariant(variants, currentVariantId) {
  const validVariants = validMapVariants(variants);
  if (validVariants.length === 0) return null;

  const currentIndex = validVariants.findIndex(
    (variant) => variant.id === currentVariantId,
  );
  if (currentIndex < 0) return validVariants[0];
  return validVariants[(currentIndex + 1) % validVariants.length];
}

function resolveMapConfig(config, variant) {
  if (!variant) return { ...config };
  const elements = Array.isArray(variant.elements)
    ? variant.elements.map((element) => ({ ...element }))
    : variant.elements;

  return {
    ...config,
    ...cloneMapComposition(variant),
    objective: variant.objective ? { ...variant.objective } : undefined,
    regions: variant.regions?.map((region) => ({ ...region })),
    variantId: variant.id,
    name: variant.name,
    theme: variant.theme,
    objectSummary: variant.objectSummary,
    difficulty: variant.difficulty,
    world: { ...(variant.world ?? config.world) },
    goal: variant.goal ? { ...variant.goal } : undefined,
    spawn: { ...(variant.spawn ?? config.spawn) },
    elements,
  };
}

export function resolveMapVariantConfig(config, variantId) {
  return resolveMapConfig(
    config,
    validMapVariants(config.variants).find(
      (variant) => variant.id === variantId,
    ),
  );
}
