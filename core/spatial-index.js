function cellStart(value, cellSize) {
  return Math.floor(value / cellSize);
}

function cellEnd(value, size, cellSize) {
  return Math.floor((value + size) / cellSize);
}

function cellBucket(cells, x, y) {
  return cells.get(x)?.get(y);
}

function addCellIndex(cells, x, y, index) {
  if (!cells.has(x)) cells.set(x, new Map());
  const column = cells.get(x);
  if (!column.has(y)) column.set(y, []);
  column.get(y).push(index);
}

export function createSpatialIndex(rects, { cellSize = 256 } = {}) {
  const source = Array.isArray(rects) ? rects : [];
  const cells = new Map();

  source.forEach((rect, index) => {
    const fromX = cellStart(rect.x, cellSize);
    const toX = cellEnd(rect.x, rect.w, cellSize);
    const fromY = cellStart(rect.y, cellSize);
    const toY = cellEnd(rect.y, rect.h, cellSize);

    for (let cy = fromY; cy <= toY; cy++) {
      for (let cx = fromX; cx <= toX; cx++) {
        addCellIndex(cells, cx, cy, index);
      }
    }
  });

  function queryCircleInto(circle, matches, seen) {
    matches.length = 0;
    seen.clear();

    const diameter = circle.r * 2;
    const fromX = cellStart(circle.x - circle.r, cellSize);
    const toX = cellEnd(circle.x - circle.r, diameter, cellSize);
    const fromY = cellStart(circle.y - circle.r, cellSize);
    const toY = cellEnd(circle.y - circle.r, diameter, cellSize);

    for (let cy = fromY; cy <= toY; cy++) {
      for (let cx = fromX; cx <= toX; cx++) {
        const bucket = cellBucket(cells, cx, cy);
        if (!bucket) continue;

        for (let i = 0; i < bucket.length; i++) {
          const index = bucket[i];

          if (seen.has(index)) continue;
          seen.add(index);
          matches.push(source[index]);
        }
      }
    }

    return matches;
  }

  function queryCircle(circle) {
    return queryCircleInto(circle, [], new Set());
  }

  return {
    cellSize,
    queryCircle,
    queryCircleInto,
    rects: source,
  };
}
