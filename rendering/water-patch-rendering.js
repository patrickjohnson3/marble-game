import { renderPatchCanvas } from "./wall-rendering.js";

const kitchenTileSize = 220;
const puddleOutline = Object.freeze([
  Object.freeze({ x: 0.06, y: 0.55 }),
  Object.freeze({ x: 0.1, y: 0.37 }),
  Object.freeze({ x: 0.2, y: 0.28 }),
  Object.freeze({ x: 0.31, y: 0.3 }),
  Object.freeze({ x: 0.39, y: 0.2 }),
  Object.freeze({ x: 0.55, y: 0.17 }),
  Object.freeze({ x: 0.71, y: 0.21 }),
  Object.freeze({ x: 0.85, y: 0.31 }),
  Object.freeze({ x: 0.94, y: 0.47 }),
  Object.freeze({ x: 0.91, y: 0.64 }),
  Object.freeze({ x: 0.79, y: 0.76 }),
  Object.freeze({ x: 0.62, y: 0.82 }),
  Object.freeze({ x: 0.47, y: 0.78 }),
  Object.freeze({ x: 0.34, y: 0.86 }),
  Object.freeze({ x: 0.2, y: 0.8 }),
  Object.freeze({ x: 0.1, y: 0.69 }),
]);
const puddleDroplets = Object.freeze([
  Object.freeze({ x: 0.12, y: 0.28, rx: 0.026, ry: 0.018, angle: -0.4 }),
  Object.freeze({ x: 0.23, y: 0.18, rx: 0.015, ry: 0.011, angle: 0.2 }),
  Object.freeze({ x: 0.79, y: 0.18, rx: 0.02, ry: 0.014, angle: 0.3 }),
  Object.freeze({ x: 0.91, y: 0.28, rx: 0.013, ry: 0.01, angle: -0.1 }),
  Object.freeze({ x: 0.95, y: 0.67, rx: 0.018, ry: 0.012, angle: 0.4 }),
  Object.freeze({ x: 0.72, y: 0.88, rx: 0.017, ry: 0.011, angle: -0.3 }),
  Object.freeze({ x: 0.16, y: 0.86, rx: 0.014, ry: 0.01, angle: 0.1 }),
]);

function waterPoint(patch, point) {
  return {
    x: patch.x + patch.w * point.x,
    y: patch.y + patch.h * point.y,
  };
}

function insetPuddlePoint(point, centerX, centerY, insetScale) {
  return {
    x: point.x + (centerX - point.x) * insetScale,
    y: point.y + (centerY - point.y) * insetScale,
  };
}

function addPuddlePath(context, patch, inset = 0) {
  const centerX = patch.x + patch.w * 0.5;
  const centerY = patch.y + patch.h * 0.52;
  const insetScale = Math.max(0, Math.min(0.9, inset));
  const points = puddleOutline.map((point) =>
    insetPuddlePoint(waterPoint(patch, point), centerX, centerY, insetScale),
  );
  const first = points[0];

  context.moveTo(first.x, first.y);
  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    const next = points[(i + 1) % points.length];
    const midX = (point.x + next.x) / 2;
    const midY = (point.y + next.y) / 2;
    if (context.quadraticCurveTo) {
      context.quadraticCurveTo(point.x, point.y, midX, midY);
    } else {
      context.lineTo(midX, midY);
    }
  }
  context.lineTo(first.x, first.y);
}

function drawPuddleShape(context, patch, inset = 0) {
  context.beginPath();
  addPuddlePath(context, patch, inset);
}

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

function drawDroplet(context, patch, droplet) {
  context.ellipse(
    patch.x + patch.w * droplet.x,
    patch.y + patch.h * droplet.y,
    patch.w * droplet.rx,
    patch.h * droplet.ry,
    droplet.angle,
    0,
    Math.PI * 2,
  );
}

