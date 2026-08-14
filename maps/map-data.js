import {
  isHorizontalRect,
  rangesTouchOrOverlap,
} from "../core/map-obstacles.js";

const mapScale = 2;

function isHorizontalObstacle(element) {
  return element.type === "obstacle" && isHorizontalRect(element);
}

function scaledObstacleHitbox(element, isHorizontal) {
  return {
    ...(Number.isFinite(element.hitboxW)
      ? {
          hitboxW: isHorizontal ? element.hitboxW * mapScale : element.hitboxW,
        }
      : {}),
    ...(Number.isFinite(element.hitboxH)
      ? {
          hitboxH: isHorizontal ? element.hitboxH : element.hitboxH * mapScale,
        }
      : {}),
  };
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
      ...scaledObstacleHitbox(element, isHorizontal),
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
  { type: "gooPatch", x: 620, y: 900, w: 280, h: 230 },
  { type: "waterPatch", x: 1030, y: 640, w: 560, h: 380 },
  {
    type: "obstacle",
    fixture: "sponge",
    x: 260,
    y: 1170,
    w: 300,
    h: 140,
    hitboxW: 260,
    hitboxH: 120,
    angle: 0.16,
  },
  {
    type: "obstacle",
    fixture: "spoon",
    x: 1240,
    y: 1090,
    w: 360,
    h: 90,
    hitboxW: 310,
    hitboxH: 54,
    angle: 0.34,
  },
  {
    type: "obstacle",
    fixture: "fork",
    x: 960,
    y: 1450,
    w: 440,
    h: 420,
    hitboxW: 380,
    hitboxH: 62,
    angle: -0.42,
  },
];

