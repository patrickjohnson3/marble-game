import { createCanvas, rectBounds } from "./wall-rendering.js";
import { KITCHEN_FIXTURES } from "../core/map-elements.js";

function rectPath(x, y, w, h) {
  return "M" + x + " " + y + "H" + (x + w) + "V" + (y + h) + "H" + x + "Z";
}

function coveredByAny(rects, left, top, right, bottom) {
  return rects.some(
    (rect) =>
      left >= rect.x &&
      right <= rect.x + rect.w &&
      top >= rect.y &&
      bottom <= rect.y + rect.h,
  );
}

function rectsTouchOrOverlap(a, b) {
  return (
    a.x <= b.x + b.w && b.x <= a.x + a.w && a.y <= b.y + b.h && b.y <= a.y + a.h
  );
}

function connectedRectGroups(rects) {
  const remaining = [...rects];
  const groups = [];

  while (remaining.length > 0) {
    const group = [remaining.shift()];
    for (let index = 0; index < group.length; index++) {
      for (let candidate = remaining.length - 1; candidate >= 0; candidate--) {
        if (!rectsTouchOrOverlap(group[index], remaining[candidate])) continue;
        group.push(remaining.splice(candidate, 1)[0]);
      }
    }
    groups.push(group);
  }

  return groups;
}

function mergedRectGeometry(rects) {
  const xs = [
    ...new Set(rects.flatMap((rect) => [rect.x, rect.x + rect.w])),
  ].sort((a, b) => a - b);
  const ys = [
    ...new Set(rects.flatMap((rect) => [rect.y, rect.y + rect.h])),
  ].sort((a, b) => a - b);
  const covered = [];
  const fillRects = [];
  const outlineSegments = [];
  let fill = "";
  let outline = "";

  for (let y = 0; y < ys.length - 1; y++) {
    covered[y] = [];
    for (let x = 0; x < xs.length - 1; x++) {
      covered[y][x] = coveredByAny(rects, xs[x], ys[y], xs[x + 1], ys[y + 1]);
      if (covered[y][x]) {
        const rect = {
          x: xs[x],
          y: ys[y],
          w: xs[x + 1] - xs[x],
          h: ys[y + 1] - ys[y],
        };
        fillRects.push(rect);
        fill += rectPath(rect.x, rect.y, rect.w, rect.h);
      }
    }
  }

  for (let y = 0; y < ys.length - 1; y++) {
    for (let x = 0; x < xs.length - 1; x++) {
      if (!covered[y][x]) continue;

      const left = xs[x];
      const right = xs[x + 1];
      const top = ys[y];
      const bottom = ys[y + 1];
      if (!covered[y - 1]?.[x]) {
        outlineSegments.push({ x1: left, y1: top, x2: right, y2: top });
        outline += "M" + left + " " + top + "H" + right;
      }
      if (!covered[y + 1]?.[x]) {
        outlineSegments.push({ x1: left, y1: bottom, x2: right, y2: bottom });
        outline += "M" + left + " " + bottom + "H" + right;
      }
      if (!covered[y]?.[x - 1]) {
        outlineSegments.push({ x1: left, y1: top, x2: left, y2: bottom });
        outline += "M" + left + " " + top + "V" + bottom;
      }
      if (!covered[y]?.[x + 1]) {
        outlineSegments.push({ x1: right, y1: top, x2: right, y2: bottom });
        outline += "M" + right + " " + top + "V" + bottom;
      }
    }
  }

  return { fill, fillRects, outline, outlineSegments };
}

function drawFillRects(context, rects) {
  context.beginPath();
  rects.forEach((rect) => context.rect(rect.x, rect.y, rect.w, rect.h));
}

function drawObstacleGroup(context, group) {
  const { bottom, left, right, top } = rectBounds(group);
  const geometry = mergedRectGeometry(group);
  const fill = context.createLinearGradient(left, top, right, bottom);

  fill.addColorStop(0, "#ffd166");
  fill.addColorStop(0.46, "#ff9f66");
  fill.addColorStop(1, "#ef476f");

  context.save();
  context.shadowColor = "rgba(0,0,0,.55)";
  context.shadowBlur = 18;
  context.shadowOffsetY = 14;
  context.fillStyle = fill;
  drawFillRects(context, geometry.fillRects);
  context.fill();
  context.restore();
}

function drawObstacleOutline(context, obstacles) {
  const geometry = mergedRectGeometry(obstacles);

  context.save();
  context.beginPath();
  geometry.outlineSegments.forEach((segment) => {
    context.moveTo(segment.x1, segment.y1);
    context.lineTo(segment.x2, segment.y2);
  });
  context.strokeStyle = "rgba(255,255,255,.27)";
  context.lineWidth = 1;
  context.lineJoin = "miter";
  context.stroke();
  context.restore();
}

function hitboxCorners(rect) {
  const width = rect.hitboxW ?? rect.w;
  const height = rect.hitboxH ?? rect.h;
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const centerX = rect.x + rect.w / 2;
  const centerY = rect.y + rect.h / 2;
  const angle = rect.angle ?? 0;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  return [
    { x: -halfWidth, y: -halfHeight },
    { x: halfWidth, y: -halfHeight },
    { x: halfWidth, y: halfHeight },
    { x: -halfWidth, y: halfHeight },
  ].map((point) => ({
    x: centerX + point.x * cos - point.y * sin,
    y: centerY + point.x * sin + point.y * cos,
  }));
}