function drawTileWaterLines(context, patch) {
  const left = Math.ceil(patch.x / kitchenTileSize) * kitchenTileSize;
  const right = patch.x + patch.w;
  const top = Math.ceil(patch.y / kitchenTileSize) * kitchenTileSize;
  const bottom = patch.y + patch.h;

  context.save();
  drawPuddleShape(context, patch, 0.04);
  context.clip();
  context.lineCap = "round";
  context.lineWidth = 2;

  for (let x = left; x <= right; x += kitchenTileSize) {
    context.strokeStyle = "rgba(255,255,255,.2)";
    context.beginPath();
    context.moveTo(x - 1, patch.y + patch.h * 0.18);
    context.lineTo(x - 1, patch.y + patch.h * 0.84);
    context.stroke();
    context.strokeStyle = "rgba(55,72,62,.12)";
    context.beginPath();
    context.moveTo(x + 2, patch.y + patch.h * 0.16);
    context.lineTo(x + 2, patch.y + patch.h * 0.86);
    context.stroke();
  }

  for (let y = top; y <= bottom; y += kitchenTileSize) {
    context.strokeStyle = "rgba(255,255,255,.18)";
    context.beginPath();
    context.moveTo(patch.x + patch.w * 0.08, y - 1);
    context.lineTo(patch.x + patch.w * 0.92, y - 1);
    context.stroke();
    context.strokeStyle = "rgba(55,72,62,.1)";
    context.beginPath();
    context.moveTo(patch.x + patch.w * 0.08, y + 2);
    context.lineTo(patch.x + patch.w * 0.92, y + 2);
    context.stroke();
  }

  context.restore();
}

function drawReflection(context, patch) {
  context.save();
  drawPuddleShape(context, patch, 0.03);
  context.clip();

  context.fillStyle = "rgba(255,255,255,.34)";
  context.beginPath();
  context.ellipse(
    patch.x + patch.w * 0.42,
    patch.y + patch.h * 0.34,
    patch.w * 0.26,
    patch.h * 0.075,
    -0.18,
    0,
    Math.PI * 2,
  );
  context.fill();

  context.fillStyle = "rgba(255,255,255,.16)";
  context.beginPath();
  context.ellipse(
    patch.x + patch.w * 0.66,
    patch.y + patch.h * 0.57,
    patch.w * 0.21,
    patch.h * 0.05,
    -0.12,
    0,
    Math.PI * 2,
  );
  context.fill();

  context.strokeStyle = "rgba(255,255,255,.24)";
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(patch.x + patch.w * 0.17, patch.y + patch.h * 0.48);
  context.lineTo(patch.x + patch.w * 0.44, patch.y + patch.h * 0.43);
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
  gradient.addColorStop(0, "rgba(255,255,255,.26)");
  gradient.addColorStop(0.42, "rgba(194,236,228,.22)");
  gradient.addColorStop(1, "rgba(76,120,112,.18)");

  context.save();
  context.shadowColor = "rgba(24,46,44,.22)";
  context.shadowBlur = 5;
  context.fillStyle = gradient;
  drawPuddleShape(context, patch);
  context.fill();
  context.restore();

  drawTileWaterLines(context, patch);
  drawReflection(context, patch);

  context.save();
  drawPuddleShape(context, patch, 0.02);
  context.clip();

  drawWaterRipple(context, patch, 0.51, 0.56, 0.18, 0.16);
  drawWaterRipple(context, patch, 0.68, 0.45, 0.12, 0.13);
  context.restore();

  context.save();
  context.fillStyle = "rgba(220,252,255,.16)";
  context.strokeStyle = "rgba(255,255,255,.34)";
  context.lineWidth = 1.2;
  puddleDroplets.forEach((droplet) => {
    context.beginPath();
    drawDroplet(context, patch, droplet);
    context.fill();
    context.stroke();
  });
  context.restore();

  context.save();
  context.strokeStyle = "rgba(245,255,255,.45)";
  context.lineWidth = 1.5;
  drawPuddleShape(context, patch);
  context.stroke();
  context.strokeStyle = "rgba(38,62,58,.2)";
  context.lineWidth = 3;
  drawPuddleShape(context, patch, -0.015);
  context.stroke();
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
