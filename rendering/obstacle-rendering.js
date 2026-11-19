import { rectBounds } from "../core/rect-bounds.js";
import { createCanvas, drawRoundedRect } from "./wall-rendering.js";
import {
  KITCHEN_CUP_SPRITE,
  KITCHEN_FIXTURES,
  KITCHEN_FORK_SPRITE,
  KITCHEN_SPOON_SPRITE,
} from "../core/map-elements.js";
import { renderLivingRoomFixtures } from "./living-room-rendering.js";
import { renderParkingFixtures } from "./parking-lot-rendering.js";
import { containerLocalPoint, pointInContainer } from "../core/containers.js";

function coveredByAny(rects, left, top, right, bottom) {
  return rects.some(
    (rect) =>
      left >= rect.x &&
      right <= rect.x + rect.w &&
      top >= rect.y &&
      bottom <= rect.y + rect.h,
  );
}

function rectsTouchOrOverlap(a, b) {
  return (
    a.x <= b.x + b.w && b.x <= a.x + a.w && a.y <= b.y + b.h && b.y <= a.y + a.h
  );
}

function connectedRectGroups(rects) {
  const remaining = [...rects];
  const groups = [];

  while (remaining.length > 0) {
    const group = [remaining.shift()];
    for (let index = 0; index < group.length; index++) {
      for (let candidate = remaining.length - 1; candidate >= 0; candidate--) {
        if (!rectsTouchOrOverlap(group[index], remaining[candidate])) continue;
        group.push(remaining.splice(candidate, 1)[0]);
      }
    }
    groups.push(group);
  }

  return groups;
}

function mergedRectGeometry(rects) {
  const xs = [
    ...new Set(rects.flatMap((rect) => [rect.x, rect.x + rect.w])),
  ].sort((a, b) => a - b);
  const ys = [
    ...new Set(rects.flatMap((rect) => [rect.y, rect.y + rect.h])),
  ].sort((a, b) => a - b);
  const covered = [];
  const fillRects = [];
  const outlineSegments = [];

  for (let y = 0; y < ys.length - 1; y++) {
    covered[y] = [];
    for (let x = 0; x < xs.length - 1; x++) {
      covered[y][x] = coveredByAny(rects, xs[x], ys[y], xs[x + 1], ys[y + 1]);
      if (covered[y][x]) {
        const rect = {
          x: xs[x],
          y: ys[y],
          w: xs[x + 1] - xs[x],
          h: ys[y + 1] - ys[y],
        };
        fillRects.push(rect);
      }
    }
  }

  for (let y = 0; y < ys.length - 1; y++) {
    for (let x = 0; x < xs.length - 1; x++) {
      if (!covered[y][x]) continue;

      const left = xs[x];
      const right = xs[x + 1];
      const top = ys[y];
      const bottom = ys[y + 1];
      if (!covered[y - 1]?.[x]) {
        outlineSegments.push({ x1: left, y1: top, x2: right, y2: top });
      }
      if (!covered[y + 1]?.[x]) {
        outlineSegments.push({ x1: left, y1: bottom, x2: right, y2: bottom });
      }
      if (!covered[y]?.[x - 1]) {
        outlineSegments.push({ x1: left, y1: top, x2: left, y2: bottom });
      }
      if (!covered[y]?.[x + 1]) {
        outlineSegments.push({ x1: right, y1: top, x2: right, y2: bottom });
      }
    }
  }

  return { fillRects, outlineSegments };
}

function drawFillRects(context, rects) {
  context.beginPath();
  rects.forEach((rect) => context.rect(rect.x, rect.y, rect.w, rect.h));
}

function drawObstacleGroup(context, group, shadowScale) {
  const { bottom, left, right, top } = rectBounds(group);
  const geometry = mergedRectGeometry(group);
  const fill = context.createLinearGradient(left, top, right, bottom);

  fill.addColorStop(0, "#ffd166");
  fill.addColorStop(0.46, "#ff9f66");
  fill.addColorStop(1, "#ef476f");

  context.save();
  context.shadowColor = "rgba(0,0,0,.55)";
  context.shadowBlur = 18 * shadowScale;
  context.shadowOffsetY = 14 * shadowScale;
  context.fillStyle = fill;
  drawFillRects(context, geometry.fillRects);
  context.fill();
  context.restore();
}

