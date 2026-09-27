import { drawRoundedRect, renderPatchCanvas } from "./wall-rendering.js";
import { drawParkingGravel } from "./parking-lot-rendering.js";

const shagTextureSize = 560;
const pendingShagRenders = new Map();
let shagTexture = null;

function getShagTexture() {
  if (shagTexture || typeof globalThis.Image !== "function") return shagTexture;
  shagTexture = new globalThis.Image();
  shagTexture.decoding = "async";
  shagTexture.onload = () => {
    for (const render of pendingShagRenders.values()) render();
    pendingShagRenders.clear();
  };
  shagTexture.onerror = () => pendingShagRenders.clear();
  shagTexture.src = "assets/sprites/shag.webp";
  return shagTexture;
}

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

function drawRoughPatch(context, patch, shadowScale) {
  if (patch.material === "gravel") {
    drawParkingGravel(context, patch);
    return;
  }
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
  context.shadowBlur = 12 * shadowScale;
  context.shadowOffsetY = 6 * shadowScale;
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
  if (shagTexture?.complete && shagTexture.naturalWidth > 0) {
    // Bake the material into the existing canvas once; texture phase stays in
    // world coordinates even if a map changes its patch bounds.
    context.globalAlpha = 0.58;
    for (
      let y = Math.floor(patch.y / shagTextureSize) * shagTextureSize;
      y < patch.y + patch.h;
      y += shagTextureSize
    ) {
      for (
        let x = Math.floor(patch.x / shagTextureSize) * shagTextureSize;
        x < patch.x + patch.w;
        x += shagTextureSize
      ) {
        context.drawImage(shagTexture, x, y, shagTextureSize, shagTextureSize);
      }
    }
    context.globalAlpha = 1;
  }
  // The bound edge reads as fabric rather than another painted terrain outline.
  context.strokeStyle = "#46594f55";
  context.lineWidth = 12;
  context.strokeRect(patch.x + 6, patch.y + 6, patch.w - 12, patch.h - 12);
  context.strokeStyle = "#c2cbbb66";
  context.lineWidth = 3;
  context.strokeRect(patch.x + 10, patch.y + 10, patch.w - 20, patch.h - 20);
  context.restore();
}

export function renderRoughPatches(
  container,
  roughPatches,
  { bounds, padding = 0 } = {},
) {
  const texture =
    Array.isArray(roughPatches) &&
    roughPatches.some((patch) => patch.material === "shag")
      ? getShagTexture()
      : null;
  // Only the latest contents of this container may repaint when loading ends.
  pendingShagRenders.delete(container);
  renderPatchCanvas(container, roughPatches, {
    bounds,
    className: "roughPatchCanvas",
    dataAttribute: "data-rough-patches",
    drawPatch: drawRoughPatch,
    padding,
  });
  if (texture && !texture.complete) {
    pendingShagRenders.set(container, () =>
      renderRoughPatches(container, roughPatches, { bounds, padding }),
    );
  }
}
