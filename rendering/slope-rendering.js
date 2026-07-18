import { createCanvas } from "./wall-rendering.js";

function drawRoundedRect(context, rect, radius) {
  if (context.roundRect) {
    context.roundRect(rect.x, rect.y, rect.w, rect.h, radius);
    return;
  }
  context.rect(rect.x, rect.y, rect.w, rect.h);
}

function drawSlopeZone(context, zone) {
  const gradient = context.createLinearGradient(
    zone.x,
    zone.y,
    zone.x + zone.w,
    zone.y + zone.h,
  );
  const length = Math.max(Math.hypot(zone.dx, zone.dy), 1);
  const ux = zone.dx / length;
  const uy = zone.dy / length;
  const sx = -uy;
  const sy = ux;
  const spacing = 46;
  const arrowSize = Math.min(28, Math.max(16, Math.min(zone.w, zone.h) * 0.22));

  gradient.addColorStop(0, "#44d2ff66");
  gradient.addColorStop(0.54, "#2fbf9f4d");
  gradient.addColorStop(1, "#ffd16666");

  context.save();
  context.fillStyle = gradient;
  context.strokeStyle = "rgba(255,255,255,.22)";
  context.lineWidth = 2;
  context.beginPath();
  drawRoundedRect(context, zone, 8);
  context.fill();
  context.stroke();
  context.clip();

  context.strokeStyle = "rgba(255,255,255,.42)";
  context.lineWidth = 4;
  context.lineCap = "round";
  for (let y = zone.y + spacing * 0.55; y < zone.y + zone.h; y += spacing) {
    for (let x = zone.x + spacing * 0.55; x < zone.x + zone.w; x += spacing) {
      const tipX = x + ux * arrowSize * 0.5;
      const tipY = y + uy * arrowSize * 0.5;
      const tailX = x - ux * arrowSize * 0.5;
      const tailY = y - uy * arrowSize * 0.5;
      context.beginPath();
      context.moveTo(tailX, tailY);
      context.lineTo(tipX, tipY);
      context.lineTo(
        tipX - ux * arrowSize * 0.42 + sx * arrowSize * 0.28,
        tipY - uy * arrowSize * 0.42 + sy * arrowSize * 0.28,
      );
      context.moveTo(tipX, tipY);
      context.lineTo(
        tipX - ux * arrowSize * 0.42 - sx * arrowSize * 0.28,
        tipY - uy * arrowSize * 0.42 - sy * arrowSize * 0.28,
      );
      context.stroke();
    }
  }
  context.restore();
}

export function renderSlopeZones(
  container,
  slopeZones,
  { bounds, padding = 0 } = {},
) {
  if (!Array.isArray(slopeZones) || slopeZones.length === 0) {
    container.replaceChildren();
    return;
  }

  const { canvas, context } = createCanvas(
    "slopeZoneCanvas",
    slopeZones,
    padding,
    bounds,
  );
  canvas.setAttribute("data-slope-zones", String(slopeZones.length));
  if (context) slopeZones.forEach((zone) => drawSlopeZone(context, zone));
  container.replaceChildren(canvas);
}