function drawHitbox(context, rect) {
  const corners = hitboxCorners(rect);

  context.beginPath();
  context.moveTo(corners[0].x, corners[0].y);
  for (let i = 1; i < corners.length; i++) {
    context.lineTo(corners[i].x, corners[i].y);
  }
  context.lineTo(corners[0].x, corners[0].y);
  context.stroke();
}

function applyRectStyle(element, rect) {
  element.style.left = rect.x + "px";
  element.style.top = rect.y + "px";
  element.style.width = rect.w + "px";
  element.style.height = rect.h + "px";
}

function isForkFixture(rect) {
  return rect.fixture === KITCHEN_FIXTURES.fork;
}

function isSpongeFixture(rect) {
  return rect.fixture === KITCHEN_FIXTURES.sponge;
}

function isSpoonFixture(rect) {
  return rect.fixture === KITCHEN_FIXTURES.spoon;
}

function appendKitchenFixtureSprite(
  layer,
  parts,
  className,
  minWidth,
  minHeight,
) {
  let sprite = layer.children
    ? Array.from(layer.children).find((child) => child.className === className)
    : null;
  if (parts.length === 0) {
    sprite?.remove();
    return null;
  }

  const isNew = !sprite;
  sprite ??= document.createElement("div");
  const bounds = rectBounds(parts);
  const fixture = parts[0];
  const visualWidth = Math.max(fixture.hitboxW ?? bounds.width, minWidth);
  const visualHeight = Math.max(fixture.hitboxH ?? bounds.height, minHeight);

  sprite.className = className;
  applyRectStyle(sprite, {
    x: bounds.left + bounds.width / 2 - visualWidth / 2,
    y: bounds.top + bounds.height / 2 - visualHeight / 2,
    w: visualWidth,
    h: visualHeight,
  });
  if (Number.isFinite(fixture.angle)) {
    sprite.style.setProperty("--fixture-angle", fixture.angle + "rad");
  }
  if (isNew) layer.appendChild(sprite);
  return sprite;
}

function appendKitchenForkSprite(layer, forkParts) {
  appendKitchenFixtureSprite(layer, forkParts, "kitchenForkSprite", 760, 110);
}

function appendKitchenSpongeSprite(layer, spongeParts) {
  const sprite = appendKitchenFixtureSprite(
    layer,
    spongeParts,
    "kitchenSpongeSprite",
    500,
    145,
  );
  if (!sprite) return;

  const saturation = Math.max(0, Math.min(1, spongeParts[0].saturation ?? 0));
  sprite.style.setProperty(
    "--sponge-brightness",
    (1 - saturation * 0.2).toFixed(3),
  );
  sprite.style.setProperty(
    "--sponge-color",
    (1 - saturation * 0.35).toFixed(3),
  );
  sprite.style.setProperty(
    "--sponge-scale",
    (1 + saturation * 0.04).toFixed(3),
  );
}

function appendKitchenSpoonSprite(layer, spoonParts) {
  appendKitchenFixtureSprite(layer, spoonParts, "kitchenSpoonSprite", 620, 150);
}

function renderKitchenObstacleWalls(container, obstacles) {
  let layer = container.firstChild;
  if (!layer || layer.className !== "kitchenObstacleLayer") {
    layer = document.createElement("div");
    layer.className = "kitchenObstacleLayer";
    layer.setAttribute("aria-hidden", "true");
    container.replaceChildren(layer);
  }
  const forkParts = obstacles.filter(isForkFixture);
  const spongeParts = obstacles.filter(isSpongeFixture);
  const spoonParts = obstacles.filter(isSpoonFixture);

  layer.setAttribute(
    "data-fixtures",
    String(forkParts.length + spongeParts.length + spoonParts.length),
  );
  appendKitchenForkSprite(layer, forkParts);
  appendKitchenSpongeSprite(layer, spongeParts);
  appendKitchenSpoonSprite(layer, spoonParts);
}

export function renderObstacleHitboxes(
  container,
  obstacles,
  { bounds, padding = 0 } = {},
) {
  if (obstacles.length === 0) {
    container.replaceChildren();
    return;
  }

  const { canvas, context } = createCanvas(
    "hitboxCanvas",
    obstacles,
    padding,
    bounds,
  );

  canvas.setAttribute("data-hitboxes", String(obstacles.length));
  if (context) {
    context.save();
    context.strokeStyle = "rgba(143, 247, 197, .9)";
    context.lineWidth = 3;
    context.setLineDash?.([16, 10]);
    obstacles.forEach((obstacle) => drawHitbox(context, obstacle));
    context.restore();
  }
  container.replaceChildren(canvas);
}

export function renderObstacleWalls(
  container,
  obstacles,
  { bounds, mapConfig, padding = 0 } = {},
) {
  if (obstacles.length === 0) {
    container.replaceChildren();
    return;
  }
  if (mapConfig?.theme === "kitchenFloor") {
    renderKitchenObstacleWalls(container, obstacles);
    return;
  }

  const { canvas, context } = createCanvas(
    "obstacleCanvas",
    obstacles,
    padding,
    bounds,
  );
  const obstacleGroups = connectedRectGroups(obstacles);

  canvas.setAttribute("data-wall-groups", String(obstacleGroups.length));
  if (context) {
    obstacleGroups.forEach((group) => drawObstacleGroup(context, group));
    drawObstacleOutline(context, obstacles);
  }
  container.replaceChildren(canvas);
}
