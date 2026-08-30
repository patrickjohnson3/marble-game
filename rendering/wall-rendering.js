import { rectBounds } from "../core/rect-bounds.js";

function configureCanvas(
  canvas,
  className,
  rects,
  padding = 0,
  bounds = rectBounds(rects),
) {
  const left = bounds.left - padding;
  const top = bounds.top - padding;
  const width = bounds.width + padding * 2;
  const height = bounds.height + padding * 2;
  const pixelRatio = canvasPixelRatio();

  canvas.classList.add(className);
  const pixelWidth = Math.ceil(width * pixelRatio);
  const pixelHeight = Math.ceil(height * pixelRatio);
  if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
  if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
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

  return { canvas, context, left, pixelRatio, top };
}

export function createCanvas(
  className,
  rects,
  padding = 0,
  bounds = rectBounds(rects),
) {
  return configureCanvas(
    document.createElement("canvas"),
    className,
    rects,
    padding,
    bounds,
  );
}

function canvasPixelRatio() {
  return Math.min(Math.max(1, globalThis.devicePixelRatio || 1), 2);
}

export function drawRoundedRect(context, rect, radius) {
  if (context.roundRect) {
    context.roundRect(rect.x, rect.y, rect.w, rect.h, radius);
    return;
  }
  context.rect(rect.x, rect.y, rect.w, rect.h);
}

export function renderPatchCanvas(
  container,
  patches,
  { bounds, className, dataAttribute, drawPatch, padding = 0 } = {},
) {
  if (!Array.isArray(patches) || patches.length === 0) {
    container.replaceChildren();
    return;
  }

  const existingCanvas = container.firstChild;
  const reuseCanvas = existingCanvas?.classList?.contains(className);
  const { canvas, context, left, pixelRatio, top } = reuseCanvas
    ? configureCanvas(existingCanvas, className, patches, padding, bounds)
    : createCanvas(className, patches, padding, bounds);
  canvas.setAttribute(dataAttribute, String(patches.length));
  if (context) {
    if (reuseCanvas) {
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.setTransform(
        pixelRatio,
        0,
        0,
        pixelRatio,
        -left * pixelRatio,
        -top * pixelRatio,
      );
    }
    patches.forEach((patch) => drawPatch(context, patch));
  }
  if (!reuseCanvas) container.replaceChildren(canvas);
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

  const existingFrame = container.firstChild;
  const frameElement =
    existingFrame?.className === "wallFrame"
      ? existingFrame
      : document.createElement("div");
  frameElement.className = "wallFrame";
  frameElement.style.left = frame.left + "px";
  frameElement.style.top = frame.top + "px";
  frameElement.style.width = frame.right - frame.left + "px";
  frameElement.style.height = frame.bottom - frame.top + "px";
  frameElement.style.setProperty("--wall-thickness", frame.thickness + "px");
  frameElement.setAttribute("aria-hidden", "true");
  if (frameElement !== existingFrame) container.replaceChildren(frameElement);
}
