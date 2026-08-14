import { rectBounds } from "../core/rect-bounds.js";

function createCanvas(
  className,
  rects,
  padding = 0,
  bounds = rectBounds(rects),
) {
  const left = bounds.left - padding;
  const top = bounds.top - padding;
  const width = bounds.width + padding * 2;
  const height = bounds.height + padding * 2;
  const canvas = document.createElement("canvas");
  const pixelRatio = canvasPixelRatio();

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
    context.setTransform(
      pixelRatio,
      0,
      0,
      pixelRatio,
      -left * pixelRatio,
      -top * pixelRatio,
    );
  }

  return { canvas, context };
}

function canvasPixelRatio() {
  return Math.min(Math.max(1, globalThis.devicePixelRatio || 1), 2);
}

function drawRoundedRect(context, rect, radius) {
  if (context.roundRect) {
    context.roundRect(rect.x, rect.y, rect.w, rect.h, radius);
    return;
  }
  context.rect(rect.x, rect.y, rect.w, rect.h);
}

function renderPatchCanvas(
  container,
  patches,
  { bounds, className, dataAttribute, drawPatch, padding = 0 } = {},
) {
  if (!Array.isArray(patches) || patches.length === 0) {
    container.replaceChildren();
    return;
  }

  const { canvas, context } = createCanvas(className, patches, padding, bounds);
  canvas.setAttribute(dataAttribute, String(patches.length));
  if (context) patches.forEach((patch) => drawPatch(context, patch));
  container.replaceChildren(canvas);
}

function wallFrameGeometry(walls) {
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
  const thickness = Math.max(
    innerLeft - left,
    innerTop - top,
    right - innerRight,
    bottom - innerBottom,
  );
  if (
    ![
      left,
      top,
      right,
      bottom,
      innerLeft,
      innerRight,
      innerTop,
      innerBottom,
      thickness,
    ].every(Number.isFinite)
  ) {
    return null;
  }
  if (
    right <= left ||
    bottom <= top ||
    innerRight <= innerLeft ||
    innerBottom <= innerTop
  )
    return null;

  return {
    bottom,
    innerBottom,
    innerLeft,
    innerRight,
    innerTop,
    left,
    right,
    thickness,
    top,
  };
}

function wallFrameStrips(frame) {
  return [
    {
      edge: "top",
      x: frame.left,
      y: frame.top,
      w: frame.right - frame.left,
      h: frame.innerTop - frame.top,
    },
    {
      edge: "bottom",
      x: frame.left,
      y: frame.innerBottom,
      w: frame.right - frame.left,
      h: frame.bottom - frame.innerBottom,
    },
    {
      edge: "left",
      x: frame.left,
      y: frame.innerTop,
      w: frame.innerLeft - frame.left,
      h: frame.innerBottom - frame.innerTop,
    },
    {
      edge: "right",
      x: frame.innerRight,
      y: frame.innerTop,
      w: frame.right - frame.innerRight,
      h: frame.innerBottom - frame.innerTop,
    },
  ].filter((strip) => strip.w > 0 && strip.h > 0);
}

function drawWallStrip(context, frame, strip) {
  const fill = context.createLinearGradient(
    frame.left,
    frame.top,
    frame.right,
    frame.bottom,
  );

  fill.addColorStop(0, "#f2f6fd");
  fill.addColorStop(0.48, "#d8e2f0");
  fill.addColorStop(1, "#a9b7cc");

  context.save();
  context.fillStyle = fill;
  context.fillRect(strip.x, strip.y, strip.w, strip.h);
  context.restore();

  context.save();
  context.strokeStyle = "rgba(255,255,255,.67)";
  context.lineWidth = 3;
  context.strokeRect(
    frame.left,
    frame.top,
    frame.right - frame.left,
    frame.bottom - frame.top,
  );
  context.strokeRect(
    frame.innerLeft,
    frame.innerTop,
    frame.innerRight - frame.innerLeft,
    frame.innerBottom - frame.innerTop,
  );
  context.restore();
}

export function renderOuterWalls(container, walls) {
  if (!Array.isArray(walls) || walls.length === 0) {
    container.replaceChildren();
    return;
  }
  const frame = wallFrameGeometry(walls);
  if (!frame) {
    container.replaceChildren();
    return;
  }

  const canvases = wallFrameStrips(frame).map((strip) => {
    const { canvas, context } = createCanvas("wallCanvas", [strip]);
    canvas.setAttribute("data-wall-edge", strip.edge);
    if (context) drawWallStrip(context, frame, strip);
    return canvas;
  });
  container.replaceChildren(...canvases);
}

export { createCanvas, drawRoundedRect, rectBounds, renderPatchCanvas };
