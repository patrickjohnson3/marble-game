import { clamp } from "../core/geometry.js";

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

function configureCanvas(canvas, world, scale) {
  canvas.className = "effectsCanvas";
  canvas.width = Math.ceil(world.width * scale);
  canvas.height = Math.ceil(world.height * scale);
  canvas.style.left = "0px";
  canvas.style.top = "0px";
  canvas.style.width = world.width + "px";
  canvas.style.height = world.height + "px";
  canvas.setAttribute("aria-hidden", "true");
}

function drawCircle(context, particle, progress, color) {
  const fade = 1 - progress;
  const size = particle.size * (0.7 + progress * 0.75);

  context.globalAlpha = particle.opacity * fade;
  context.fillStyle = color;
  context.beginPath();
  context.ellipse(
    particle.x + particle.dx * progress,
    particle.y + particle.dy * progress,
    size / 2,
    size / 2,
    0,
    0,
    Math.PI * 2,
  );
  context.fill();
  context.globalAlpha = 1;
}

function drawWaterRipple(context, particle, progress) {
  const fade = 1 - progress;
  const size = particle.size * (0.7 + progress * 0.75);

  context.globalAlpha = particle.opacity * fade;
  context.strokeStyle = "rgba(205, 247, 255, 0.72)";
  context.lineWidth = 3;
  context.beginPath();
  context.ellipse(
    particle.x,
    particle.y,
    size / 2,
    size / 2,
    0,
    0,
    Math.PI * 2,
  );
  context.stroke();
  context.globalAlpha = 1;
}

function drawParticle(context, particle, progress) {
  if (particle.kind === "waterRipple") {
    drawWaterRipple(context, particle, progress);
  } else if (particle.kind === "gooSplat") {
    drawCircle(context, particle, progress, "#80e93a");
  } else if (particle.kind === "celebrate") {
    drawCircle(context, particle, progress, "#88f7c5");
  } else {
    drawCircle(context, particle, progress, "#ffd166");
  }
}

export function createEffectsRenderer({
  effectsEl,
  marble,
  config,
  random = Math.random,
  now = () => performance.now(),
  world = { width: 0, height: 0 },
}) {
  let lastImpactAt = Number.NEGATIVE_INFINITY;
  let lastGooSplatAt = Number.NEGATIVE_INFINITY;
  let lastWaterRippleAt = Number.NEGATIVE_INFINITY;
  const activeParticles = [];
  const direction = { x: 0, y: -1 };
  const canvasScale = config.canvasScale ?? 0.5;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  let canvasDirty = false;

  configureCanvas(canvas, world, canvasScale);
  effectsEl.replaceChildren(canvas);

  function prune(currentTime) {
    for (let i = activeParticles.length - 1; i >= 0; i--) {
      const particle = activeParticles[i];
      if (currentTime - particle.bornAt < particle.lifeMs) continue;

      activeParticles.splice(i, 1);
    }
  }

  function spawn(kind, x, y, dx, dy, size, lifeMs, opacity) {
    const currentTime = now();
    while (activeParticles.length >= config.maxParticles) {
      activeParticles.shift();
    }
    activeParticles.push({
      bornAt: currentTime,
      dx,
      dy,
      kind,
      lifeMs,
      opacity,
      size,
      x,
      y,
    });
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
      spawn(
        "spark",
        baseX + (random() - 0.5) * marble.r * config.impactJitterRatio,
        baseY + (random() - 0.5) * marble.r * config.impactJitterRatio,
        direction.x * speed + spread,
        direction.y * speed + (random() - 0.5) * config.impactSpread,
        config.impactSizeMin + random() * config.impactSizeRange,
        config.impactLifeMinMs + random() * config.impactLifeRangeMs,
        config.impactOpacity,
      );
    }
  }

  function spawnGoalComplete() {
    for (let i = 0; i < config.goalCompleteParticles; i++) {
      const angle = (Math.PI * 2 * i) / config.goalCompleteParticles;
      const drift =
        config.goalCompleteDriftMin + random() * config.goalCompleteDriftRange;

      spawn(
        "celebrate",
        marble.x + Math.cos(angle) * marble.r * 0.4,
        marble.y + Math.sin(angle) * marble.r * 0.4,
        Math.cos(angle) * drift,
        Math.sin(angle) * drift,
        config.goalCompleteSizeMin + random() * config.goalCompleteSizeRange,
        config.goalCompleteLifeMs,
        config.goalCompleteOpacity,
      );
    }
  }

  function spawnGooSplat(speed) {
    const currentTime = now();
    if (
      speed < config.gooSplatMinSpeed ||
      currentTime - lastGooSplatAt < config.gooSplatCooldownMs
    )
      return;

    lastGooSplatAt = currentTime;
    const intensity = clamp(speed / config.gooSplatReferenceSpeed, 0, 1);
    spawn(
      "gooSplat",
      marble.x + (random() - 0.5) * marble.r * 0.8,
      marble.y + (random() - 0.5) * marble.r * 0.8,
      (random() - 0.5) * 8,
      (random() - 0.5) * 8,
      config.gooSplatSizeBase + intensity * config.gooSplatSizeRange,
      config.gooSplatLifeMs,
      config.gooSplatOpacity,
    );
  }

  function spawnWaterRipple(speed) {
    const currentTime = now();
    if (
      speed < config.waterRippleMinSpeed ||
      currentTime - lastWaterRippleAt < config.waterRippleCooldownMs
    )
      return;

    lastWaterRippleAt = currentTime;
    const intensity = clamp(speed / config.waterRippleReferenceSpeed, 0, 1);
    spawn(
      "waterRipple",
      marble.x,
      marble.y,
      0,
      0,
      config.waterRippleSizeBase + intensity * config.waterRippleSizeRange,
      config.waterRippleLifeMs,
      config.waterRippleOpacity,
    );
  }

  function clear() {
    activeParticles.length = 0;
    if (context && canvasDirty) {
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
    }
    canvasDirty = false;
    lastImpactAt = Number.NEGATIVE_INFINITY;
    lastGooSplatAt = Number.NEGATIVE_INFINITY;
    lastWaterRippleAt = Number.NEGATIVE_INFINITY;
  }

  function setWorld(nextWorld) {
    clear();
    configureCanvas(canvas, nextWorld, canvasScale);
  }

  function render(currentTime = now()) {
    if (!context || (activeParticles.length === 0 && !canvasDirty)) return;

    prune(currentTime);
    if (activeParticles.length === 0 && !canvasDirty) return;

    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (activeParticles.length === 0) {
      canvasDirty = false;
      return;
    }

    context.setTransform(canvasScale, 0, 0, canvasScale, 0, 0);
    for (let i = 0; i < activeParticles.length; i++) {
      const particle = activeParticles[i];
      drawParticle(
        context,
        particle,
        clamp((currentTime - particle.bornAt) / particle.lifeMs, 0, 1),
      );
    }
    canvasDirty = true;
  }

  return {
    activeCount: () => activeParticles.length,
    canvas,
    clear,
    render,
    setWorld,
    spawnGooSplat,
    spawnGoalComplete,
    spawnImpact,
    spawnWaterRipple,
  };
}
