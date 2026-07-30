import { renderPatchCanvas } from "./wall-rendering.js";

function gooNoise(x, y, salt = 0) {
  return (
    ((Math.imul(Math.round(x) + salt, 41) ^
      Math.imul(Math.round(y) - salt, 67)) >>>
      0) %
    100
  );
}

function drawGooBubble(context, x, y, radius, alpha) {
  context.save();
  context.fillStyle = "rgba(208,255,93," + alpha + ")";
  context.beginPath();
  context.ellipse(x, y, radius, radius * 0.78, 0, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = "rgba(37,96,20,.28)";
  context.lineWidth = Math.max(1, radius * 0.12);
  context.stroke();
  context.restore();
}

function drawGooPatch(context, patch) {
  const gradient = context.createLinearGradient(
    patch.x,
    patch.y,
    patch.x + patch.w,
    patch.y + patch.h,
  );
  const centerX = patch.x + patch.w * 0.52;
  const centerY = patch.y + patch.h * 0.5;
  const radiusX = patch.w * 0.5;
  const radiusY = patch.h * 0.47;

  gradient.addColorStop(0, "rgba(196,255,55,.86)");
  gradient.addColorStop(0.42, "rgba(84,203,42,.8)");
  gradient.addColorStop(1, "rgba(28,116,37,.82)");

  context.save();
  context.shadowColor = "rgba(124,255,60,.26)";
  context.shadowBlur = 18;
  context.fillStyle = gradient;
  context.beginPath();
  context.ellipse(centerX, centerY, radiusX, radiusY, 0.1, 0, Math.PI * 2);
  context.fill();
  context.restore();

  context.save();
  context.beginPath();
  context.ellipse(centerX, centerY, radiusX, radiusY, 0.1, 0, Math.PI * 2);
  context.clip();

  context.strokeStyle = "rgba(225,255,120,.38)";
  context.lineWidth = Math.max(5, Math.min(patch.w, patch.h) * 0.035);
  context.lineCap = "round";
  [
    { x1: 0.22, y1: 0.3, x2: 0.62, y2: 0.23 },
    { x1: 0.28, y1: 0.62, x2: 0.78, y2: 0.52 },
  ].forEach((streak) => {
    context.beginPath();
    context.moveTo(
      patch.x + patch.w * streak.x1,
      patch.y + patch.h * streak.y1,
    );
    context.lineTo(
      patch.x + patch.w * streak.x2,
      patch.y + patch.h * streak.y2,
    );
    context.stroke();
  });

  for (let y = patch.y + 22; y < patch.y + patch.h; y += 42) {
    for (let x = patch.x + 28; x < patch.x + patch.w; x += 48) {
      const noise = gooNoise(x, y, 13);
      if (noise % 3 === 0) continue;
      drawGooBubble(
        context,
        x + (noise % 11) - 5,
        y - (noise % 9) + 4,
        5 + (noise % 7),
        0.22 + (noise % 5) * 0.04,
      );
    }
  }
  context.restore();

  context.save();
  context.strokeStyle = "rgba(229,255,131,.56)";
  context.lineWidth = 2;
  context.beginPath();
  context.ellipse(centerX, centerY, radiusX, radiusY, 0.1, 0, Math.PI * 2);
  context.stroke();
  context.restore();
}

export function renderGooPatches(
  container,
  gooPatches,
  { bounds, padding = 0 } = {},
) {
  renderPatchCanvas(container, gooPatches, {
    bounds,
    className: "gooPatchCanvas",
    dataAttribute: "data-goo-patches",
    drawPatch: drawGooPatch,
    padding,
  });
}
