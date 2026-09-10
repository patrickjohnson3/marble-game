import { traceLiquidPatchPath } from "./liquid-patch-shape.js";
import { renderPatchCanvas } from "./wall-rendering.js";

function drawGooBubble(context, x, y, radius) {
  const skin = context.createRadialGradient(
    x - radius * 0.3,
    y - radius * 0.35,
    radius * 0.1,
    x,
    y,
    radius,
  );
  skin.addColorStop(0, "rgba(196,217,105,.48)");
  skin.addColorStop(0.5, "rgba(126,163,61,.34)");
  skin.addColorStop(0.8, "rgba(53,88,31,.18)");
  skin.addColorStop(1, "rgba(27,55,22,.46)");
  context.fillStyle = skin;
  context.beginPath();
  context.ellipse(x, y, radius, radius * 0.79, -0.12, 0, Math.PI * 2);
  context.fill();
  context.lineWidth = Math.max(0.8, radius * 0.1);
  context.strokeStyle = "rgba(207,226,128,.43)";
  context.beginPath();
  context.ellipse(
    x - radius * 0.04,
    y - radius * 0.08,
    radius * 0.79,
    radius * 0.61,
    -0.12,
    Math.PI * 1.06,
    Math.PI * 1.62,
  );
  context.stroke();
}

function drawGooFolds(context, patch) {
  const scale = Math.min(patch.w, patch.h);
  const folds = [
    [0.17, 0.42, 0.28, 0.21, 0.5, 0.48, 0.72, 0.27],
    [0.29, 0.66, 0.45, 0.48, 0.61, 0.84, 0.85, 0.51],
  ];
  context.lineCap = "round";
  for (const fold of folds) {
    const breadth = scale * 0.065;
    const sheen = context.createLinearGradient(
      patch.x + patch.w * fold[0],
      patch.y + patch.h * fold[1] - breadth,
      patch.x + patch.w * fold[6],
      patch.y + patch.h * fold[7] + breadth,
    );
    sheen.addColorStop(0, "rgba(206,224,138,0)");
    sheen.addColorStop(0.28, "rgba(206,224,138,.21)");
    sheen.addColorStop(0.6, "rgba(149,186,82,.09)");
    sheen.addColorStop(1, "rgba(87,132,46,0)");
    context.fillStyle = sheen;
    context.beginPath();
    context.moveTo(patch.x + patch.w * fold[0], patch.y + patch.h * fold[1]);
    context.bezierCurveTo(
      patch.x + patch.w * fold[2],
      patch.y + patch.h * fold[3],
      patch.x + patch.w * fold[4],
      patch.y + patch.h * fold[5],
      patch.x + patch.w * fold[6],
      patch.y + patch.h * fold[7],
    );
    context.bezierCurveTo(
      patch.x + patch.w * fold[4],
      patch.y + patch.h * fold[5] + breadth,
      patch.x + patch.w * fold[2],
      patch.y + patch.h * fold[3] + breadth * 0.8,
      patch.x + patch.w * fold[0],
      patch.y + patch.h * fold[1],
    );
    context.fill();
  }
}

function drawGooPatch(context, patch) {
  const smallDrop = Math.max(patch.w, patch.h) < 140;
  const thickness = Math.min(10, Math.min(patch.w, patch.h) * 0.024);
  const body = context.createLinearGradient(
    patch.x,
    patch.y,
    patch.x + patch.w * 0.65,
    patch.y + patch.h,
  );
  body.addColorStop(0, "rgba(125,163,57,.88)");
  body.addColorStop(0.4, "rgba(81,126,43,.94)");
  body.addColorStop(0.78, "rgba(58,97,35,.96)");
  body.addColorStop(1, "rgba(36,70,28,.97)");

  context.save();
  traceLiquidPatchPath(context, patch, "gooPatch");
  context.fillStyle = body;
  context.fill();
  context.clip();

  const pooledLight = context.createRadialGradient(
    patch.x + patch.w * 0.3,
    patch.y + patch.h * 0.25,
    0,
    patch.x + patch.w * 0.44,
    patch.y + patch.h * 0.42,
    patch.w * 0.57,
  );
  pooledLight.addColorStop(0, "rgba(188,210,106,.2)");
  pooledLight.addColorStop(0.6, "rgba(151,187,76,.04)");
  pooledLight.addColorStop(1, "rgba(28,56,27,.2)");
  context.fillStyle = pooledLight;
  context.fillRect(patch.x - 8, patch.y - 8, patch.w + 24, patch.h + 24);
  if (!smallDrop) drawGooFolds(context, patch);

  // Golden-angle placement avoids the old grid of identical bubbles. Count
  // stays fixed even on large patches, and all details live in the cached layer.
  const bubbleCount = smallDrop ? 0 : 18;
  for (let index = 0; index < bubbleCount; index++) {
    const angle = index * 2.39996 + 0.45;
    const distance = Math.sqrt((index + 0.5) / 18) * 0.83;
    const x = patch.x + patch.w * (0.52 + Math.cos(angle) * distance * 0.46);
    const y = patch.y + patch.h * (0.5 + Math.sin(angle) * distance * 0.42);
    const radius = Math.min(
      12,
      Math.min(patch.w, patch.h) * (0.01 + ((index * 7) % 11) * 0.002),
    );
    drawGooBubble(context, x, y, radius);
  }

  const undercut = context.createLinearGradient(
    patch.x,
    patch.y,
    patch.x + patch.w * 0.6,
    patch.y + patch.h,
  );
  undercut.addColorStop(0, "rgba(28,59,25,.08)");
  undercut.addColorStop(0.5, "rgba(28,59,25,.18)");
  undercut.addColorStop(1, "rgba(28,59,25,.39)");
  context.lineWidth = thickness * 1.25;
  context.strokeStyle = undercut;
  traceLiquidPatchPath(context, patch, "gooPatch", { inset: thickness * 0.15 });
  context.stroke();
  const rim = context.createLinearGradient(
    patch.x,
    patch.y,
    patch.x + patch.w * 0.55,
    patch.y + patch.h,
  );
  rim.addColorStop(0, "rgba(203,225,118,.57)");
  rim.addColorStop(0.48, "rgba(144,176,73,.19)");
  rim.addColorStop(1, "rgba(131,167,68,.07)");
  context.strokeStyle = rim;
  context.lineWidth = Math.max(1, thickness * 0.48);
  traceLiquidPatchPath(context, patch, "gooPatch", { inset: thickness * 0.7 });
  context.stroke();
  context.restore();

  context.save();
  context.strokeStyle = "rgba(226,238,161,.43)";
  context.lineWidth = Math.max(1, thickness * 0.15);
  context.lineCap = "round";
  traceLiquidPatchPath(context, patch, "gooPatch", {
    inset: thickness * 0.85,
    startAngle: Math.PI * 1.12,
    endAngle: Math.PI * 1.54,
  });
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
