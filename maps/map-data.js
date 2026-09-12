import { expandMap } from "./map-authoring.js";
import { kitchenFloorMap } from "./kitchen-floor.js";
import { kitchenBreakfastMap } from "./kitchen-breakfast.js";
import { livingRoomMap } from "./living-room.js";

export const mapDefinitions = [
  kitchenFloorMap,
  livingRoomMap,
  kitchenBreakfastMap,
];

const defaultElements = [
  { type: "obstacle", x: 520, y: 660, w: 1020, h: 40 },
  { type: "obstacle", x: 1440, y: 500, w: 50, h: 720 },
  { type: "obstacle", x: 2640, y: 660, w: 860, h: 50 },
  { type: "obstacle", x: 3400, y: 1200, w: 60, h: 860 },
  { type: "obstacle", x: 500, y: 1800, w: 1440, h: 50 },
  { type: "obstacle", x: 1820, y: 1520, w: 60, h: 760 },
  { type: "obstacle", x: 2360, y: 1920, w: 1040, h: 50 },
  { type: "obstacle", x: 1040, y: 2760, w: 50, h: 880 },
  { type: "obstacle", x: 1040, y: 3140, w: 1860, h: 50 },
  { type: "obstacle", x: 3280, y: 2740, w: 50, h: 940 },
  { type: "icePatch", x: 1600, y: 1040, w: 460, h: 420 },
  { type: "hazardPatch", x: 2080, y: 2440, w: 440, h: 320 },
  { type: "roughPatch", x: 720, y: 1300, w: 580, h: 440 },
  { type: "roughPatch", x: 2840, y: 2320, w: 660, h: 520 },
  { type: "roughPatch", x: 3360, y: 3200, w: 600, h: 460 },
];

const generatedOneElements = [
  { type: "obstacle", x: 720, y: 840, w: 1120, h: 50 },
  { type: "obstacle", x: 1740, y: 840, w: 50, h: 720 },
  { type: "obstacle", x: 2520, y: 600, w: 50, h: 940 },
  { type: "obstacle", x: 2520, y: 1440, w: 1040, h: 50 },
  { type: "obstacle", x: 600, y: 2160, w: 1360, h: 50 },
  { type: "obstacle", x: 600, y: 2160, w: 50, h: 840 },
  { type: "obstacle", x: 2320, y: 2360, w: 1320, h: 50 },
  { type: "obstacle", x: 3540, y: 2360, w: 50, h: 1000 },
  { type: "obstacle", x: 1240, y: 3360, w: 1200, h: 50 },
  { type: "obstacle", x: 2340, y: 2920, w: 50, h: 540 },
  { type: "icePatch", x: 1960, y: 1680, w: 520, h: 440 },
  { type: "hazardPatch", x: 2720, y: 3120, w: 480, h: 340 },
  { type: "roughPatch", x: 920, y: 1320, w: 620, h: 480 },
  { type: "roughPatch", x: 1440, y: 2640, w: 700, h: 460 },
  { type: "roughPatch", x: 3280, y: 1880, w: 520, h: 420 },
];

const hockeyRinkElements = [
  { type: "icePatch", x: 360, y: 360, w: 3680, h: 3680 },
  { type: "obstacle", x: 880, y: 640, w: 1040, h: 40 },
  { type: "obstacle", x: 2480, y: 3680, w: 1040, h: 40 },
  { type: "obstacle", x: 480, y: 1400, w: 50, h: 720 },
  { type: "obstacle", x: 3820, y: 2280, w: 50, h: 720 },
  { type: "hazardPatch", x: 2000, y: 1960, w: 400, h: 400 },
  { type: "roughPatch", x: 920, y: 3160, w: 520, h: 340 },
];

const parkingLotElements = [
  { type: "obstacle", x: 720, y: 600, w: 860, h: 150 },
  { type: "obstacle", x: 2040, y: 600, w: 860, h: 150 },
  { type: "obstacle", x: 600, y: 1640, w: 150, h: 860 },
  { type: "obstacle", x: 3360, y: 1520, w: 150, h: 860 },
  { type: "obstacle", x: 1440, y: 2880, w: 1000, h: 120 },
  { type: "obstacle", x: 2760, y: 3040, w: 860, h: 130 },
  { type: "hazardPatch", x: 1840, y: 1640, w: 520, h: 380 },
  { type: "hazardPatch", x: 2640, y: 2480, w: 440, h: 360 },
  { type: "icePatch", x: 1040, y: 2440, w: 520, h: 420 },
  { type: "roughPatch", x: 2960, y: 840, w: 600, h: 460 },
];

