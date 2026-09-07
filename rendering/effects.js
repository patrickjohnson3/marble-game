import { clamp, pointInEllipsePatch } from "../core/geometry.js";
import {
  ELLIPTICAL_SURFACE_SHAPES,
  MAP_ELEMENT_TYPES,
} from "../core/map-elements.js";
import { traceLiquidPatchPath } from "./liquid-patch-shape.js";

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

function configureCanvas(canvas, region, scale) {
  canvas.className = "effectsCanvas";
  const pixelWidth = Math.ceil(region.width * scale);
  const pixelHeight = Math.ceil(region.height * scale);
  if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
  if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
  canvas.style.left = region.left + "px";
  canvas.style.top = region.top + "px";
  canvas.style.width = region.width + "px";
  canvas.style.height = region.height + "px";
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
  context.strokeStyle = "rgba(40, 93, 104, 0.32)";
  context.lineWidth = 2.8;
  context.beginPath();
  context.ellipse(
    particle.x,
    particle.y + 1,
    size / 2,
    size * 0.37,
    particle.angle,
    -Math.PI * 0.3,
    Math.PI * 1.3,
  );
  context.stroke();
  context.strokeStyle = "rgba(235, 255, 255, 0.88)";
  context.lineWidth = 1.5;
  context.beginPath();
  context.ellipse(
    particle.x,
    particle.y,
    size / 2,
    size * 0.37,
    particle.angle,
    -Math.PI * 0.28,
    Math.PI * 1.28,
  );
  context.stroke();
  context.globalAlpha = 1;
}

function drawGooWake(context, particle, progress) {
  const cos = Math.cos(particle.angle);
  const sin = Math.sin(particle.angle);
  const length = particle.size * (0.85 - progress * 0.25);
  context.save();
  context.transform(
    cos,
    sin,
    -sin,
    cos,
    particle.x + particle.dx * progress,
    particle.y + particle.dy * progress,
  );
  context.globalAlpha = particle.opacity * (1 - progress);
  context.lineCap = "round";
  context.strokeStyle = "rgba(29, 77, 28, 0.7)";
  context.lineWidth = particle.size * 0.23;
  context.beginPath();
  context.moveTo(-length * 0.55, 0);
  context.quadraticCurveTo(0, 3, length * 0.35, 0);
  context.stroke();
  context.strokeStyle = "rgba(204, 236, 142, 0.8)";
  context.lineWidth = 2.2;
  context.beginPath();
  context.moveTo(-length * 0.42, -2);
  context.quadraticCurveTo(0, 0, length * 0.3, -2);
  context.stroke();
  context.restore();
}

function clipLiquid(context, particle) {
  if (!particle.patch) return;
  const patch = particle.patch;
  traceLiquidPatchPath(context, patch, patch.type);
  context.clip();
}

function drawParticle(context, particle, progress) {
  context.save();
  clipLiquid(context, particle);
  if (particle.kind === "waterRipple") {
    drawWaterRipple(context, particle, progress);
  } else if (particle.kind === "gooSplat") {
    drawGooWake(context, particle, progress);
  } else if (particle.kind === "antFragment") {
    drawCircle(context, particle, progress, "#543a24");
  } else if (particle.kind === "celebrate") {
    drawCircle(context, particle, progress, "#88f7c5");
  } else {
    drawCircle(context, particle, progress, "#ffd166");
  }
  context.restore();
}

function resetDirtyBounds(bounds) {
  bounds.bottom = Number.NEGATIVE_INFINITY;
  bounds.left = Number.POSITIVE_INFINITY;
  bounds.right = Number.NEGATIVE_INFINITY;
  bounds.top = Number.POSITIVE_INFINITY;
}

function includeParticleBounds(bounds, particle, progress) {
  const size = particle.size * (0.7 + progress * 0.75);
  const radius =
    particle.kind === "gooSplat" ? particle.size * 0.7 + 4 : size / 2 + 4;
  const x =
    particle.kind === "waterRipple"
      ? particle.x
      : particle.x + particle.dx * progress;
  const y =
    particle.kind === "waterRipple"
      ? particle.y
      : particle.y + particle.dy * progress;

  bounds.bottom = Math.max(bounds.bottom, y + radius);
  bounds.left = Math.min(bounds.left, x - radius);
  bounds.right = Math.max(bounds.right, x + radius);
  bounds.top = Math.min(bounds.top, y - radius);
}

