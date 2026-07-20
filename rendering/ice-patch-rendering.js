import { createCanvas } from "./wall-rendering.js";

function drawRoundedRect(context, rect, radius) {
  if (context.roundRect) {
    context.roundRect(rect.x, rect.y, rect.w, rect.h, radius);
    return;
  }
  context.rect(rect.x, rect.y, rect.w, rect.h);
}

function drawIcePatch(context, patch) {
  const gradient = context.createLinearGradient(
    patch.x,
    patch.y,
    patch.x + patch.w,
    patch.y + patch.h,
  );
  const radius = 10;

  gradient.addColorStop(0, "#d9fbffcc");
  gradient.addColorStop(0.52, "#7fd8ff8f");
  gradient.addColorStop(1, "#d7f7ffb3");

  context.save();
  context.shadowColor = "rgba(145,225,255,.22)";
  context.shadowBlur = 14;
  context.shadowOffsetY = 5;
  context.fillStyle = gradient;
  context.beginPath();
  drawRoundedRect(context, patch, radius);
  context.fill();
  context.restore();

  context.save();
  context.beginPath();
  drawRoundedRect(context, patch, radius);
  context.clip();
  context.strokeStyle = "rgba(255,255,255,.48)";
  context.lineWidth = 2;
  for (let y = patch.y + 18; y < patch.y + patch.h + patch.w; y += 38) {
    context.beginPath();
    context.moveTo(patch.x, y);
    context.lineTo(patch.x + patch.w, y - patch.w * 0.26);
    context.stroke();
  }
  context.strokeStyle = "rgba(41,132,180,.28)";
  context.lineWidth = 1;
  for (let y = patch.y + 10; y < patch.y + patch.h + patch.w; y += 54) {
    context.beginPath();
    context.moveTo(patch.x, y);
    context.lineTo(patch.x + patch.w, y - patch.w * 0.2);
    context.stroke();
  }
  context.restore();

  context.save();
  context.strokeStyle = "rgba(255,255,255,.42)";
  context.lineWidth = 2;
  context.beginPath();
  drawRoundedRect(context, patch, radius);
  context.stroke();
  context.restore();
}

export function renderIcePatches(
  container,
  icePatches,
  { bounds, padding = 0 } = {},
) {
  if (!Array.isArray(icePatches) || icePatches.length === 0) {
    container.replaceChildren();
    return;
  }

  const { canvas, context } = createCanvas(
    "icePatchCanvas",
    icePatches,
    padding,
    bounds,
  );
  canvas.setAttribute("data-ice-patches", String(icePatches.length));
  if (context) icePatches.forEach((patch) => drawIcePatch(context, patch));
  container.replaceChildren(canvas);
}
