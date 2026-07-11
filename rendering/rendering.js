function rectPath(x, y, w, h) {
  return "M" + x + " " + y + "H" + (x + w) + "V" + (y + h) + "H" + x + "Z";
}

function rectBounds(rects) {
  const left = Math.min(...rects.map((rect) => rect.x));
  const top = Math.min(...rects.map((rect) => rect.y));
  const right = Math.max(...rects.map((rect) => rect.x + rect.w));
  const bottom = Math.max(...rects.map((rect) => rect.y + rect.h));

  return {
    bottom,
    left,
    right,
    top,
    height: bottom - top,
    width: right - left
  };
}

function coveredByAny(rects, left, top, right, bottom) {
  return rects.some((rect) =>
    left >= rect.x &&
    right <= rect.x + rect.w &&
    top >= rect.y &&
    bottom <= rect.y + rect.h
  );
}

function rectsTouchOrOverlap(a, b) {
  return a.x <= b.x + b.w &&
    b.x <= a.x + a.w &&
    a.y <= b.y + b.h &&
    b.y <= a.y + a.h;
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
  const xs = [...new Set(rects.flatMap((rect) => [rect.x, rect.x + rect.w]))].sort((a, b) => a - b);
  const ys = [...new Set(rects.flatMap((rect) => [rect.y, rect.y + rect.h]))].sort((a, b) => a - b);
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
          h: ys[y + 1] - ys[y]
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

export function wallFrameGeometry(walls) {
  if (!Array.isArray(walls) || walls.length === 0) return null;

  const left = Math.min(...walls.map((wall) => wall.x));
  const top = Math.min(...walls.map((wall) => wall.y));
  const right = Math.max(...walls.map((wall) => wall.x + wall.w));
  const bottom = Math.max(...walls.map((wall) => wall.y + wall.h));
  const verticalWalls = walls.filter((wall) => wall.w < wall.h);
  const horizontalWalls = walls.filter((wall) => wall.w > wall.h);
  if (verticalWalls.length === 0 || horizontalWalls.length === 0) return null;

  const innerLeft = Math.min(...verticalWalls.map((wall) => wall.x + wall.w));
  const innerRight = Math.max(...verticalWalls.map((wall) => wall.x));
  const innerTop = Math.min(...horizontalWalls.map((wall) => wall.y + wall.h));
  const innerBottom = Math.max(...horizontalWalls.map((wall) => wall.y));
  const thickness = Math.max(innerLeft - left, innerTop - top, right - innerRight, bottom - innerBottom);
  if (![left, top, right, bottom, innerLeft, innerRight, innerTop, innerBottom, thickness].every(Number.isFinite)) {
    return null;
  }
  if (right <= left || bottom <= top || innerRight <= innerLeft || innerBottom <= innerTop) return null;

  return {
    bottom,
    innerBottom,
    innerLeft,
    innerRight,
    innerTop,
    left,
    right,
    thickness,
    top
  };
}

function createWallCanvas(className, rects) {
  const { height, left, top, width } = rectBounds(rects);
  const canvas = document.createElement("canvas");
  const pixelRatio = Math.max(1, globalThis.devicePixelRatio || 1);

  canvas.classList.add(className);
  canvas.width = Math.ceil(width * pixelRatio);
  canvas.height = Math.ceil(height * pixelRatio);
  canvas.style.left = left + "px";
  canvas.style.top = top + "px";
  canvas.style.width = width + "px";
  canvas.style.height = height + "px";
  canvas.setAttribute("aria-hidden", "true");

  const context = canvas.getContext?.("2d");
  if (context) {
    context.setTransform(pixelRatio, 0, 0, pixelRatio, -left * pixelRatio, -top * pixelRatio);
  }

  return { canvas, context };
}

function drawWallFrame(context, frame) {
  const width = frame.right - frame.left;
  const height = frame.bottom - frame.top;
  const fill = context.createLinearGradient(frame.left, frame.top, frame.right, frame.bottom);

  fill.addColorStop(0, "#f2f6fd");
  fill.addColorStop(0.48, "#d8e2f0");
  fill.addColorStop(1, "#a9b7cc");

  context.save();
  context.shadowColor = "rgba(0,0,0,.44)";
  context.shadowBlur = 12;
  context.shadowOffsetY = 8;
  context.fillStyle = fill;
  context.fillRect(frame.left, frame.top, width, height);
  context.clearRect(
    frame.innerLeft,
    frame.innerTop,
    frame.innerRight - frame.innerLeft,
    frame.innerBottom - frame.innerTop
  );
  context.restore();

  context.save();
  context.strokeStyle = "rgba(255,255,255,.67)";
  context.lineWidth = 3;
  context.strokeRect(frame.left, frame.top, width, height);
  context.strokeRect(
    frame.innerLeft,
    frame.innerTop,
    frame.innerRight - frame.innerLeft,
    frame.innerBottom - frame.innerTop
  );
  context.restore();
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

function patchDotOffset(x, y) {
  return (Math.imul(Math.round(x), 31) + Math.imul(Math.round(y), 17)) % 5;
}

function drawRoundedRect(context, rect, radius) {
  if (context.roundRect) {
    context.roundRect(rect.x, rect.y, rect.w, rect.h, radius);
    return;
  }
  context.rect(rect.x, rect.y, rect.w, rect.h);
}

function drawRoughPatch(context, patch) {
  const gradient = context.createLinearGradient(patch.x, patch.y, patch.x + patch.w, patch.y + patch.h);
  const radius = 10;

  gradient.addColorStop(0, "#8b8b84");
  gradient.addColorStop(1, "#5c5c58");

  context.save();
  context.shadowColor = "rgba(0,0,0,.24)";
  context.shadowBlur = 12;
  context.shadowOffsetY = 6;
  context.fillStyle = gradient;
  context.beginPath();
  drawRoundedRect(context, patch, radius);
  context.fill();
  context.restore();

  context.save();
  context.beginPath();
  drawRoundedRect(context, patch, radius);
  context.clip();
  context.fillStyle = "rgba(238,238,234,.82)";
  for (let y = patch.y + 6; y < patch.y + patch.h; y += 12) {
    for (let x = patch.x + 6; x < patch.x + patch.w; x += 12) {
      const offset = patchDotOffset(x, y);
      context.fillRect(x + offset * 0.3, y - offset * 0.2, 2, 2);
    }
  }
  context.restore();

  context.save();
  context.strokeStyle = "rgba(255,255,255,.13)";
  context.lineWidth = 2;
  context.beginPath();
  drawRoundedRect(context, patch, radius);
  context.stroke();
  context.restore();
}

export function renderWalls(container, walls) {
  if (!Array.isArray(walls) || walls.length === 0) {
    container.replaceChildren();
    return;
  }
  const frame = wallFrameGeometry(walls);
  if (!frame) {
    container.replaceChildren();
    return;
  }

  const { canvas, context } = createWallCanvas("wallCanvas", walls);
  if (context) drawWallFrame(context, frame);
  container.replaceChildren(canvas);
}

export function renderRoughPatches(container, roughPatches) {
  if (!Array.isArray(roughPatches) || roughPatches.length === 0) {
    container.replaceChildren();
    return;
  }

  const { canvas, context } = createWallCanvas("roughPatchCanvas", roughPatches);
  canvas.setAttribute("data-rough-patches", String(roughPatches.length));
  if (context) roughPatches.forEach((patch) => drawRoughPatch(context, patch));
  container.replaceChildren(canvas);
}

export function renderObstacleWalls(container, obstacles) {
  if (obstacles.length === 0) {
    container.replaceChildren();
    return;
  }

  const { canvas, context } = createWallCanvas("obstacleCanvas", obstacles);
  const obstacleGroups = connectedRectGroups(obstacles);

  canvas.setAttribute("data-wall-groups", String(obstacleGroups.length));
  if (context) {
    obstacleGroups.forEach((group) => drawObstacleGroup(context, group));
    drawObstacleOutline(context, obstacles);
  }
  container.replaceChildren(canvas);
}