function clearDirtyBounds(context, canvas, bounds, region, scale) {
  if (!Number.isFinite(bounds.left)) return;

  const left = Math.max(0, Math.floor((bounds.left - region.left) * scale) - 1);
  const top = Math.max(0, Math.floor((bounds.top - region.top) * scale) - 1);
  const right = Math.min(
    canvas.width,
    Math.ceil((bounds.right - region.left) * scale) + 1,
  );
  const bottom = Math.min(
    canvas.height,
    Math.ceil((bounds.bottom - region.top) * scale) + 1,
  );
  if (right > left && bottom > top) {
    context.clearRect(left, top, right - left, bottom - top);
  }
}

function boundsFitRegion(bounds, region) {
  return (
    bounds.left >= region.left &&
    bounds.top >= region.top &&
    bounds.right <= region.left + region.width &&
    bounds.bottom <= region.top + region.height
  );
}

export function createEffectsRenderer({
  effectsEl,
  marble,
  mapState = null,
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
  const canvasWorldSize = config.canvasWorldSize ?? Number.POSITIVE_INFINITY;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  let currentWorld = world;
  const region = { left: 0, top: 0, width: 0, height: 0 };
  let currentDirtyBounds = {
    bottom: Number.NEGATIVE_INFINITY,
    left: Number.POSITIVE_INFINITY,
    right: Number.NEGATIVE_INFINITY,
    top: Number.POSITIVE_INFINITY,
  };
  let nextDirtyBounds = { ...currentDirtyBounds };
  let canvasDirty = false;

  function positionRegion(bounds = null, allowShrink = false) {
    const minimumWidth = Math.min(currentWorld.width, canvasWorldSize);
    const minimumHeight = Math.min(currentWorld.height, canvasWorldSize);
    const boundsWidth = bounds ? bounds.right - bounds.left : 0;
    const boundsHeight = bounds ? bounds.bottom - bounds.top : 0;
    region.width = Math.min(
      currentWorld.width,
      Math.max(allowShrink ? 0 : region.width, minimumWidth, boundsWidth),
    );
    region.height = Math.min(
      currentWorld.height,
      Math.max(allowShrink ? 0 : region.height, minimumHeight, boundsHeight),
    );
    const centerX = bounds
      ? (bounds.left + bounds.right) / 2
      : clamp(marble.x, 0, currentWorld.width);
    const centerY = bounds
      ? (bounds.top + bounds.bottom) / 2
      : clamp(marble.y, 0, currentWorld.height);
    region.left = clamp(
      centerX - region.width / 2,
      0,
      Math.max(0, currentWorld.width - region.width),
    );
    region.top = clamp(
      centerY - region.height / 2,
      0,
      Math.max(0, currentWorld.height - region.height),
    );
    configureCanvas(canvas, region, canvasScale);
  }

  positionRegion(null, true);
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
    const particle = {
      angle: 0,
      bornAt: currentTime,
      dx,
      dy,
      kind,
      lifeMs,
      opacity,
      size,
      x,
      y,
      patch: null,
    };
    activeParticles.push(particle);
    return particle;
  }

  function liquidAtMarble(type) {
    const patches = mapState?.terrainByType[type]?.elements;
    if (!patches) return null;
    const shape = ELLIPTICAL_SURFACE_SHAPES[type];
    for (const patch of patches) {
      if (pointInEllipsePatch(marble.x, marble.y, patch, shape, marble.r)) {
        return patch;
      }
    }
    return null;
  }

  function spawnAntSquish(ant) {
    const angle = ant.squishAngle ?? ant.angle;
    const strength = ant.squishStrength ?? 0.5;
    for (let i = 0; i < config.antSquishParticles; i++) {
      const scatter = angle + (random() - 0.5) * Math.PI * 1.6;
      const drift = config.antSquishDrift * (0.4 + strength * random());
      spawn(
        "antFragment",
        ant.x,
        ant.y,
        Math.cos(scatter) * drift,
        Math.sin(scatter) * drift,
        1.4 + random() * 1.8,
        config.antSquishLifeMs,
        0.65,
      );
    }
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

    const patch = liquidAtMarble(MAP_ELEMENT_TYPES.gooPatch);
    if (mapState && !patch) return;
    lastGooSplatAt = currentTime;
    const intensity = clamp(speed / config.gooSplatReferenceSpeed, 0, 1);
    setVelocityUnit(marble, direction);
    const particle = spawn(
      "gooSplat",
      marble.x - direction.x * marble.r * 0.65,
      marble.y - direction.y * marble.r * 0.65,
      -direction.x * 8,
      -direction.y * 8,
      config.gooSplatSizeBase + intensity * config.gooSplatSizeRange,
      config.gooSplatLifeMs,
      config.gooSplatOpacity,
    );
    particle.angle = Math.atan2(direction.y, direction.x);
    particle.patch = patch;
  }

  function spawnWaterRipple(speed) {
    const currentTime = now();
    if (
      speed < config.waterRippleMinSpeed ||
      currentTime - lastWaterRippleAt < config.waterRippleCooldownMs
    )
      return;

    const patch = liquidAtMarble(MAP_ELEMENT_TYPES.waterPatch);
    if (mapState && !patch) return;
    lastWaterRippleAt = currentTime;
    const intensity = clamp(speed / config.waterRippleReferenceSpeed, 0, 1);
    setVelocityUnit(marble, direction);
    const particle = spawn(
      "waterRipple",
      marble.x - direction.x * marble.r * 0.35,
      marble.y - direction.y * marble.r * 0.35,
      0,
      0,
      config.waterRippleSizeBase + intensity * config.waterRippleSizeRange,
      config.waterRippleLifeMs,
      config.waterRippleOpacity,
    );
    particle.angle = Math.atan2(direction.y, direction.x) + Math.PI / 2;
    particle.patch = patch;
  }

  function clear() {
    activeParticles.length = 0;
    if (context && canvasDirty) {
      context.setTransform(1, 0, 0, 1, 0, 0);
      clearDirtyBounds(
        context,
        canvas,
        currentDirtyBounds,
        region,
        canvasScale,
      );
    }
    resetDirtyBounds(currentDirtyBounds);
    resetDirtyBounds(nextDirtyBounds);
    canvasDirty = false;
    lastImpactAt = Number.NEGATIVE_INFINITY;
    lastGooSplatAt = Number.NEGATIVE_INFINITY;
    lastWaterRippleAt = Number.NEGATIVE_INFINITY;
  }

  function setWorld(nextWorld) {
    clear();
    currentWorld = nextWorld;
    positionRegion(null, true);
  }

  function render(currentTime = now()) {
    if (!context || (activeParticles.length === 0 && !canvasDirty)) return;

    prune(currentTime);
    if (activeParticles.length === 0 && !canvasDirty) return;

    if (activeParticles.length === 0) {
      if (canvasDirty) {
        context.setTransform(1, 0, 0, 1, 0, 0);
        clearDirtyBounds(
          context,
          canvas,
          currentDirtyBounds,
          region,
          canvasScale,
        );
      }
      resetDirtyBounds(currentDirtyBounds);
      canvasDirty = false;
      return;
    }

    resetDirtyBounds(nextDirtyBounds);
    for (let i = 0; i < activeParticles.length; i++) {
      const particle = activeParticles[i];
      const progress = clamp(
        (currentTime - particle.bornAt) / particle.lifeMs,
        0,
        1,
      );
      includeParticleBounds(nextDirtyBounds, particle, progress);
    }

    const regionChanged = !boundsFitRegion(nextDirtyBounds, region);
    context.setTransform(1, 0, 0, 1, 0, 0);
    if (regionChanged) {
      context.clearRect(0, 0, canvas.width, canvas.height);
      positionRegion(nextDirtyBounds);
    } else if (canvasDirty) {
      clearDirtyBounds(
        context,
        canvas,
        currentDirtyBounds,
        region,
        canvasScale,
      );
    }
    context.setTransform(
      canvasScale,
      0,
      0,
      canvasScale,
      -region.left * canvasScale,
      -region.top * canvasScale,
    );
    for (let i = 0; i < activeParticles.length; i++) {
      const particle = activeParticles[i];
      const progress = clamp(
        (currentTime - particle.bornAt) / particle.lifeMs,
        0,
        1,
      );
      drawParticle(context, particle, progress);
    }
    const previousDirtyBounds = currentDirtyBounds;
    currentDirtyBounds = nextDirtyBounds;
    nextDirtyBounds = previousDirtyBounds;
    canvasDirty = true;
  }

  return {
    activeCount: () => activeParticles.length,
    canvas,
    clear,
    render,
    setWorld,
    spawnAntSquish,
    spawnGooSplat,
    spawnGoalComplete,
    spawnImpact,
    spawnWaterRipple,
  };
}
