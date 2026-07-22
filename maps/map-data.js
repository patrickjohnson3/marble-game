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
  { type: "hazardPatch", x: 1040, y: 1220, w: 220, h: 160 },
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
  { type: "hazardPatch", x: 1360, y: 1560, w: 240, h: 170 },
  { type: "roughPatch", x: 460, y: 660, w: 310, h: 240 },
  { type: "roughPatch", x: 720, y: 1320, w: 350, h: 230 },
  { type: "roughPatch", x: 1640, y: 940, w: 260, h: 210 },
];

const hockeyRinkElements = [
  { type: "icePatch", x: 180, y: 180, w: 1840, h: 1840 },
  { type: "obstacle", x: 440, y: 320, w: 520, h: 40 },
  { type: "obstacle", x: 1240, y: 1840, w: 520, h: 40 },
  { type: "obstacle", x: 240, y: 700, w: 50, h: 360 },
  { type: "obstacle", x: 1910, y: 1140, w: 50, h: 360 },
  { type: "hazardPatch", x: 1000, y: 980, w: 200, h: 200 },
  { type: "roughPatch", x: 460, y: 1580, w: 260, h: 170 },
];

const kitchenFloorElements = [
  { type: "obstacle", x: 180, y: 240, w: 620, h: 70 },
  { type: "obstacle", x: 180, y: 240, w: 70, h: 520 },
  { type: "obstacle", x: 1280, y: 220, w: 640, h: 70 },
  { type: "obstacle", x: 1850, y: 220, w: 70, h: 520 },
  { type: "obstacle", x: 780, y: 820, w: 600, h: 120 },
  { type: "obstacle", x: 520, y: 1380, w: 220, h: 220 },
  { type: "obstacle", x: 1460, y: 1320, w: 260, h: 260 },
  { type: "roughPatch", x: 860, y: 1260, w: 360, h: 260 },
  { type: "icePatch", x: 1320, y: 760, w: 260, h: 190 },
  { type: "hazardPatch", x: 360, y: 1540, w: 240, h: 190 },
];

const livingRoomElements = [
  { type: "obstacle", x: 220, y: 360, w: 700, h: 150 },
  { type: "obstacle", x: 1540, y: 300, w: 110, h: 560 },
  { type: "obstacle", x: 780, y: 1020, w: 520, h: 180 },
  { type: "obstacle", x: 280, y: 1620, w: 480, h: 100 },
  { type: "obstacle", x: 1460, y: 1540, w: 430, h: 90 },
  { type: "roughPatch", x: 560, y: 660, w: 820, h: 620 },
  { type: "roughPatch", x: 1280, y: 1180, w: 420, h: 280 },
  { type: "icePatch", x: 420, y: 1280, w: 220, h: 180 },
  { type: "hazardPatch", x: 1660, y: 900, w: 220, h: 240 },
];

const parkingLotElements = [
  { type: "obstacle", x: 360, y: 300, w: 430, h: 150 },
  { type: "obstacle", x: 1020, y: 300, w: 430, h: 150 },
  { type: "obstacle", x: 300, y: 820, w: 150, h: 430 },
  { type: "obstacle", x: 1680, y: 760, w: 150, h: 430 },
  { type: "obstacle", x: 720, y: 1440, w: 500, h: 120 },
  { type: "obstacle", x: 1380, y: 1520, w: 430, h: 130 },
  { type: "hazardPatch", x: 920, y: 820, w: 260, h: 190 },
  { type: "hazardPatch", x: 1320, y: 1240, w: 220, h: 180 },
  { type: "icePatch", x: 520, y: 1220, w: 260, h: 210 },
  { type: "roughPatch", x: 1480, y: 420, w: 300, h: 230 },
];

const sandLotElements = [
  { type: "roughPatch", x: 220, y: 260, w: 650, h: 520 },
  { type: "roughPatch", x: 1120, y: 340, w: 760, h: 520 },
  { type: "roughPatch", x: 420, y: 1260, w: 740, h: 560 },
  { type: "obstacle", x: 520, y: 940, w: 520, h: 60 },
  { type: "obstacle", x: 980, y: 940, w: 60, h: 420 },
  { type: "obstacle", x: 1380, y: 1060, w: 430, h: 60 },
  { type: "obstacle", x: 1380, y: 1060, w: 60, h: 360 },
  { type: "hazardPatch", x: 1480, y: 1540, w: 260, h: 220 },
  { type: "hazardPatch", x: 900, y: 500, w: 220, h: 180 },
  { type: "icePatch", x: 1660, y: 760, w: 200, h: 160 },
];

export const mapVariants = [
  {
    id: "default",
    name: "classic maze",
    difficulty: 1,
    goal: scaleMapPoint({ x: 1920, y: 1900, r: 95, holdMs: 5000 }),
    elements: trimScaledObstacleJoinOverhangs(defaultElements),
  },
  {
    id: "generated-1",
    name: "switchback maze",
    difficulty: 2,
    goal: scaleMapPoint({ x: 1840, y: 1850, r: 95, holdMs: 5000 }),
    elements: trimScaledObstacleJoinOverhangs(generatedOneElements),
  },
  {
    id: "hockey-rink",
    name: "hockey rink",
    theme: "hockeyRink",
    difficulty: 2,
    spawn: scaleMapPoint({ x: 1100, y: 1840, r: 29 }),
    goal: scaleMapPoint({ x: 1100, y: 320, r: 95, holdMs: 5000 }),
    elements: trimScaledObstacleJoinOverhangs(hockeyRinkElements),
  },
  {
    id: "kitchen-floor",
    name: "kitchen floor",
    theme: "kitchenFloor",
    difficulty: 2,
    spawn: scaleMapPoint({ x: 420, y: 1820, r: 29 }),
    goal: scaleMapPoint({ x: 1760, y: 420, r: 95, holdMs: 5000 }),
    elements: trimScaledObstacleJoinOverhangs(kitchenFloorElements),
  },
  {
    id: "living-room",
    name: "living room",
    theme: "livingRoom",
    difficulty: 2,
    spawn: scaleMapPoint({ x: 360, y: 1860, r: 29 }),
    goal: scaleMapPoint({ x: 1820, y: 440, r: 95, holdMs: 5000 }),
    elements: trimScaledObstacleJoinOverhangs(livingRoomElements),
  },
  {
    id: "parking-lot",
    name: "parking lot",
    theme: "parkingLot",
    difficulty: 3,
    spawn: scaleMapPoint({ x: 280, y: 1860, r: 29 }),
    goal: scaleMapPoint({ x: 1880, y: 340, r: 95, holdMs: 5000 }),
    elements: trimScaledObstacleJoinOverhangs(parkingLotElements),
  },
  {
    id: "sand-lot",
    name: "sand lot",
    theme: "sandLot",
    difficulty: 3,
    spawn: scaleMapPoint({ x: 300, y: 340, r: 29 }),
    goal: scaleMapPoint({ x: 1880, y: 1840, r: 95, holdMs: 5000 }),
    elements: trimScaledObstacleJoinOverhangs(sandLotElements),
  },
];
