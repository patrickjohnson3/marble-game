import { traceLiquidPatchPath } from "./liquid-patch-shape.js";
import { renderPatchCanvas } from "./wall-rendering.js";

const kitchenTileSize = 220;

function drawRefractedGrout(context, patch) {
  context.lineWidth = 1.3;
  context.lineCap = "round";
  for (let axis = 0; axis < 2; axis++) {
    const origin = axis === 0 ? patch.x : patch.y;
    const length = axis === 0 ? patch.w : patch.h;
    const firstLine = Math.ceil(origin / kitchenTileSize) * kitchenTileSize;
    for (
      let line = firstLine;
      line <= origin + length;
      line += kitchenTileSize
    ) {
      const bend = Math.sin(((line - origin) / length) * Math.PI + 0.6) * 5;
      for (let edge = 0; edge < 2; edge++) {
        const offset = edge === 0 ? -1.5 : 2;
        context.strokeStyle =
          edge === 0 ? "rgba(241,255,255,.24)" : "rgba(40,80,81,.12)";
        context.beginPath();
        if (axis === 0) {
          context.moveTo(line + offset, patch.y);
          context.bezierCurveTo(
            line + bend + offset,
            patch.y + patch.h * 0.34,
            line - bend * 0.4 + offset,
            patch.y + patch.h * 0.68,
            line + offset,
            patch.y + patch.h,
          );
        } else {
          context.moveTo(patch.x, line + offset);
          context.bezierCurveTo(
            patch.x + patch.w * 0.34,
            line + bend + offset,
            patch.x + patch.w * 0.68,
            line - bend * 0.4 + offset,
            patch.x + patch.w,
            line + offset,
          );
        }
        context.stroke();
      }
    }
  }
}

function drawWaterReflections(context, patch) {
  const light = context.createLinearGradient(
    patch.x + patch.w * 0.12,
    patch.y + patch.h * 0.22,
    patch.x + patch.w * 0.8,
    patch.y + patch.h * 0.48,
  );
  light.addColorStop(0, "rgba(249,255,255,0)");
  light.addColorStop(0.23, "rgba(249,255,255,.27)");
  light.addColorStop(0.65, "rgba(249,255,255,.16)");
  light.addColorStop(1, "rgba(249,255,255,0)");
  context.fillStyle = light;

  // Broken, tapering reflected light leaves the tile pattern readable below.
  for (let index = 0; index < 3; index++) {
    const x = patch.x + patch.w * (0.13 + index * 0.035);
    const y = patch.y + patch.h * (0.34 + index * 0.07);
    const length = patch.w * (0.66 - index * 0.12);
    const breadth = patch.h * (index === 0 ? 0.055 : 0.016);
    context.beginPath();
    context.moveTo(x, y);
    context.bezierCurveTo(
      x + length * 0.25,
      y - breadth,
      x + length * 0.7,
      y - breadth * 2.2,
      x + length,
      y - breadth * 1.4,
    );
    context.bezierCurveTo(
      x + length * 0.77,
      y - breadth * 0.85,
      x + length * 0.35,
      y + breadth * 0.65,
      x,
      y,
    );
    context.fill();
  }

  context.lineCap = "round";
  // Bounded, deterministic caustic fragments; these are part of the static cache.
  for (let index = 0; index < 11; index++) {
    const angle = index * 2.39996;
    const radius = Math.sqrt((index + 0.5) / 11) * 0.77;
    const x = patch.x + patch.w * (0.5 + Math.cos(angle) * radius * 0.44);
    const y = patch.y + patch.h * (0.52 + Math.sin(angle) * radius * 0.35);
    const width = Math.min(36, patch.w * (0.02 + (index % 3) * 0.008));
    const height = Math.min(9, patch.h * 0.015);
    context.strokeStyle = "rgba(229,255,250,.19)";
    context.lineWidth = 1.2;
    context.beginPath();
    context.moveTo(x - width, y + height);
    context.bezierCurveTo(
      x - width * 0.35,
      y - height,
      x + width * 0.15,
      y + height * 0.8,
      x + width,
      y - height * 0.4,
    );
    context.stroke();
    if (index % 3 !== 0) continue;
    context.strokeStyle = "rgba(241,255,255,.24)";
    context.beginPath();
    context.ellipse(
      x + width * 0.2,
      y + height,
      width * 0.65,
      height,
      -0.12,
      Math.PI * 1.05,
      Math.PI * 1.8,
    );
    context.stroke();
  }
}

function drawWaterPatch(context, patch) {
  const depth = context.createLinearGradient(
    patch.x,
    patch.y,
    patch.x + patch.w * 0.75,
    patch.y + patch.h,
  );
  depth.addColorStop(0, "rgba(207,239,237,.16)");
  depth.addColorStop(0.32, "rgba(133,201,207,.21)");
  depth.addColorStop(0.72, "rgba(86,151,163,.25)");
  depth.addColorStop(1, "rgba(61,113,124,.19)");

  context.save();
  traceLiquidPatchPath(context, patch, "waterPatch");
  context.fillStyle = depth;
  context.fill();
  context.clip();

  const reflectedSky = context.createRadialGradient(
    patch.x + patch.w * 0.38,
    patch.y + patch.h * 0.3,
    0,
    patch.x + patch.w * 0.5,
    patch.y + patch.h * 0.45,
    patch.w * 0.45,
  );
  reflectedSky.addColorStop(0, "rgba(229,254,255,.2)");
  reflectedSky.addColorStop(0.6, "rgba(163,215,226,.06)");
  reflectedSky.addColorStop(1, "rgba(99,162,178,0)");
  context.fillStyle = reflectedSky;
  context.fillRect(patch.x, patch.y, patch.w, patch.h);
  drawRefractedGrout(context, patch);
  drawWaterReflections(context, patch);

  // A narrow wet meniscus, with light only on the facing edge, avoids the
  // thick uniform outline that made the old puddle read like a glass disc.
  const edge = context.createLinearGradient(
    patch.x,
    patch.y,
    patch.x + patch.w * 0.5,
    patch.y + patch.h,
  );
  edge.addColorStop(0, "rgba(52,99,108,.12)");
  edge.addColorStop(0.55, "rgba(48,90,96,.07)");
  edge.addColorStop(1, "rgba(30,70,77,.3)");
  context.strokeStyle = edge;
  context.lineWidth = 3.2;
  traceLiquidPatchPath(context, patch, "waterPatch", { inset: 0.7 });
  context.stroke();
  context.restore();

  context.save();
  context.strokeStyle = "rgba(241,255,255,.52)";
  context.lineCap = "round";
  context.lineWidth = 1.5;
  traceLiquidPatchPath(context, patch, "waterPatch", {
    inset: 1.3,
    startAngle: Math.PI * 1.02,
    endAngle: Math.PI * 1.58,
  });
  context.stroke();
  context.strokeStyle = "rgba(226,253,253,.28)";
  context.lineWidth = 1;
  traceLiquidPatchPath(context, patch, "waterPatch", {
    inset: 1.5,
    startAngle: Math.PI * 1.65,
    endAngle: Math.PI * 1.86,
  });
  context.stroke();
  traceLiquidPatchPath(context, patch, "waterPatch", {
    inset: 2,
    startAngle: Math.PI * 0.18,
    endAngle: Math.PI * 0.42,
  });
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
