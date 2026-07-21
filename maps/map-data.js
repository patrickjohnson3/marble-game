import {
  isHorizontalRect,
  rangesTouchOrOverlap,
} from "../core/map-obstacles.js";

const mapScale = 2;

function isHorizontalObstacle(element) {
  return element.type === "obstacle" && isHorizontalRect(element);
}

function scaleMapElement(element) {
  if (element.type === "obstacle") {
    const isHorizontal = isHorizontalObstacle(element);

    return {
      ...element,
      x: element.x * mapScale,
      y: element.y * mapScale,
      w: isHorizontal ? element.w * mapScale : element.w,
      h: isHorizontal ? element.h : element.h * mapScale,
    };
  }

  return {
    ...element,
    x: element.x * mapScale,
    y: element.y * mapScale,
    w: element.w * mapScale,
    h: element.h * mapScale,
  };
}

function trimScaledObstacleJoinOverhangs(elements) {
  const scaledElements = elements.map(scaleMapElement);
  const horizontalObstacles = scaledElements.filter(isHorizontalObstacle);
  const verticalObstacles = scaledElements.filter(
    (element) => element.type === "obstacle" && !isHorizontalObstacle(element),
  );

  for (const horizontal of horizontalObstacles) {
    for (const vertical of verticalObstacles) {
      const horizontalRight = horizontal.x + horizontal.w;
      const verticalRight = vertical.x + vertical.w;
      const threshold = Math.max(horizontal.h, vertical.w);

      if (
        rangesTouchOrOverlap(
          horizontal.y,
          horizontal.y + horizontal.h,
          vertical.y,
          vertical.y + vertical.h,
        ) &&
        horizontalRight > verticalRight &&
        Math.abs(horizontalRight - verticalRight) <= threshold
      ) {
        horizontal.w = verticalRight - horizontal.x;
      }
    }
  }

  return scaledElements;
}

function scaleMapPoint(point) {
  return {
    ...point,
    x: point.x * mapScale,
    y: point.y * mapScale,
  };
}

const defaultElements = [
  { type: "obstacle", x: 260, y: 330, w: 510, h: 40 },
  { type: "obstacle", x: 720, y: 250, w: 50, h: 360 },
  { type: "obstacle", x: 1320, y: 330, w: 430, h: 50 },
  { type: "obstacle", x: 1700, y: 600, w: 60, h: 430 },
  { type: "obstacle", x: 250, y: 900, w: 720, h: 50 },
  { type: "obstacle", x: 910, y: 760, w: 60, h: 380 },
  { type: "obstacle", x: 1180, y: 960, w: 520, h: 50 },
  { type: "obstacle", x: 520, y: 1380, w: 50, h: 440 },
  { type: "obstacle", x: 520, y: 1570, w: 930, h: 50 },
  { type: "obstacle", x: 1640, y: 1370, w: 50, h: 470 },
  { type: "icePatch", x: 800, y: 520, w: 230, h: 210 },
  { type: "roughPatch", x: 360, y: 650, w: 290, h: 220 },
  { type: "roughPatch", x: 1420, y: 1160, w: 330, h: 260 },
  { type: "roughPatch", x: 1680, y: 1600, w: 300, h: 230 },
];

const generatedOneElements = [
  { type: "obstacle", x: 360, y: 420, w: 560, h: 50 },
  { type: "obstacle", x: 870, y: 420, w: 50, h: 360 },
  { type: "obstacle", x: 1260, y: 300, w: 50, h: 470 },
  { type: "obstacle", x: 1260, y: 720, w: 520, h: 50 },
  { type: "obstacle", x: 300, y: 1080, w: 680, h: 50 },
  { type: "obstacle", x: 300, y: 1080, w: 50, h: 420 },
  { type: "obstacle", x: 1160, y: 1180, w: 660, h: 50 },
  { type: "obstacle", x: 1770, y: 1180, w: 50, h: 500 },
  { type: "obstacle", x: 620, y: 1680, w: 600, h: 50 },
  { type: "obstacle", x: 1170, y: 1460, w: 50, h: 270 },
  { type: "icePatch", x: 980, y: 840, w: 260, h: 220 },
  { type: "roughPatch", x: 460, y: 660, w: 310, h: 240 },
  { type: "roughPatch", x: 720, y: 1320, w: 350, h: 230 },
  { type: "roughPatch", x: 1640, y: 940, w: 260, h: 210 },
];

export const mapVariants = [
  {
    id: "default",
    goal: scaleMapPoint({ x: 1920, y: 1900, r: 95, holdMs: 5000 }),
    elements: trimScaledObstacleJoinOverhangs(defaultElements),
  },
  {
    id: "generated-1",
    goal: scaleMapPoint({ x: 1840, y: 1850, r: 95, holdMs: 5000 }),
    elements: trimScaledObstacleJoinOverhangs(generatedOneElements),
  },
];
