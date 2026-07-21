import { createTimeoutRegistry } from "../core/timer-utils.js";

function particleStyle(x, y, dx, dy, size, lifeMs, opacity) {
  return (
    "--x:" +
    x.toFixed(1) +
    "px;--y:" +
    y.toFixed(1) +
    "px;--dx:" +
    dx.toFixed(1) +
    "px;--dy:" +
    dy.toFixed(1) +
    "px;--size:" +
    size.toFixed(1) +
    "px;--life:" +
    lifeMs.toFixed(0) +
    "ms;--opacity:" +
    opacity.toFixed(2)
  );
}

function setVelocityUnit(marble, target) {
  const speed = Math.hypot(marble.vx, marble.vy);
  if (speed <= 0.001) {
    target.x = 0;
    target.y = -1;
    return;
  }

  target.x = marble.vx / speed;
  target.y = marble.vy / speed;
}

export function createEffectsRenderer({
  effectsEl,
  marble,
  config,
  clamp,
  random = Math.random,
  now = () => performance.now(),
}) {
  let lastImpactAt = Number.NEGATIVE_INFINITY;
  let lastSurfaceAt = 0;
  const direction = { x: 0, y: -1 };
  const sideways = { x: 1, y: 0 };
  const cleanupTimers = createTimeoutRegistry();

  function spawn(className, style, lifeMs) {
    while (effectsEl.childNodes.length >= config.maxParticles) {
      effectsEl.firstChild.remove();
    }
    const particle = document.createElement("i");
    particle.className = "effectParticle " + className;
    particle.setAttribute("aria-hidden", "true");
    particle.style.cssText = style;
    effectsEl.appendChild(particle);
    cleanupTimers.schedule(() => {
      particle.remove();
    }, lifeMs);
  }

  function spawnImpact(impact) {
    if (impact < config.impactMin) return;
    const currentTime = now();
    if (currentTime - lastImpactAt < config.impactCooldownMs) return;
    lastImpactAt = currentTime;

    const intensity = clamp(impact / config.impactReference, 0, 1);
    const count = Math.round(
      config.impactMinParticles + intensity * config.impactExtraParticles,
    );
    setVelocityUnit(marble, direction);
    const baseX = marble.x + direction.x * marble.r * config.impactEdgeRatio;
    const baseY = marble.y + direction.y * marble.r * config.impactEdgeRatio;

    for (let i = 0; i < count; i++) {
      const spread = (random() - 0.5) * config.impactSpread;
      const speed = config.impactDriftMin + random() * config.impactDriftRange;
      const dx = direction.x * speed + spread;
      const dy = direction.y * speed + (random() - 0.5) * config.impactSpread;
      const size = config.impactSizeMin + random() * config.impactSizeRange;
      const lifeMs =
        config.impactLifeMinMs + random() * config.impactLifeRangeMs;
      spawn(
        "spark",
        particleStyle(
          baseX + (random() - 0.5) * marble.r * config.impactJitterRatio,
          baseY + (random() - 0.5) * marble.r * config.impactJitterRatio,
          dx,
          dy,
          size,
          lifeMs,
          config.impactOpacity,
        ),
        lifeMs,
      );
    }
  }

  function spawnSurface(speed, now) {
    if (
      speed < config.surfaceMinSpeed ||
      now - lastSurfaceAt < config.surfaceCooldownMs
    )
      return;

    lastSurfaceAt = now;
    setVelocityUnit(marble, direction);
    sideways.x = -direction.y;
    sideways.y = direction.x;
    const intensity = clamp(speed / config.surfaceReferenceSpeed, 0, 1);
    const count = Math.round(
      config.surfaceMinParticles + intensity * config.surfaceExtraParticles,
    );

    for (let i = 0; i < count; i++) {
      const offset = (random() - 0.5) * marble.r * config.surfaceWidthRatio;
      const lift = config.surfaceLiftMin + random() * config.surfaceLiftRange;
      const lifeMs =
        config.surfaceLifeMinMs + random() * config.surfaceLifeRangeMs;
      spawn(
        "dust",
        particleStyle(
          marble.x -
            direction.x * marble.r * config.surfaceBackRatio +
            sideways.x * offset,
          marble.y -
            direction.y * marble.r * config.surfaceBackRatio +
            sideways.y * offset,
          -direction.x *
            (config.surfaceDriftMin + random() * config.surfaceDriftRange) +
            sideways.x * offset * config.surfaceScatter,
          -direction.y *
            (config.surfaceDriftMin + random() * config.surfaceDriftRange) +
            sideways.y * offset * config.surfaceScatter -
            lift,
          config.surfaceSizeMin + random() * config.surfaceSizeRange,
          lifeMs,
          config.surfaceOpacity,
        ),
        lifeMs,
      );
    }
  }

  function spawnGoalComplete() {
    for (let i = 0; i < config.goalCompleteParticles; i++) {
      const angle = (Math.PI * 2 * i) / config.goalCompleteParticles;
      const drift =
        config.goalCompleteDriftMin + random() * config.goalCompleteDriftRange;
      const size =
        config.goalCompleteSizeMin + random() * config.goalCompleteSizeRange;
      const lifeMs = config.goalCompleteLifeMs;

      spawn(
        "celebrate",
        particleStyle(
          marble.x + Math.cos(angle) * marble.r * 0.4,
          marble.y + Math.sin(angle) * marble.r * 0.4,
          Math.cos(angle) * drift,
          Math.sin(angle) * drift,
          size,
          lifeMs,
          config.goalCompleteOpacity,
        ),
        lifeMs,
      );
    }
  }

  function clear() {
    cleanupTimers.clearAll();
    effectsEl.replaceChildren();
    lastImpactAt = Number.NEGATIVE_INFINITY;
    lastSurfaceAt = 0;
  }

  return {
    clear,
    spawnGoalComplete,
    spawnImpact,
    spawnSurface,
  };
}