const kitchenBreakfastElements = [
  { type: "waterPatch", x: 690, y: 1180, w: 520, h: 330 },
  { type: "gooPatch", x: 1370, y: 720, w: 250, h: 210 },
  {
    type: "obstacle",
    fixture: "fork",
    x: 340,
    y: 760,
    w: 420,
    h: 360,
    hitboxW: 360,
    hitboxH: 60,
    angle: 0.52,
  },
  {
    type: "obstacle",
    fixture: "spoon",
    x: 1300,
    y: 1460,
    w: 340,
    h: 90,
    hitboxW: 290,
    hitboxH: 52,
    angle: -0.26,
  },
  {
    type: "obstacle",
    fixture: "sponge",
    x: 330,
    y: 1520,
    w: 280,
    h: 130,
    hitboxW: 240,
    hitboxH: 110,
    angle: -0.18,
  },
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

const parkingLotPuddlesElements = [
  { type: "obstacle", x: 360, y: 300, w: 430, h: 150 },
  { type: "obstacle", x: 1060, y: 380, w: 420, h: 140 },
  { type: "obstacle", x: 280, y: 840, w: 150, h: 430 },
  { type: "obstacle", x: 1660, y: 760, w: 150, h: 430 },
  { type: "obstacle", x: 760, y: 1440, w: 460, h: 120 },
  { type: "obstacle", x: 1380, y: 1540, w: 420, h: 130 },
  { type: "waterPatch", x: 560, y: 660, w: 360, h: 230 },
  { type: "waterPatch", x: 1220, y: 1120, w: 410, h: 260 },
  { type: "hazardPatch", x: 960, y: 860, w: 250, h: 180 },
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

export const frozenGeneratedMapVariants = [
  {
    id: "generated-1-0",
    difficulty: 1,
    templateId: "switchbacks",
    terrainFocus: "icePatch",
    spawn: { x: 950, y: 3350, r: 29 },
    goal: { x: 3710, y: 770, r: 110, holdMs: 5000 },
    elements: [
      { type: "obstacle", x: 850, y: 2760, w: 2300, h: 50 },
      { type: "obstacle", x: 2950, y: 2030, w: 50, h: 1210 },
      { type: "obstacle", x: 1500, y: 1890, w: 2060, h: 50 },
      { type: "obstacle", x: 1510, y: 890, w: 50, h: 1120 },
      { type: "obstacle", x: 2330, y: 3430, w: 50, h: 600 },
      { type: "hazardPatch", x: 3210, y: 1340, w: 520, h: 450 },
    ],
  },
  {
    id: "generated-2-1",
    difficulty: 2,
    templateId: "islands",
    terrainFocus: "roughPatch",
    spawn: { x: 670, y: 730, r: 29 },
    goal: { x: 3690, y: 3700, r: 95, holdMs: 5000 },
    elements: [
      { type: "obstacle", x: 1540, y: 790, w: 50, h: 1380 },
      { type: "obstacle", x: 2150, y: 1200, w: 1350, h: 50 },
      { type: "obstacle", x: 770, y: 2220, w: 1620, h: 50 },
      { type: "obstacle", x: 2750, y: 2360, w: 50, h: 1420 },
      { type: "obstacle", x: 1560, y: 3270, w: 1250, h: 50 },
      { type: "hazardPatch", x: 1990, y: 2240, w: 590, h: 470 },
      { type: "roughPatch", x: 1690, y: 1750, w: 690, h: 610 },
      { type: "roughPatch", x: 2960, y: 2830, w: 710, h: 600 },
    ],
  },
  {
    id: "generated-3-2",
    difficulty: 3,
    templateId: "switchbacks",
    terrainFocus: "icePatch",
    spawn: { x: 890, y: 3360, r: 29 },
    goal: { x: 3630, y: 950, r: 84, holdMs: 5000 },
    elements: [
      { type: "obstacle", x: 830, y: 2700, w: 1990, h: 50 },
      { type: "obstacle", x: 2980, y: 1970, w: 50, h: 1200 },
      { type: "obstacle", x: 1430, y: 1920, w: 2200, h: 50 },
      { type: "obstacle", x: 1450, y: 960, w: 50, h: 1330 },
      { type: "obstacle", x: 2270, y: 3450, w: 50, h: 670 },
      { type: "hazardPatch", x: 3110, y: 1490, w: 520, h: 480 },
      { type: "icePatch", x: 1790, y: 2800, w: 700, h: 420 },
    ],
  },
  {
    id: "generated-1-3",
    difficulty: 1,
    templateId: "long-run",
    terrainFocus: "roughPatch",
    spawn: { x: 790, y: 870, r: 29 },
    goal: { x: 3710, y: 3690, r: 110, holdMs: 5000 },
    elements: [
      { type: "obstacle", x: 960, y: 1480, w: 1350, h: 50 },
      { type: "obstacle", x: 2400, y: 1100, w: 50, h: 1030 },
      { type: "obstacle", x: 1280, y: 2440, w: 1740, h: 50 },
      { type: "obstacle", x: 2970, y: 2080, w: 50, h: 1190 },
      { type: "obstacle", x: 740, y: 3210, w: 1490, h: 50 },
      { type: "hazardPatch", x: 1920, y: 2900, w: 490, h: 400 },
      { type: "roughPatch", x: 1270, y: 1860, w: 720, h: 470 },
    ],
  },
  {
    id: "generated-2-4",
    difficulty: 2,
    templateId: "long-run",
    terrainFocus: "roughPatch",
    spawn: { x: 740, y: 830, r: 29 },
    goal: { x: 3540, y: 3510, r: 95, holdMs: 5000 },
    elements: [
      { type: "obstacle", x: 960, y: 1470, w: 1590, h: 50 },
      { type: "obstacle", x: 2540, y: 1000, w: 50, h: 1130 },
      { type: "obstacle", x: 1390, y: 2480, w: 1850, h: 50 },
      { type: "obstacle", x: 2920, y: 2170, w: 50, h: 1290 },
      { type: "obstacle", x: 650, y: 3290, w: 1640, h: 50 },
      { type: "hazardPatch", x: 1920, y: 2890, w: 600, h: 360 },
      { type: "roughPatch", x: 1220, y: 1850, w: 770, h: 480 },
      { type: "roughPatch", x: 2470, y: 3150, w: 750, h: 510 },
    ],
  },
  {
    id: "generated-3-5",
    difficulty: 3,
    templateId: "switchbacks",
    terrainFocus: "icePatch",
    spawn: { x: 960, y: 3450, r: 29 },
    goal: { x: 3700, y: 790, r: 84, holdMs: 5000 },
    elements: [
      { type: "obstacle", x: 800, y: 2730, w: 2350, h: 50 },
      { type: "obstacle", x: 2910, y: 2050, w: 50, h: 1230 },
      { type: "obstacle", x: 1470, y: 1860, w: 2240, h: 50 },
      { type: "obstacle", x: 1490, y: 990, w: 50, h: 1300 },
      { type: "obstacle", x: 2320, y: 3480, w: 50, h: 610 },
      { type: "hazardPatch", x: 3220, y: 1490, w: 540, h: 450 },
      { type: "icePatch", x: 1830, y: 2890, w: 700, h: 490 },
    ],
  },
];

export const authoredMapVariants = [
  {
    id: "kitchen-floor",
    name: "kitchen floor",
    theme: "kitchenFloor",
    objectSummary:
      "objects: fork, spoon, sponge, water, green goo, Cheerios, crumbs, ants.",
    difficulty: 2,
    spawn: scaleMapPoint({ x: 420, y: 1820, r: 29 }),
    goal: scaleMapPoint({ x: 1760, y: 420, r: 95, holdMs: 5000 }),
    elements: trimScaledObstacleJoinOverhangs(kitchenFloorElements),
  },
  {
    id: "living-room",
    name: "living room",
    theme: "livingRoom",
    objectSummary: "objects: sofa, shelves, coffee table, rug, blocks, sock.",
    difficulty: 2,
    spawn: scaleMapPoint({ x: 360, y: 1860, r: 29 }),
    goal: scaleMapPoint({ x: 1820, y: 440, r: 95, holdMs: 5000 }),
    elements: trimScaledObstacleJoinOverhangs(livingRoomElements),
  },
  {
    id: "parking-lot",
    name: "parking lot",
    theme: "parkingLot",
    objectSummary:
      "objects: cars, cones, oil stains, tire marks, parking lines.",
    difficulty: 3,
    spawn: scaleMapPoint({ x: 280, y: 1860, r: 29 }),
    goal: scaleMapPoint({ x: 1880, y: 340, r: 95, holdMs: 5000 }),
    elements: trimScaledObstacleJoinOverhangs(parkingLotElements),
  },
  {
    id: "sand-lot",
    name: "sand lot",
    theme: "sandLot",
    objectSummary: "objects: rocks, crates, buckets, shovel, tire tracks.",
    difficulty: 3,
    spawn: scaleMapPoint({ x: 300, y: 340, r: 29 }),
    goal: scaleMapPoint({ x: 1880, y: 1840, r: 95, holdMs: 5000 }),
    elements: trimScaledObstacleJoinOverhangs(sandLotElements),
  },
  {
    id: "kitchen-breakfast-spill",
    name: "kitchen breakfast spill",
    theme: "kitchenFloor",
    objectSummary:
      "objects: fork, spoon, sponge, water, green goo, Cheerios, crumbs, ants.",
    difficulty: 2,
    spawn: scaleMapPoint({ x: 320, y: 1840, r: 29 }),
    goal: scaleMapPoint({ x: 1840, y: 360, r: 95, holdMs: 5000 }),
    elements: trimScaledObstacleJoinOverhangs(kitchenBreakfastElements),
  },
  {
    id: "parking-lot-puddles",
    name: "parking lot puddles",
    theme: "parkingLot",
    objectSummary:
      "objects: cars, cones, oil stains, tire marks, parking lines.",
    difficulty: 3,
    spawn: scaleMapPoint({ x: 280, y: 1860, r: 29 }),
    goal: scaleMapPoint({ x: 1880, y: 320, r: 95, holdMs: 5000 }),
    elements: trimScaledObstacleJoinOverhangs(parkingLotPuddlesElements),
  },
  {
    id: "hockey-rink",
    name: "hockey rink",
    theme: "hockeyRink",
    objectSummary: "objects: sticks, pucks, creases, rink markings.",
    difficulty: 2,
    spawn: scaleMapPoint({ x: 1100, y: 1840, r: 29 }),
    goal: scaleMapPoint({ x: 1100, y: 320, r: 95, holdMs: 5000 }),
    elements: trimScaledObstacleJoinOverhangs(hockeyRinkElements),
  },
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
];

export const mapVariants = [
  ...authoredMapVariants,
  ...frozenGeneratedMapVariants,
];
