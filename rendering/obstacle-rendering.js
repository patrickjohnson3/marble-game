import { createCanvas, rectBounds } from "./wall-rendering.js";

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

function applyRectStyle(element, rect) {
  element.style.left = rect.x + "px";
  element.style.top = rect.y + "px";
  element.style.width = rect.w + "px";
  element.style.height = rect.h + "px";
}

function isForkFixture(rect) {
  return rect.fixture === "fork";
}

function isSpongeFixture(rect) {
  return rect.fixture === "sponge";
}

function isSpoonFixture(rect) {
  return rect.fixture === "spoon";
}

function appendKitchenFixtureSprite(
  layer,
  parts,
  className,
  minWidth,
  minHeight,
) {
  if (parts.length === 0) return null;

  const sprite = document.createElement("div");
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
  layer.appendChild(sprite);
  return sprite;
}

function appendKitchenForkSprite(layer, forkParts) {
  appendKitchenFixtureSprite(layer, forkParts, "kitchenForkSprite", 760, 110);
}

function appendKitchenSpongeSprite(layer, spongeParts) {
  appendKitchenFixtureSprite(
    layer,
    spongeParts,
    "kitchenSpongeSprite",
    500,
    145,
  );
}

function appendKitchenSpoonSprite(layer, spoonParts) {
  appendKitchenFixtureSprite(layer, spoonParts, "kitchenSpoonSprite", 620, 150);
}

function renderKitchenObstacleWalls(container, obstacles) {
  const layer = document.createElement("div");
  const forkParts = obstacles.filter(isForkFixture);
  const spongeParts = obstacles.filter(isSpongeFixture);
  const spoonParts = obstacles.filter(isSpoonFixture);

  layer.className = "kitchenObstacleLayer";
  layer.setAttribute("aria-hidden", "true");
  layer.setAttribute(
    "data-fixtures",
    String(forkParts.length + spongeParts.length + spoonParts.length),
  );
  appendKitchenForkSprite(layer, forkParts);
  appendKitchenSpongeSprite(layer, spongeParts);
  appendKitchenSpoonSprite(layer, spoonParts);
  container.replaceChildren(layer);
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
