// Authored food spills in a 4400-unit kitchen. Offsets are local to each
// cluster; the same anchors place the flat floor litter and living ants.
const breakfastScatter = [
  {
    cheerios: [
      [-94, 38],
      [-30, 119],
      [39, 7],
      [86, 124],
      [175, 64],
      [226, 164],
      [295, 220],
      [405, 267],
    ],
    crumbs: [
      [-52, 20],
      [70, 74],
      [235, 142],
    ],
    ants: [
      [-160, 110],
      [132, 218],
      [364, 318],
    ],
  },
  {
    cheerios: [
      [-214, -91],
      [-147, 4],
      [-70, -66],
      [8, 24],
      [83, 102],
      [159, -39],
      [162, 42],
      [238, 179],
      [313, 99],
      [404, 161],
    ],
    crumbs: [
      [-171, -8],
      [56, 16],
      [268, 141],
    ],
    ants: [
      [-253, -145],
      [180, 228],
      [423, 128],
    ],
  },
  {
    cheerios: [
      [-171, -65],
      [-111, 36],
      [-54, -40],
      [9, 31],
      [105, 7],
      [110, 120],
      [200, 76],
      [292, 194],
    ],
    crumbs: [
      [-61, -30],
      [122, 61],
      [244, 102],
    ],
    ants: [
      [-242, 8],
      [237, 224],
    ],
  },
  {
    cheerios: [
      [-133, -74],
      [-82, 30],
      [0, -19],
      [37, 74],
      [118, 110],
      [132, -52],
      [210, 87],
      [321, 177],
    ],
    crumbs: [
      [-98, 14],
      [91, 38],
      [255, 122],
    ],
    ants: [
      [-181, 69],
      [345, 205],
    ],
  },
];

export const kitchenClusterPatterns = {
  cerealPacket: breakfastScatter[0],
  breakfastNapkin: breakfastScatter[1],
  cleanupScraps: breakfastScatter[2],
  drinkSpill: breakfastScatter[3],
};

export function kitchenPoint(cluster, [x, y]) {
  const cos = Math.cos(cluster.angle);
  const sin = Math.sin(cluster.angle);
  return {
    x: cluster.x + (x * cos - y * sin) / 4400,
    y: cluster.y + (x * sin + y * cos) / 4400,
  };
}
