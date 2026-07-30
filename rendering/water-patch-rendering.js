import { createCanvas } from "./wall-rendering.js";

function drawWaterRipple(context, patch, xRatio, yRatio, radiusRatio, alpha) {
  const radius = Math.min(patch.w, patch.h) * radiusRatio;

  context.save();
  context.strokeStyle = "rgba(220,248,255," + alpha + ")";
  context.lineWidth = Math.max(2, radius * 0.08);
  context.beginPath();
  context.ellipse(
    patch.x + patch.w * xRatio,
    patch.y + patch.h * yRatio,
    radius,
    radius * 0.46,
    -0.18,
    0,
    Math.PI * 2,
  );
  context.stroke();
  context.restore();
}

function drawWaterPatch(context, patch) {
  const gradient = context.createLinearGradient(
    patch.x,
    patch.y,
    patch.x + patch.w,
    patch.y + patch.h,
  );
  const centerX = patch.x + patch.w * 0.5;
  const centerY = patch.y + patch.h * 0.52;
  const radiusX = patch.w * 0.5;
  const radiusY = patch.h * 0.47;

  gradient.addColorStop(0, "rgba(210,246,255,.56)");
  gradient.addColorStop(0.46, "rgba(93,198,230,.38)");
  gradient.addColorStop(1, "rgba(36,127,174,.42)");

  context.save();
  context.shadowColor = "rgba(61,198,255,.22)";
  context.shadowBlur = 18;
  context.fillStyle = gradient;
  context.beginPath();
  context.ellipse(centerX, centerY, radiusX, radiusY, -0.08, 0, Math.PI * 2);
  context.fill();
  context.restore();

  context.save();
  context.beginPath();
  context.ellipse(centerX, centerY, radiusX, radiusY, -0.08, 0, Math.PI * 2);
  context.clip();

  context.fillStyle = "rgba(255,255,255,.18)";
  context.beginPath();
  context.ellipse(
    patch.x + patch.w * 0.34,
    patch.y + patch.h * 0.28,
    patch.w * 0.22,
    patch.h * 0.08,
    -0.28,
    0,
    Math.PI * 2,
  );
  context.fill();

  drawWaterRipple(context, patch, 0.48, 0.52, 0.24, 0.32);
  drawWaterRipple(context, patch, 0.66, 0.4, 0.17, 0.24);
  drawWaterRipple(context, patch, 0.28, 0.63, 0.14, 0.22);
  context.restore();

  context.save();
  context.strokeStyle = "rgba(232,252,255,.42)";
  context.lineWidth = 2;
  context.beginPath();
  context.ellipse(centerX, centerY, radiusX, radiusY, -0.08, 0, Math.PI * 2);
  context.stroke();
  context.restore();
}

export function renderWaterPatches(
  container,
  waterPatches,
  { bounds, padding = 0 } = {},
) {
  if (!Array.isArray(waterPatches) || waterPatches.length === 0) {
    container.replaceChildren();
    return;
  }

  const { canvas, context } = createCanvas(
    "waterPatchCanvas",
    waterPatches,
    padding,
    bounds,
  );
  canvas.setAttribute("data-water-patches", String(waterPatches.length));
  if (context) waterPatches.forEach((patch) => drawWaterPatch(context, patch));
  container.replaceChildren(canvas);
}
