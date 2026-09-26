import {
  KITCHEN_FORK_SPRITE,
  KITCHEN_SPOON_SPRITE,
  PARKING_CAR_SPRITE,
} from "./map-elements.js";

// Rounded rectangles measured in fork.png pixels: tapered handle, narrow neck,
// flare, and head/tines. The tine slots are narrower than the marble diameter.
const forkMetalRects = [
  [1, 28, 171, 81, 37],
  [81, 36, 188, 63, 31.5],
  [163, 44, 202, 47, 23.5],
  [271, 50, 192, 34, 17],
  [420, 53, 282, 26, 6.5],
  [689, 33, 71, 65, 32.5],
  [705, 2, 245, 126, 63],
  [873, 12, 151, 107, 17.5],
];

// Spoon PNG coordinates exclude its transparent end padding. Four rounded
// pieces follow the tapered handle/neck, a small circle fills the flare, and
// two overlapping capsules fit the bowl.
const spoonMetalRects = [
  [103, 70, 138, 87, 36],
  [170, 84, 200, 59, 29.5],
  [326, 93, 192, 39, 19.5],
  [501, 97, 175, 30, 15],
  [625, 87, 50, 50, 25],
  [659, 23, 231, 173, 86.5],
  [645, 45, 275, 126, 63],
];

// Measured in parking-car.webp pixels: rounded bonnet, narrow flanks, rear
// shoulders/bumper, and the slightly wider lower body. Preserve transparent
// sprite padding so collision and background-size: contain share one transform.
const parkingCarBodyRects = [
  [37.7, 9.8, 769.5, 1647.9, 350],
  [34.7, 419.9, 775.6, 1285.5, 185.9],
  [46.7, 1206.6, 751.7, 623.2, 216.4],
  [119.4, 1403.1, 606.1, 435.6, 217.8],
  [29, 736.3, 787, 966.2, 150.6],
];

export function createParkingCarCollisionRects(car) {
  return createSpriteCollisionRects(
    car,
    PARKING_CAR_SPRITE,
    parkingCarBodyRects,
  );
}

export function createForkCollisionRects(fork) {
  return createSpriteCollisionRects(fork, KITCHEN_FORK_SPRITE, forkMetalRects);
}

export function createSpoonCollisionRects(spoon) {
  return createSpriteCollisionRects(
    spoon,
    KITCHEN_SPOON_SPRITE,
    spoonMetalRects,
  );
}

function createSpriteCollisionRects(fixture, sprite, metalRects) {
  const visualWidth = Math.max(fixture.hitboxW ?? fixture.w, sprite.minWidth);
  const visualHeight = Math.max(fixture.hitboxH ?? fixture.h, sprite.minHeight);
  const scale = Math.min(
    visualWidth / sprite.width,
    visualHeight / sprite.height,
  );
  const angle = fixture.angle ?? 0;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const centerX = fixture.x + fixture.w / 2;
  const centerY = fixture.y + fixture.h / 2;

  return metalRects.map(([x, y, width, height, radius]) => {
    const localX = (x + width / 2 - sprite.width / 2) * scale;
    const localY = (y + height / 2 - sprite.height / 2) * scale;
    const hitboxW = width * scale;
    const hitboxH = height * scale;
    // Keep x/y/w/h as world bounds for canvas allocation; the oriented contact
    // code uses hitboxW/H about this same center.
    const w = Math.abs(cos) * hitboxW + Math.abs(sin) * hitboxH;
    const h = Math.abs(sin) * hitboxW + Math.abs(cos) * hitboxH;
    return {
      type: fixture.type,
      fixture: fixture.fixture,
      fixtureSource: fixture,
      x: centerX + cos * localX - sin * localY - w / 2,
      y: centerY + sin * localX + cos * localY - h / 2,
      w,
      h,
      hitboxW,
      hitboxH,
      angle,
      cornerRadius: radius * scale,
    };
  });
}

export function rangesTouchOrOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart <= bEnd && bStart <= aEnd;
}

export function isHorizontalRect(rect) {
  return rect.w >= rect.h;
}

export function snapToGrid(value, gridSize) {
  return Math.round(value / gridSize) * gridSize;
}

export function snapRectToGrid(rect, gridSize) {
  return {
    ...rect,
    x: snapToGrid(rect.x, gridSize),
    y: snapToGrid(rect.y, gridSize),
    w: snapToGrid(rect.w, gridSize),
    h: snapToGrid(rect.h, gridSize),
  };
}

export function normalizeJoinedObstacleRects(rects) {
  const normalized = rects.map((rect) => ({ ...rect }));
  // Stitch only plain wall segments. Furniture and rounded/rotated shapes have
  // deliberate footprints that touching neighbors must never resize.
  const walls = normalized.filter(
    (rect) => !rect.fixture && !rect.cornerRadius && !(rect.angle ?? 0),
  );

  for (const horizontal of walls.filter(isHorizontalRect)) {
    for (const vertical of walls.filter((rect) => !isHorizontalRect(rect))) {
      const horizontalBottom = horizontal.y + horizontal.h;
      const verticalBottom = vertical.y + vertical.h;
      let horizontalRight = horizontal.x + horizontal.w;
      const verticalRight = vertical.x + vertical.w;

      if (
        !rangesTouchOrOverlap(
          horizontal.x,
          horizontalRight,
          vertical.x,
          verticalRight,
        ) ||
        !rangesTouchOrOverlap(
          horizontal.y,
          horizontalBottom,
          vertical.y,
          verticalBottom,
        )
      ) {
        continue;
      }

      const verticalBottomGap = Math.abs(verticalBottom - horizontalBottom);
      const verticalTopGap = Math.abs(vertical.y - horizontal.y);
      let horizontalRightGap = Math.abs(verticalRight - horizontalRight);
      const horizontalLeftGap = Math.abs(vertical.x - horizontal.x);
      const threshold = Math.max(horizontal.h, vertical.w);

      if (horizontalRight > verticalRight && horizontalRightGap <= threshold) {
        const width = verticalRight - horizontal.x;
        if (width > 0) {
          horizontal.w = width;
          horizontalRight = verticalRight;
          horizontalRightGap = 0;
        }
      }

      if (
        verticalBottomGap <= threshold &&
        verticalBottomGap <= verticalTopGap
      ) {
        const height = horizontalBottom - vertical.y;
        if (height > 0) vertical.h = height;
      } else if (verticalTopGap <= threshold) {
        const bottom = verticalBottom;
        const height = bottom - horizontal.y;
        if (height > 0) {
          vertical.y = horizontal.y;
          vertical.h = height;
        }
      }
      if (
        horizontalRightGap <= threshold &&
        horizontalRightGap <= horizontalLeftGap
      ) {
        const width = horizontalRight - vertical.x;
        if (width > 0) vertical.w = width;
      } else if (horizontalLeftGap <= threshold) {
        const right = verticalRight;
        const width = right - horizontal.x;
        if (width > 0) {
          vertical.x = horizontal.x;
          vertical.w = width;
        }
      }
    }
  }

  return normalized;
}
