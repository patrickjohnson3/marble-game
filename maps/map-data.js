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
  { type: "roughPatch", x: 360, y: 650, w: 290, h: 220 },
  { type: "roughPatch", x: 1040, y: 520, w: 360, h: 240 },
  { type: "roughPatch", x: 1420, y: 1160, w: 330, h: 260 },
  { type: "roughPatch", x: 600, y: 1780, w: 420, h: 230 },
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
  { type: "roughPatch", x: 460, y: 660, w: 310, h: 240 },
  { type: "roughPatch", x: 1450, y: 440, w: 280, h: 210 },
  { type: "roughPatch", x: 720, y: 1320, w: 350, h: 230 },
  { type: "roughPatch", x: 1370, y: 1620, w: 300, h: 240 },
];

export const mapVariants = [
  {
    id: "default",
    goal: { x: 1920, y: 1900, r: 95, holdMs: 5000 },
    elements: defaultElements,
  },
  {
    id: "generated-1",
    goal: { x: 1840, y: 1850, r: 95, holdMs: 5000 },
    elements: generatedOneElements,
  },
];
