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

function kitchenFixtureClass(rect) {
  const aspect = rect.w / rect.h;
  if (aspect >= 2.5 || aspect <= 0.4) return "kitchenCabinetRun";
  if (rect.w >= 500 || rect.h >= 500) return "kitchenApplianceBlock";
  return "kitchenTableBlock";
}

function isForkFixture(rect) {
  return (
    rect.fixture === "forkHandle" ||
    rect.fixture === "forkNeck" ||
    rect.fixture === "forkTine"
  );
}

function appendKitchenForkSprite(layer, forkParts) {
  if (forkParts.length === 0) return;

  const sprite = document.createElement("div");
  const bounds = rectBounds(forkParts);
  const visualWidth = Math.max(bounds.width, 760);
  const visualHeight = Math.max(bounds.height, 98);

  sprite.className = "kitchenForkSprite";
  applyRectStyle(sprite, {
    x: bounds.left + bounds.width / 2 - visualWidth / 2,
    y: bounds.top + bounds.height / 2 - visualHeight / 2,
    w: visualWidth,
    h: visualHeight,
  });
  layer.appendChild(sprite);
}

function renderKitchenObstacleWalls(container, obstacles) {
  const layer = document.createElement("div");
  const obstacleGroups = connectedRectGroups(obstacles);
  const forkParts = obstacles.filter(isForkFixture);

  layer.className = "kitchenObstacleLayer";
  layer.setAttribute("aria-hidden", "true");
  layer.setAttribute("data-wall-groups", String(obstacleGroups.length));
  obstacles
    .filter((rect) => !isForkFixture(rect))
    .forEach((rect) => {
      const fixture = document.createElement("div");
      fixture.className = "kitchenObstacle " + kitchenFixtureClass(rect);
      applyRectStyle(fixture, rect);
      layer.appendChild(fixture);
    });
  appendKitchenForkSprite(layer, forkParts);
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