function drawObstacleOutline(context, obstacles) {
  const geometry = mergedRectGeometry(obstacles);

  context.save();
  context.beginPath();
  geometry.outlineSegments.forEach((segment) => {
    context.moveTo(segment.x1, segment.y1);
    context.lineTo(segment.x2, segment.y2);
  });
  context.strokeStyle = "rgba(255,255,255,.27)";
  context.lineWidth = 1;
  context.lineJoin = "miter";
  context.stroke();
  context.restore();
}

function hitboxCorners(rect) {
  const width = rect.hitboxW ?? rect.w;
  const height = rect.hitboxH ?? rect.h;
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const centerX = rect.x + rect.w / 2;
  const centerY = rect.y + rect.h / 2;
  const angle = rect.angle ?? 0;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  return [
    { x: -halfWidth, y: -halfHeight },
    { x: halfWidth, y: -halfHeight },
    { x: halfWidth, y: halfHeight },
    { x: -halfWidth, y: halfHeight },
  ].map((point) => ({
    x: centerX + point.x * cos - point.y * sin,
    y: centerY + point.x * sin + point.y * cos,
  }));
}

function drawHitbox(context, rect) {
  if (rect.cornerRadius > 0) {
    const cos = Math.cos(rect.angle ?? 0);
    const sin = Math.sin(rect.angle ?? 0);
    context.save();
    context.transform(
      cos,
      sin,
      -sin,
      cos,
      rect.x + rect.w / 2,
      rect.y + rect.h / 2,
    );
    context.beginPath();
    const width = rect.hitboxW ?? rect.w;
    const height = rect.hitboxH ?? rect.h;
    drawRoundedRect(
      context,
      {
        x: -width / 2,
        y: -height / 2,
        w: width,
        h: height,
      },
      rect.cornerRadius,
    );
    context.stroke();
    context.restore();
    return;
  }
  const corners = hitboxCorners(rect);

  context.beginPath();
  context.moveTo(corners[0].x, corners[0].y);
  for (let i = 1; i < corners.length; i++) {
    context.lineTo(corners[i].x, corners[i].y);
  }
  context.lineTo(corners[0].x, corners[0].y);
  context.stroke();
}

function applyRectStyle(element, rect) {
  element.style.left = rect.x + "px";
  element.style.top = rect.y + "px";
  element.style.width = rect.w + "px";
  element.style.height = rect.h + "px";
}

const kitchenFixtureSprites = new WeakMap();
const cupViews = new WeakMap();
const occupantPoint = { x: 0, y: 0 };

// The aperture is an ellipse at rest. When occupied, extend the same aperture
// back into a narrow cutaway, leaving the opaque rim, side walls and handle.
// Coordinates stay local to the existing CSS contain box, before its rotation.
function cupOpeningPath(container, left) {
  const mouth = container.opening;
  const rx = (mouth.right - mouth.left) / 2;
  const ry = (mouth.bottom - mouth.top) / 2;
  const x = container.width / 2;
  const y = container.height / 2;
  const back = x + left + rx;
  const front = x + mouth.left + rx;
  const top = y + mouth.top;
  const bottom = y + mouth.bottom;
  return `M${back} ${top} H${front} A${rx} ${ry} 0 0 1 ${front} ${bottom} H${back} A${rx} ${ry} 0 0 1 ${back} ${top} Z`;
}

