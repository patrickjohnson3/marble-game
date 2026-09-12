import { drawRoundedRect, renderPatchCanvas } from "./wall-rendering.js";

function patchDotOffset(x, y, salt = 0) {
  return (
    (Math.imul(Math.round(x) + salt, 31) +
      Math.imul(Math.round(y) - salt, 17)) %
    5
  );
}

function drawPatchGritLayer(
  context,
  patch,
  { color, stepX, stepY, startX, startY, size, jitterScale, salt },
) {
  context.fillStyle = color;
  for (let y = patch.y + startY; y < patch.y + patch.h; y += stepY) {
    for (let x = patch.x + startX; x < patch.x + patch.w; x += stepX) {
      const offset = patchDotOffset(x, y, salt);
      context.fillRect(
        x + offset * jitterScale,
        y - offset * jitterScale * 0.7,
        size,
        size,
      );
    }
  }
}

function drawRoughPatch(context, patch) {
  if (patch.material === "shag") {
    drawShagPatch(context, patch);
    return;
  }
  const gradient = context.createLinearGradient(
    patch.x,
    patch.y,
    patch.x + patch.w,
    patch.y + patch.h,
  );
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
    salt: 0,
  });
  drawPatchGritLayer(context, patch, {
    color: "rgba(44,44,42,.34)",
    stepX: 15,
    stepY: 15,
    startX: 13,
    startY: 11,
    size: 1.8,
    jitterScale: 0.34,
    salt: 3,
  });
  drawPatchGritLayer(context, patch, {
    color: "rgba(172,172,164,.45)",
    stepX: 22,
    stepY: 22,
    startX: 19,
    startY: 23,
    size: 2.4,
    jitterScale: 0.42,
    salt: 7,
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
    drawRoundedRect(
      context,
      {
        x: patch.x + 2,
        y: patch.y + 2,
        w: patch.w - 4,
        h: patch.h - 4,
      },
      radius - 2,
    );
    context.stroke();
    context.restore();
  }
}

function drawShagPatch(context, patch) {
  const pile = context.createLinearGradient(
    patch.x,
    patch.y,
    patch.x + patch.w,
    patch.y + patch.h,
  );
  pile.addColorStop(0, "#a6b2a8");
  pile.addColorStop(0.5, "#919f96");
  pile.addColorStop(1, "#798c82");
  context.fillStyle = pile;
  // The rectangular backing agrees exactly with the existing rough surface.
  context.fillRect(patch.x, patch.y, patch.w, patch.h);
  context.save();
  context.beginPath();
  context.rect(patch.x, patch.y, patch.w, patch.h);
  context.clip();
  context.strokeStyle = "#51695d66";
  context.lineWidth = 7;
  context.strokeRect(patch.x + 7, patch.y + 7, patch.w - 14, patch.h - 14);
  context.lineWidth = 1.7;
  context.lineCap = "round";
  // Fixed fibers are batched into three paths and baked only at map load.
  const fiberColors = ["#d8dfce6b", "#4c685a3d", "#c0cbb766"];
  for (let layer = 0; layer < fiberColors.length; layer += 1) {
    context.strokeStyle = fiberColors[layer];
    context.beginPath();
    for (
      let row = 0, y = patch.y + 14;
      y < patch.y + patch.h - 12;
      row += 1, y += 18
    ) {
      for (
        let column = 0, x = patch.x + 14;
        x < patch.x + patch.w - 12;
        column += 1, x += 18
      ) {
        const seed =
          Math.imul(column + 1, 374761393) ^ Math.imul(row + 1, 668265263);
        const variation = Math.imul(seed ^ (seed >>> 13), 1274126177) >>> 0;
        if (variation % 3 !== layer) continue;
        const startX = x + ((variation >>> 2) % 15) - 7;
        const startY = y + ((variation >>> 6) % 15) - 7;
        const length = 6 + ((variation >>> 10) % 10);
        const lean = ((variation >>> 14) % 13) - 6;
        context.moveTo(startX, startY);
        context.quadraticCurveTo(
          startX + lean * 0.3,
          startY - length * 0.7,
          startX + lean,
          startY - length,
        );
      }
    }
    context.stroke();
  }
  context.restore();
}

export function renderRoughPatches(
  container,
  roughPatches,
  { bounds, padding = 0 } = {},
) {
  renderPatchCanvas(container, roughPatches, {
    bounds,
    className: "roughPatchCanvas",
    dataAttribute: "data-rough-patches",
    drawPatch: drawRoughPatch,
    padding,
  });
}
