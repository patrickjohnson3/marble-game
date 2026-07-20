import { hashMapSeed } from "./map-variants.js";

export const proceduralMapTemplates = [
  {
    id: "long-run",
    difficulty: 1,
    spawn: { x: 0.18, y: 0.2 },
    goal: { x: 0.82, y: 0.82 },
    walls: [
      { x: 0.22, y: 0.34, w: 0.34, h: 0.012 },
      { x: 0.56, y: 0.24, w: 0.012, h: 0.24 },
      { x: 0.3, y: 0.55, w: 0.38, h: 0.012 },
      { x: 0.68, y: 0.48, w: 0.012, h: 0.28 },
      { x: 0.16, y: 0.73, w: 0.34, h: 0.012 },
    ],
    roughPatches: [
      { x: 0.3, y: 0.42, w: 0.16, h: 0.1 },
      { x: 0.58, y: 0.74, w: 0.18, h: 0.1 },
    ],
    icePatches: [{ x: 0.66, y: 0.3, w: 0.12, h: 0.1 }],
  },
  {
    id: "switchbacks",
    difficulty: 2,
    spawn: { x: 0.2, y: 0.78 },
    goal: { x: 0.82, y: 0.2 },
    walls: [
      { x: 0.18, y: 0.62, w: 0.48, h: 0.012 },
      { x: 0.66, y: 0.46, w: 0.012, h: 0.28 },
      { x: 0.34, y: 0.42, w: 0.5, h: 0.012 },
      { x: 0.34, y: 0.22, w: 0.012, h: 0.28 },
      { x: 0.52, y: 0.78, w: 0.012, h: 0.14 },
    ],
    roughPatches: [
      { x: 0.2, y: 0.46, w: 0.18, h: 0.1 },
      { x: 0.58, y: 0.2, w: 0.14, h: 0.12 },
    ],
    icePatches: [{ x: 0.42, y: 0.66, w: 0.16, h: 0.1 }],
  },
  {
    id: "islands",
    difficulty: 3,
    spawn: { x: 0.16, y: 0.16 },
    goal: { x: 0.84, y: 0.84 },
    walls: [
      { x: 0.34, y: 0.18, w: 0.012, h: 0.28 },
      { x: 0.5, y: 0.28, w: 0.34, h: 0.012 },
      { x: 0.18, y: 0.52, w: 0.34, h: 0.012 },
      { x: 0.62, y: 0.52, w: 0.012, h: 0.3 },
      { x: 0.34, y: 0.76, w: 0.3, h: 0.012 },
    ],
    roughPatches: [
      { x: 0.4, y: 0.42, w: 0.16, h: 0.12 },
      { x: 0.68, y: 0.66, w: 0.14, h: 0.12 },
    ],
    icePatches: [
      { x: 0.2, y: 0.3, w: 0.14, h: 0.1 },
      { x: 0.5, y: 0.62, w: 0.14, h: 0.1 },
    ],
  },
];

export function createSeededRandom(seed) {
  let state = hashMapSeed(seed) || 1;

  return function nextRandom() {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomBetween(random, min, max) {
  return min + (max - min) * random();
}

export function pickRandom(random, values) {
  if (!Array.isArray(values) || values.length === 0) return null;
  return values[Math.floor(random() * values.length)];
}
