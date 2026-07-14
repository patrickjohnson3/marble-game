import { createCanvas } from "./wall-rendering.js";

function patchDotOffset(x, y, salt = 0) {
  return (Math.imul(Math.round(x) + salt, 31) + Math.imul(Math.round(y) - salt, 17)) % 5;
}

function drawRoundedRect(context, rect, radius) {
  if (context.roundRect) {
    context.roundRect(rect.x, rect.y, rect.w, rect.h, radius);
    return;
  }
  context.rect(rect.x, rect.y, rect.w, rect.h);
}

function drawPatchGritLayer(context, patch, {
  color,
  stepX,
  stepY,
  startX,
  startY,
  size,
  jitterScale,
  salt
}) {
  context.fillStyle = color;
  for (let y = patch.y + startY; y < patch.y + patch.h; y += stepY) {
    for (let x = patch.x + startX; x < patch.x + patch.w; x += stepX) {
      const offset = patchDotOffset(x, y, salt);
      context.fillRect(
        x + offset * jitterScale,
        y - offset * jitterScale * 0.7,
        size,
        size
      );
    }
  }
}

function drawRoughPatch(context, patch) {
  const gradient = context.createLinearGradient(patch.x, patch.y, patch.x + patch.w, patch.y + patch.h);
  const radius = 10;

  gradient.addColorStop(0, "#92928a");
  gradient.addColorStop(0.56, "#74746d");
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
  drawPatchGritLayer(context, patch, {
    color: "rgba(244,244,240,.86)",
    stepX: 12,
    stepY: 12,
    startX: 6,
    startY: 6,
    size: 2,
    jitterScale: 0.28,
    salt: 0
  });
  drawPatchGritLayer(context, patch, {
    color: "rgba(44,44,42,.34)",
    stepX: 15,
    stepY: 15,
    startX: 13,
    startY: 11,
    size: 1.8,
    jitterScale: 0.34,
    salt: 3
  });
  drawPatchGritLayer(context, patch, {
    color: "rgba(172,172,164,.45)",
    stepX: 22,
    stepY: 22,
    startX: 19,
    startY: 23,
    size: 2.4,
    jitterScale: 0.42,
    salt: 7
  });
  context.restore();

  context.save();
  context.strokeStyle = "rgba(255,255,255,.2)";
  context.lineWidth = 2;
  context.beginPath();
  drawRoundedRect(context, patch, radius);
  context.stroke();
  context.restore();

  if (patch.w > 4 && patch.h > 4) {
    context.save();
    context.strokeStyle = "rgba(0,0,0,.28)";
    context.lineWidth = 1;
    context.beginPath();
    drawRoundedRect(context, {
      x: patch.x + 2,
      y: patch.y + 2,
      w: patch.w - 4,
      h: patch.h - 4
    }, radius - 2);
    context.stroke();
    context.restore();
  }
}

export function renderRoughPatches(container, roughPatches, { bounds, padding = 0 } = {}) {
  if (!Array.isArray(roughPatches) || roughPatches.length === 0) {
    container.replaceChildren();
    return;
  }

  const { canvas, context } = createCanvas("roughPatchCanvas", roughPatches, padding, bounds);
  canvas.setAttribute("data-rough-patches", String(roughPatches.length));
  if (context) roughPatches.forEach((patch) => drawRoughPatch(context, patch));
  container.replaceChildren(canvas);
}
