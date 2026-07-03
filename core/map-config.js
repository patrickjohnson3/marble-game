export const mapConfig = {
  world: {
    width: 2200,
    height: 2200
  },
  intro: {
    wallThickness: 34,
    viewportMargin: 18
  },
  camera: {
    minScale: 0.2,
    maxScale: 2.5,
    followLag: 0.08,
    predictiveLookAheadFrames: 18
  },
  light: {
    x: 420,
    y: 260,
    shadowMinDistance: 5,
    shadowMaxDistance: 12,
    shadowMinBlur: 8,
    shadowMaxBlur: 15,
    contactShadowY: 3,
    contactShadowBlur: 5
  },
  elements: [
    { type: "obstacle", x: 260, y: 330, w: 310, h: 42 },
    { type: "obstacle", x: 720, y: 250, w: 54, h: 360 },
    { type: "obstacle", x: 1320, y: 330, w: 430, h: 52 },
    { type: "obstacle", x: 1700, y: 600, w: 58, h: 430 },
    { type: "obstacle", x: 250, y: 900, w: 520, h: 54 },
    { type: "obstacle", x: 910, y: 760, w: 58, h: 380 },
    { type: "obstacle", x: 1180, y: 960, w: 520, h: 50 },
    { type: "obstacle", x: 520, y: 1380, w: 52, h: 440 },
    { type: "obstacle", x: 830, y: 1570, w: 620, h: 52 },
    { type: "obstacle", x: 1640, y: 1370, w: 52, h: 470 },
    { type: "roughPatch", x: 360, y: 650, w: 290, h: 220 },
    { type: "roughPatch", x: 1040, y: 520, w: 360, h: 240 },
    { type: "roughPatch", x: 1420, y: 1160, w: 330, h: 260 },
    { type: "roughPatch", x: 600, y: 1780, w: 420, h: 230 }
  ]
};
