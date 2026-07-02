function particleStyle({ x, y, dx, dy, size, lifeMs, opacity }) {
  return [
    "--x:" + x.toFixed(1) + "px",
    "--y:" + y.toFixed(1) + "px",
    "--dx:" + dx.toFixed(1) + "px",
    "--dy:" + dy.toFixed(1) + "px",
    "--size:" + size.toFixed(1) + "px",
    "--life:" + lifeMs.toFixed(0) + "ms",
    "--opacity:" + opacity.toFixed(2)
  ].join(";");
}

function velocityUnit(marble) {
  const speed = Math.hypot(marble.vx, marble.vy);
  if (speed <= 0.001) return { x: 0, y: -1 };
  return { x: marble.vx / speed, y: marble.vy / speed };
}

export function createEffectsRenderer({
  effectsEl,
  marble,
  config,
  clamp,
  random = Math.random,
  now = () => performance.now()
}) {
  let lastImpactAt = Number.NEGATIVE_INFINITY;
  let lastSurfaceAt = 0;

  function spawn(className, style, lifeMs) {
    while (effectsEl.childNodes.length >= config.maxParticles) {
      effectsEl.firstChild.remove();
    }
    const particle = document.createElement("i");
    particle.className = "effectParticle " + className;
    particle.setAttribute("aria-hidden", "true");
    particle.style.cssText = style;
    effectsEl.appendChild(particle);
    setTimeout(() => particle.remove(), lifeMs);
  }

  function spawnImpact(impact) {
    if (impact < config.impactMin) return;
    const currentTime = now();
    if (currentTime - lastImpactAt < config.impactCooldownMs) return;
    lastImpactAt = currentTime;

    const intensity = clamp(impact / config.impactReference, 0, 1);
    const count = Math.round(config.impactMinParticles + intensity * config.impactExtraParticles);
    const direction = velocityUnit(marble);
    const baseX = marble.x + direction.x * marble.r * config.impactEdgeRatio;
    const baseY = marble.y + direction.y * marble.r * config.impactEdgeRatio;

    for (let i = 0; i < count; i++) {
      const spread = (random() - 0.5) * config.impactSpread;
      const speed = config.impactDriftMin + random() * config.impactDriftRange;
      const dx = direction.x * speed + spread;
      const dy = direction.y * speed + (random() - 0.5) * config.impactSpread;
      const size = config.impactSizeMin + random() * config.impactSizeRange;
      const lifeMs = config.impactLifeMinMs + random() * config.impactLifeRangeMs;
      spawn("spark", particleStyle({
        x: baseX + (random() - 0.5) * marble.r * config.impactJitterRatio,
        y: baseY + (random() - 0.5) * marble.r * config.impactJitterRatio,
        dx,
        dy,
        size,
        lifeMs,
        opacity: config.impactOpacity
      }), lifeMs);
    }
  }

  function spawnSurface(speed, now) {
    if (speed < config.surfaceMinSpeed || now - lastSurfaceAt < config.surfaceCooldownMs) return;

    lastSurfaceAt = now;
    const direction = velocityUnit(marble);
    const sideways = { x: -direction.y, y: direction.x };
    const intensity = clamp(speed / config.surfaceReferenceSpeed, 0, 1);
    const count = Math.round(config.surfaceMinParticles + intensity * config.surfaceExtraParticles);

    for (let i = 0; i < count; i++) {
      const offset = (random() - 0.5) * marble.r * config.surfaceWidthRatio;
      const lift = config.surfaceLiftMin + random() * config.surfaceLiftRange;
      const lifeMs = config.surfaceLifeMinMs + random() * config.surfaceLifeRangeMs;
      spawn("dust", particleStyle({
        x: marble.x - direction.x * marble.r * config.surfaceBackRatio + sideways.x * offset,
        y: marble.y - direction.y * marble.r * config.surfaceBackRatio + sideways.y * offset,
        dx: -direction.x * (config.surfaceDriftMin + random() * config.surfaceDriftRange) + sideways.x * offset * config.surfaceScatter,
        dy: -direction.y * (config.surfaceDriftMin + random() * config.surfaceDriftRange) + sideways.y * offset * config.surfaceScatter - lift,
        size: config.surfaceSizeMin + random() * config.surfaceSizeRange,
        lifeMs,
        opacity: config.surfaceOpacity
      }), lifeMs);
    }
  }

  function clear() {
    effectsEl.replaceChildren();
    lastImpactAt = Number.NEGATIVE_INFINITY;
    lastSurfaceAt = 0;
  }

  return {
    clear,
    spawnImpact,
    spawnSurface
  };
}
