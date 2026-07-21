export function hashMapSeed(seed) {
  const text = String(seed ?? "");
  let hash = 2166136261;

  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

export function validMapVariants(variants) {
  return Array.isArray(variants)
    ? variants.filter((variant) => variant && typeof variant === "object")
    : [];
}

export function selectSeededMapVariant(variants, seed) {
  const validVariants = validMapVariants(variants);
  if (validVariants.length === 0) return null;

  const exactVariant = validVariants.find((variant) => variant.id === seed);
  if (exactVariant) return exactVariant;

  return validVariants[hashMapSeed(seed) % validVariants.length];
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

export function goalRadiusForDifficulty(difficulty, fallbackRadius) {
  const level = Math.round(difficulty);
  if (level <= 1) return Math.max(fallbackRadius, 110);
  if (level === 2) return fallbackRadius;
  if (level >= 3) return Math.min(fallbackRadius, 84);
  return fallbackRadius;
}

function resolveVariantGoal(variant) {
  const goal = { ...variant.goal };
  goal.r = goalRadiusForDifficulty(variant.difficulty, goal.r);
  return goal;
}

function resolveMapConfig(config, { seed, variant }) {
  if (!variant) return { ...config, seed };
  const elements = Array.isArray(variant.elements)
    ? variant.elements.map((element) => ({ ...element }))
    : variant.elements;

  return {
    ...config,
    seed,
    variantId: variant.id,
    difficulty: variant.difficulty,
    goal: resolveVariantGoal(variant),
    spawn: { ...(variant.spawn ?? config.spawn) },
    elements,
  };
}

export function resolveSeededMapConfig(config, seed = config.seed) {
  return resolveMapConfig(config, {
    seed,
    variant: selectSeededMapVariant(config.variants, seed),
  });
}

export function resolveMapVariantConfig(config, variantId, seed = config.seed) {
  return resolveMapConfig(config, {
    seed,
    variant: validMapVariants(config.variants).find(
      (variant) => variant.id === variantId,
    ),
  });
}
