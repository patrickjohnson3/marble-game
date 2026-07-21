import { createCanvas, drawRoundedRect } from "./wall-rendering.js";

function drawHazardPatch(context, patch) {
  const radius = 8;
  const gradient = context.createLinearGradient(
    patch.x,
    patch.y,
    patch.x + patch.w,
    patch.y + patch.h,
  );

  gradient.addColorStop(0, "#ff7a59");
  gradient.addColorStop(0.52, "#ef476f");
  gradient.addColorStop(1, "#b5174a");

  context.save();
  context.shadowColor = "rgba(239,71,111,.32)";
  context.shadowBlur = 16;
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
  context.strokeStyle = "rgba(255,255,255,.34)";
  context.lineWidth = 5;
  for (let x = patch.x - patch.h; x < patch.x + patch.w; x += 28) {
    context.beginPath();
    context.moveTo(x, patch.y + patch.h);
    context.lineTo(x + patch.h, patch.y);
    context.stroke();
  }
  context.restore();
}

export function renderHazardPatches(
  container,
  hazardPatches,
  { bounds, padding = 0 } = {},
) {
  if (!Array.isArray(hazardPatches) || hazardPatches.length === 0) {
    container.replaceChildren();
    return;
  }

  const { canvas, context } = createCanvas(
    "hazardPatchCanvas",
    hazardPatches,
    padding,
    bounds,
  );
  canvas.setAttribute("data-hazard-patches", String(hazardPatches.length));
  if (context)
    hazardPatches.forEach((patch) => drawHazardPatch(context, patch));
  container.replaceChildren(canvas);
}