export function renderContainerOccupants(
  containerEl,
  containers,
  marble,
  cockroach,
) {
  const sprites = kitchenFixtureSprites.get(containerEl?.firstChild);
  if (!sprites) return;
  for (const container of containers) {
    const sprite = sprites.get(container.source);
    if (!sprite) continue;
    let view = cupViews.get(sprite);
    if (!view) {
      // This background sits BELOW the real actors, not over the ceramic. The
      // foreground image is the only occluder; there are no copied actor glyphs.
      const interior = document.createElement("div");
      interior.className = "kitchenCupInterior";
      interior.setAttribute("aria-hidden", "true");
      applyRectStyle(interior, {
        x: container.centerX - container.width / 2,
        y: container.centerY - container.height / 2,
        w: container.width,
        h: container.height,
      });
      interior.style.setProperty(
        "--fixture-angle",
        (container.source.angle ?? 0) + "rad",
      );
      interior.style.clipPath = `path("${cupOpeningPath(container, container.interior.left)}")`;
      containerEl.appendChild(interior);
      view = { interior, left: null };
      cupViews.set(sprite, view);
    }
    let left = container.opening.left;
    for (let i = 0; i < 2; i++) {
      const entity = i === 0 ? marble : cockroach;
      // An exterior insect's antennae must never punch a window through a wall.
      // Both actors use their real body and the same physical interior test.
      if (!entity || !pointInContainer(container, entity)) continue;
      containerLocalPoint(container, entity.x, entity.y, occupantPoint);
      left = Math.min(left, occupantPoint.x - entity.r);
    }
    left = Math.max(container.interior.left, left);
    if (view.left === left) continue;
    view.left = left;
    const outer = `M0 0 H${container.width} V${container.height} H0 Z`;
    sprite.style.setProperty(
      "--cup-clip",
      `path(evenodd, "${outer} ${cupOpeningPath(container, left)}")`,
    );
  }
}
const spongeImpact = {
  durationMs: 280,
  referenceSpeed: 10,
  minCompression: 0.02,
  extraCompression: 0.05,
};

export function renderSpongeImpact(container, sponge, strength, nx, ny) {
  const sprite = kitchenFixtureSprites.get(container.firstChild)?.get(sponge);
  if (!sprite) return;
  const angle = sponge.angle ?? 0;
  const localX = Math.abs(nx * Math.cos(angle) + ny * Math.sin(angle));
  const localY = Math.abs(ny * Math.cos(angle) - nx * Math.sin(angle));
  const compression =
    spongeImpact.minCompression +
    spongeImpact.extraCompression *
      Math.min(1, strength / spongeImpact.referenceSpeed);
  const resting = "rotate(var(--fixture-angle)) scale(var(--sponge-scale))";
  // Keep live pose/wetness variables, so a moving sponge still rotates/swells.
  for (const animation of sprite.getAnimations()) animation.cancel();
  sprite.animate(
    [
      { transform: resting },
      {
        transform:
          resting +
          " scale(" +
          (1 - localX * compression) +
          ", " +
          (1 - localY * compression) +
          ")",
        offset: 0.25,
      },
      { transform: resting },
    ],
    { duration: spongeImpact.durationMs, easing: "ease-out" },
  );
}

function syncKitchenFixtureSprite(
  layer,
  sprites,
  fixture,
  className,
  minWidth,
  minHeight,
) {
  let sprite = sprites.get(fixture);
  if (!sprite) {
    sprite = document.createElement("div");
    sprite.className = className;
    sprites.set(fixture, sprite);
    layer.appendChild(sprite);
  }
  const visualWidth = Math.max(fixture.hitboxW ?? fixture.w, minWidth);
  const visualHeight = Math.max(fixture.hitboxH ?? fixture.h, minHeight);
  applyRectStyle(sprite, {
    x: fixture.x + fixture.w / 2 - visualWidth / 2,
    y: fixture.y + fixture.h / 2 - visualHeight / 2,
    w: visualWidth,
    h: visualHeight,
  });
  sprite.style.setProperty("--fixture-angle", (fixture.angle ?? 0) + "rad");
  return sprite;
}

function syncKitchenSpongeSprite(layer, sprites, sponge) {
  const sprite = syncKitchenFixtureSprite(
    layer,
    sprites,
    sponge,
    "kitchenSpongeSprite",
    500,
    145,
  );
  const saturation = Math.max(0, Math.min(1, sponge.saturation ?? 0));
  sprite.style.setProperty(
    "--sponge-brightness",
    (1 - saturation * 0.2).toFixed(3),
  );
  sprite.style.setProperty(
    "--sponge-color",
    (1 - saturation * 0.35).toFixed(3),
  );
  sprite.style.setProperty(
    "--sponge-scale",
    (1 + saturation * 0.04).toFixed(3),
  );
}

