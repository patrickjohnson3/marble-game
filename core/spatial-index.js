function cellRange(start, end, cellSize) {
  return {
    from: Math.floor(start / cellSize),
    to: Math.floor(end / cellSize)
  };
}

function cellKey(x, y) {
  return x + "," + y;
}

function rectCells(rect, cellSize) {
  const x = cellRange(rect.x, rect.x + rect.w, cellSize);
  const y = cellRange(rect.y, rect.y + rect.h, cellSize);
  const cells = [];

  for (let cy = y.from; cy <= y.to; cy++) {
    for (let cx = x.from; cx <= x.to; cx++) {
      cells.push(cellKey(cx, cy));
    }
  }

  return cells;
}

export function createSpatialIndex(rects, { cellSize = 256 } = {}) {
  const source = Array.isArray(rects) ? rects : [];
  const cells = new Map();

  source.forEach((rect, index) => {
    rectCells(rect, cellSize).forEach((key) => {
      if (!cells.has(key)) cells.set(key, []);
      cells.get(key).push(index);
    });
  });

  function queryCircle(circle) {
    const keys = rectCells({
      x: circle.x - circle.r,
      y: circle.y - circle.r,
      w: circle.r * 2,
      h: circle.r * 2
    }, cellSize);
    const seen = new Set();
    const matches = [];

    keys.forEach((key) => {
      (cells.get(key) || []).forEach((index) => {
        if (seen.has(index)) return;
        seen.add(index);
        matches.push(source[index]);
      });
    });

    return matches;
  }

  return {
    cellSize,
    queryCircle,
    rects: source
  };
}
