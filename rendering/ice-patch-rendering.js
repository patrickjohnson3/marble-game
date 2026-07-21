import { createCanvas, drawRoundedRect } from "./wall-rendering.js";

function patchNoise(x, y, salt = 0) {
  return (
    ((Math.imul(Math.round(x) + salt, 37) ^
      Math.imul(Math.round(y) - salt, 53)) >>>
      0) %
    100
  );
}

function drawCloudyFrost(context, patch) {
  const step = 34;
  for (let y = patch.y + 16; y < patch.y + patch.h; y += step) {
    for (let x = patch.x + 18; x < patch.x + patch.w; x += step) {
      const noise = patchNoise(x, y, 11);
      const width = 18 + (noise % 18);
      const height = 8 + (noise % 10);
      context.globalAlpha = 0.1 + (noise % 5) * 0.018;
      context.fillStyle = noise % 3 === 0 ? "#ffffff" : "#c9f4ff";
      context.beginPath();
      context.ellipse(
        x + (noise % 9) - 4,
        y - (noise % 7) + 3,
        width,
        height,
        ((noise % 8) - 4) * 0.12,
        0,
        Math.PI * 2,
      );
      context.fill();
    }
  }
  context.globalAlpha = 1;
}

function drawCrack(context, points) {
  context.beginPath();
  context.moveTo(points[0].x, points[0].y);
  points.slice(1).forEach((point) => context.lineTo(point.x, point.y));
  context.stroke();
}

function drawIceCracks(context, patch) {
  const cracks = [
    [
      { x: patch.x + patch.w * 0.18, y: patch.y + patch.h * 0.28 },
      { x: patch.x + patch.w * 0.32, y: patch.y + patch.h * 0.34 },
      { x: patch.x + patch.w * 0.46, y: patch.y + patch.h * 0.31 },
      { x: patch.x + patch.w * 0.58, y: patch.y + patch.h * 0.42 },
    ],
    [
      { x: patch.x + patch.w * 0.65, y: patch.y + patch.h * 0.2 },
      { x: patch.x + patch.w * 0.59, y: patch.y + patch.h * 0.39 },
      { x: patch.x + patch.w * 0.72, y: patch.y + patch.h * 0.52 },
      { x: patch.x + patch.w * 0.67, y: patch.y + patch.h * 0.68 },
    ],
    [
      { x: patch.x + patch.w * 0.22, y: patch.y + patch.h * 0.72 },
      { x: patch.x + patch.w * 0.36, y: patch.y + patch.h * 0.62 },
      { x: patch.x + patch.w * 0.48, y: patch.y + patch.h * 0.7 },
    ],
  ];

  context.lineCap = "round";
  context.lineJoin = "round";
  context.strokeStyle = "rgba(255,255,255,.58)";
  context.lineWidth = 2;
  cracks.forEach((crack) => drawCrack(context, crack));
  context.strokeStyle = "rgba(55,151,188,.38)";
  context.lineWidth = 1;
  cracks.forEach((crack) => drawCrack(context, crack));
}

function drawGloss(context, patch) {
  context.strokeStyle = "rgba(255,255,255,.46)";
  context.lineWidth = 3;
  context.lineCap = "round";
  [
    { x: 0.18, y: 0.18, w: 0.36 },
    { x: 0.48, y: 0.78, w: 0.28 },
  ].forEach((highlight) => {
    context.beginPath();
    context.moveTo(
      patch.x + patch.w * highlight.x,
      patch.y + patch.h * highlight.y,
    );
    context.lineTo(
      patch.x + patch.w * (highlight.x + highlight.w),
      patch.y + patch.h * (highlight.y - highlight.w * 0.12),
    );
    context.stroke();
  });
}

function drawIcePatch(context, patch) {
  const gradient = context.createLinearGradient(
    patch.x,
    patch.y,
    patch.x + patch.w,
    patch.y + patch.h,
  );
  const radius = 10;

  gradient.addColorStop(0, "#f3fdffdf");
  gradient.addColorStop(0.44, "#c9f4ffb8");
  gradient.addColorStop(0.72, "#edfaffc9");
  gradient.addColorStop(1, "#b9eaff9e");

  context.save();
  context.shadowColor = "rgba(180,238,255,.18)";
  context.shadowBlur = 12;
  context.shadowOffsetY = 4;
  context.fillStyle = gradient;
  context.beginPath();
  drawRoundedRect(context, patch, radius);
  context.fill();
  context.restore();

  context.save();
  context.beginPath();
  drawRoundedRect(context, patch, radius);
  context.clip();
  drawCloudyFrost(context, patch);
  drawGloss(context, patch);
  drawIceCracks(context, patch);
  context.restore();

  context.save();
  context.strokeStyle = "rgba(245,253,255,.62)";
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
