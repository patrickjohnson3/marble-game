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

function createCanvas(className, rects, padding = 0) {
  const bounds = rectBounds(rects);
  const left = bounds.left - padding;
  const top = bounds.top - padding;
  const width = bounds.width + padding * 2;
  const height = bounds.height + padding * 2;
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

  const { canvas, context } = createCanvas("wallCanvas", walls);
  if (context) drawWallFrame(context, frame);
  container.replaceChildren(canvas);
}

export { createCanvas, rectBounds };
