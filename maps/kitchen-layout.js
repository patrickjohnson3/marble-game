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

export const kitchenLayouts = {
  "kitchen-floor": [
    // Open packet by the entry; food trails toward the cutlery.
    { x: 0.253, y: 0.795, angle: -0.25, ...breakfastScatter[0] },
    // Scattered breakfast beneath the fork head, across the lower floor.
    { x: 0.667, y: 0.767, angle: 0.12, ...breakfastScatter[1] },
    // Wiped-up scraps just below the sponge and sticky spill.
    { x: 0.245, y: 0.532, angle: 0.42, ...breakfastScatter[2] },
    // A drink ring and food on the dry side of the water.
    { x: 0.765, y: 0.37, angle: -0.62, ...breakfastScatter[3] },
  ],
  "kitchen-breakfast-spill": [
    { x: 0.213, y: 0.805, angle: -0.18, ...breakfastScatter[0] },
    { x: 0.19, y: 0.48, angle: 0.64, ...breakfastScatter[1] },
    { x: 0.585, y: 0.613, angle: -0.45, ...breakfastScatter[2] },
    { x: 0.79, y: 0.48, angle: -0.15, ...breakfastScatter[3] },
  ],
};

export function kitchenPoint(cluster, [x, y]) {
  const cos = Math.cos(cluster.angle);
  const sin = Math.sin(cluster.angle);
  return {
    x: cluster.x + (x * cos - y * sin) / 4400,
    y: cluster.y + (x * sin + y * cos) / 4400,
  };
}
