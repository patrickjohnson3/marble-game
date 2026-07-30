import { renderPatchCanvas } from "./wall-rendering.js";

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

function addPuddleLobePath(context, patch, lobe) {
  context.ellipse(
    patch.x + patch.w * lobe.x,
    patch.y + patch.h * lobe.y,
    patch.w * lobe.rx,
    patch.h * lobe.ry,
    lobe.angle,
    0,
    Math.PI * 2,
  );
}

function drawPuddleLobe(context, patch, lobe) {
  context.beginPath();
  addPuddleLobePath(context, patch, lobe);
  context.fill();
}

function drawWaterPatch(context, patch) {
  const gradient = context.createLinearGradient(
    patch.x,
    patch.y,
    patch.x + patch.w,
    patch.y + patch.h,
  );
  const lobes = [
    { x: 0.46, y: 0.52, rx: 0.39, ry: 0.33, angle: -0.12 },
    { x: 0.68, y: 0.48, rx: 0.28, ry: 0.26, angle: 0.18 },
    { x: 0.28, y: 0.58, rx: 0.24, ry: 0.22, angle: -0.24 },
    { x: 0.5, y: 0.36, rx: 0.22, ry: 0.16, angle: -0.08 },
  ];

  gradient.addColorStop(0, "rgba(225,250,255,.42)");
  gradient.addColorStop(0.5, "rgba(120,210,230,.24)");
  gradient.addColorStop(1, "rgba(49,132,166,.28)");

  context.save();
  context.shadowColor = "rgba(75,190,230,.12)";
  context.shadowBlur = 10;
  context.fillStyle = gradient;
  lobes.forEach((lobe) => drawPuddleLobe(context, patch, lobe));
  context.restore();

  context.save();
  context.beginPath();
  lobes.forEach((lobe) => addPuddleLobePath(context, patch, lobe));
  context.clip();

  context.fillStyle = "rgba(255,255,255,.14)";
  context.beginPath();
  context.ellipse(
    patch.x + patch.w * 0.38,
    patch.y + patch.h * 0.34,
    patch.w * 0.18,
    patch.h * 0.06,
    -0.24,
    0,
    Math.PI * 2,
  );
  context.fill();

  drawWaterRipple(context, patch, 0.51, 0.56, 0.18, 0.2);
  drawWaterRipple(context, patch, 0.68, 0.45, 0.12, 0.17);
  context.restore();

  context.save();
  context.strokeStyle = "rgba(232,252,255,.24)";
  context.lineWidth = 1.5;
  lobes.forEach((lobe) => {
    context.beginPath();
    addPuddleLobePath(context, patch, lobe);
    context.stroke();
  });
  context.restore();
}

export function renderWaterPatches(
  container,
  waterPatches,
  { bounds, padding = 0 } = {},
) {
  renderPatchCanvas(container, waterPatches, {
    bounds,
    className: "waterPatchCanvas",
    dataAttribute: "data-water-patches",
    drawPatch: drawWaterPatch,
    padding,
  });
}