function renderKitchenObstacleWalls(container, obstacles) {
  let layer = container.firstChild;
  if (!layer || layer.className !== "kitchenObstacleLayer") {
    layer = document.createElement("div");
    layer.className = "kitchenObstacleLayer";
    layer.setAttribute("aria-hidden", "true");
    container.replaceChildren(layer);
    kitchenFixtureSprites.set(layer, new Map());
  }
  const sprites = kitchenFixtureSprites.get(layer);
  // Utensil collision pieces share one display source; separate utensils do not.
  const fixtures = new Set();
  for (const obstacle of obstacles) {
    const fixture = obstacle.fixtureSource ?? obstacle;
    if (fixtures.has(fixture)) continue;
    switch (fixture.fixture) {
      case KITCHEN_FIXTURES.fork:
        syncKitchenFixtureSprite(
          layer,
          sprites,
          fixture,
          "kitchenForkSprite",
          KITCHEN_FORK_SPRITE.minWidth,
          KITCHEN_FORK_SPRITE.minHeight,
        );
        break;
      case KITCHEN_FIXTURES.spoon:
        syncKitchenFixtureSprite(
          layer,
          sprites,
          fixture,
          "kitchenSpoonSprite",
          KITCHEN_SPOON_SPRITE.minWidth,
          KITCHEN_SPOON_SPRITE.minHeight,
        );
        break;
      case KITCHEN_FIXTURES.sponge:
        syncKitchenSpongeSprite(layer, sprites, fixture);
        break;
      case KITCHEN_FIXTURES.tippedCup:
        // A sibling of the ordinary fixture layer so its ceramic surface can
        // occlude the marble inside, without lifting the sponge/utensils too.
        syncKitchenFixtureSprite(
          container,
          sprites,
          fixture,
          "kitchenCupSprite",
          KITCHEN_CUP_SPRITE.minWidth,
          KITCHEN_CUP_SPRITE.minHeight,
        ).setAttribute("aria-hidden", "true");
        break;
      case KITCHEN_FIXTURES.cabinetBase:
      case KITCHEN_FIXTURES.applianceBase:
      case KITCHEN_FIXTURES.applianceFoot: {
        const sprite = syncKitchenFixtureSprite(
          layer,
          sprites,
          fixture,
          "kitchenBase " + fixture.fixture,
          0,
          0,
        );
        sprite.style.borderRadius = (fixture.cornerRadius ?? 0) + "px";
        sprite.setAttribute("data-facing", fixture.facing ?? "down");
        break;
      }
      default:
        continue;
    }
    fixtures.add(fixture);
  }
  for (const [fixture, sprite] of sprites) {
    if (fixtures.has(fixture)) continue;
    cupViews.get(sprite)?.interior.remove();
    sprite.remove();
    sprites.delete(fixture);
  }
  layer.setAttribute("data-fixtures", String(fixtures.size));
}

export function renderObstacleHitboxes(
  container,
  obstacles,
  { bounds, padding = 0 } = {},
) {
  if (obstacles.length === 0) {
    container.replaceChildren();
    return;
  }

  const { canvas, context } = createCanvas(
    "hitboxCanvas",
    obstacles,
    padding,
    bounds,
  );

  canvas.setAttribute("data-hitboxes", String(obstacles.length));
  if (context) {
    context.save();
    context.strokeStyle = "rgba(143, 247, 197, .9)";
    context.lineWidth = 3;
    context.setLineDash?.([16, 10]);
    obstacles.forEach((obstacle) => drawHitbox(context, obstacle));
    context.restore();
  }
  container.replaceChildren(canvas);
}

export function renderObstacleWalls(
  container,
  obstacles,
  { bounds, mapConfig, padding = 0 } = {},
) {
  if (obstacles.length === 0) {
    container.replaceChildren();
    return;
  }
  if (mapConfig?.theme === "kitchenFloor") {
    renderKitchenObstacleWalls(container, obstacles);
    return;
  }
  if (mapConfig?.theme === "livingRoom") {
    renderLivingRoomFixtures(container, obstacles);
    return;
  }
  if ((mapConfig?.variantId ?? mapConfig?.id) === "parking-lot") {
    renderParkingFixtures(container, obstacles);
    return;
  }

  const { canvas, context, shadowScale } = createCanvas(
    "obstacleCanvas",
    obstacles,
    padding,
    bounds,
  );
  const obstacleGroups = connectedRectGroups(obstacles);

  canvas.setAttribute("data-wall-groups", String(obstacleGroups.length));
  if (context) {
    obstacleGroups.forEach((group) =>
      drawObstacleGroup(context, group, shadowScale),
    );
    drawObstacleOutline(context, obstacles);
  }
  container.replaceChildren(canvas);
}