const parkingLotPuddlesElements = [
  { type: "obstacle", x: 720, y: 600, w: 860, h: 150 },
  { type: "obstacle", x: 2120, y: 760, w: 840, h: 140 },
  { type: "obstacle", x: 560, y: 1680, w: 150, h: 860 },
  { type: "obstacle", x: 3320, y: 1520, w: 150, h: 860 },
  { type: "obstacle", x: 1520, y: 2880, w: 920, h: 120 },
  { type: "obstacle", x: 2760, y: 3080, w: 840, h: 130 },
  { type: "waterPatch", x: 1120, y: 1320, w: 720, h: 460 },
  { type: "waterPatch", x: 2440, y: 2240, w: 820, h: 520 },
  { type: "hazardPatch", x: 1920, y: 1720, w: 500, h: 360 },
  { type: "roughPatch", x: 2960, y: 840, w: 600, h: 460 },
];

const sandLotElements = [
  { type: "roughPatch", x: 440, y: 520, w: 1300, h: 1040 },
  { type: "roughPatch", x: 2240, y: 680, w: 1520, h: 1040 },
  { type: "roughPatch", x: 840, y: 2520, w: 1480, h: 1120 },
  { type: "obstacle", x: 1040, y: 1880, w: 1040, h: 60 },
  { type: "obstacle", x: 1960, y: 1880, w: 60, h: 840 },
  { type: "obstacle", x: 2760, y: 2120, w: 860, h: 60 },
  { type: "obstacle", x: 2760, y: 2120, w: 60, h: 720 },
  { type: "hazardPatch", x: 2960, y: 3080, w: 520, h: 440 },
  { type: "hazardPatch", x: 1800, y: 1000, w: 440, h: 360 },
  { type: "icePatch", x: 3320, y: 1520, w: 400, h: 320 },
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
  expandMap(kitchenFloorMap),
  expandMap(livingRoomMap),
  {
    id: "parking-lot",
    name: "parking lot",
    theme: "parkingLot",
    objectSummary:
      "objects: cars, cones, oil stains, tire marks, parking lines.",
    difficulty: 3,
    spawn: { x: 560, y: 3720, r: 29 },
    goal: { x: 3760, y: 680, r: 84, holdMs: 5000 },
    elements: parkingLotElements,
  },
  {
    id: "sand-lot",
    name: "sand lot",
    theme: "sandLot",
    objectSummary: "objects: rocks, crates, buckets, shovel, tire tracks.",
    difficulty: 3,
    spawn: { x: 600, y: 680, r: 29 },
    goal: { x: 3760, y: 3680, r: 84, holdMs: 5000 },
    elements: sandLotElements,
  },
  expandMap(kitchenBreakfastMap),
  {
    id: "parking-lot-puddles",
    name: "parking lot puddles",
    theme: "parkingLot",
    objectSummary:
      "objects: cars, cones, oil stains, tire marks, parking lines.",
    difficulty: 3,
    spawn: { x: 560, y: 3720, r: 29 },
    goal: { x: 3760, y: 640, r: 84, holdMs: 5000 },
    elements: parkingLotPuddlesElements,
  },
  {
    id: "hockey-rink",
    name: "hockey rink",
    theme: "hockeyRink",
    objectSummary: "objects: sticks, pucks, creases, rink markings.",
    difficulty: 2,
    spawn: { x: 2200, y: 3680, r: 29 },
    goal: { x: 2200, y: 640, r: 95, holdMs: 5000 },
    elements: hockeyRinkElements,
  },
  {
    id: "default",
    name: "classic maze",
    difficulty: 1,
    goal: { x: 3840, y: 3800, r: 110, holdMs: 5000 },
    elements: defaultElements,
  },
  {
    id: "generated-1",
    name: "switchback maze",
    difficulty: 2,
    goal: { x: 3680, y: 3700, r: 95, holdMs: 5000 },
    elements: generatedOneElements,
  },
];

export const mapVariants = [
  ...authoredMapVariants,
  ...frozenGeneratedMapVariants,
];
