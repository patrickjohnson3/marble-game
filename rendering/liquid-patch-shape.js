import { ELLIPTICAL_SURFACE_SHAPES } from "../core/map-elements.js";

const fullTurn = Math.PI * 2;

// Keep the decorative meniscus within a few world pixels of the surface used
// by physics. Broad lobes would otherwise suggest dry ground is sticky or wet.
export function traceLiquidPatchPath(
  context,
  patch,
  type,
  { inset = 0, startAngle = 0, endAngle = fullTurn } = {},
) {
  const shape = ELLIPTICAL_SURFACE_SHAPES[type];
  const radiusX = Math.max(0.1, patch.w * shape.radiusX - inset);
  const radiusY = Math.max(0.1, patch.h * shape.radiusY - inset);
  const centerX = patch.x + patch.w * shape.centerX;
  const centerY = patch.y + patch.h * shape.centerY;
  const waviness = Math.min(
    type === "waterPatch" ? 3 : 5,
    radiusX * 0.025,
    radiusY * 0.025,
  );
  const phase = type === "waterPatch" ? 0.7 : 2.1;
  const segments = Math.max(
    2,
    Math.ceil((96 * Math.abs(endAngle - startAngle)) / fullTurn),
  );

  context.beginPath();
  for (let index = 0; index <= segments; index++) {
    const angle = startAngle + ((endAngle - startAngle) * index) / segments;
    const wave =
      waviness *
      (Math.sin(angle * 5 + phase) * 0.5 +
        Math.sin(angle * 9 - phase) * 0.3 +
        Math.sin(angle * 13 + phase) * 0.2);
    const localX = (radiusX + wave) * Math.cos(angle);
    const localY = (radiusY + wave) * Math.sin(angle);
    const x = centerX + localX * shape.cos - localY * shape.sin;
    const y = centerY + localX * shape.sin + localY * shape.cos;
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
  if (Math.abs(endAngle - startAngle) >= fullTurn) context.closePath();
}
