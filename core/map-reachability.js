import { circleRectContact, clamp } from "./geometry.js";

export function hasReachableGoal({ world, obstacles, spawn, goal, cellSize }) {
  const radius = spawn.r;
  const columns = Math.ceil(world.width / cellSize);
  const rows = Math.ceil(world.height / cellSize);
  const visited = new Set();
  const queue = [];
  const holdRadius = Math.max(0, goal.r - radius);
  const goalHoldSamples = [
    goal,
    { x: goal.x - holdRadius, y: goal.y },
    { x: goal.x + holdRadius, y: goal.y },
    { x: goal.x, y: goal.y - holdRadius },
    { x: goal.x, y: goal.y + holdRadius }
  ];
  let queueIndex = 0;

  function cellKey(x, y) {
    return x + "," + y;
  }

  function cellCenter(x, y) {
    return {
      x: clamp(x * cellSize + cellSize / 2, radius, world.width - radius),
      y: clamp(y * cellSize + cellSize / 2, radius, world.height - radius)
    };
  }

  function pointCell(point) {
    return {
      x: clamp(Math.floor(point.x / cellSize), 0, columns - 1),
      y: clamp(Math.floor(point.y / cellSize), 0, rows - 1)
    };
  }

  function sameCell(point, cell) {
    const pointCellPosition = pointCell(point);
    return pointCellPosition.x === cell.x && pointCellPosition.y === cell.y;
  }

  function cellSamples(cell) {
    return [
      cellCenter(cell.x, cell.y),
      ...(sameCell(spawn, cell) ? [spawn] : []),
      ...goalHoldSamples.filter((point) => sameCell(point, cell))
    ];
  }

  function passable(point) {
    if (point.x - radius < 0 ||
        point.y - radius < 0 ||
        point.x + radius > world.width ||
        point.y + radius > world.height) {
      return false;
    }
    return !obstacles.some((obstacle) => circleRectContact({ x: point.x, y: point.y, r: radius }, obstacle).intersects);
  }

  function reachesGoal(point) {
    return Math.hypot(point.x - goal.x, point.y - goal.y) + radius <= goal.r;
  }

  const start = pointCell(spawn);
  queue.push(start);
  visited.add(cellKey(start.x, start.y));

  while (queueIndex < queue.length) {
    const cell = queue[queueIndex++];
    const samples = cellSamples(cell);
    if (!samples.some(passable)) continue;
    if (samples.some((point) => passable(point) && reachesGoal(point))) return true;

    [
      { x: cell.x + 1, y: cell.y },
      { x: cell.x - 1, y: cell.y },
      { x: cell.x, y: cell.y + 1 },
      { x: cell.x, y: cell.y - 1 }
    ].forEach((next) => {
      if (next.x < 0 || next.y < 0 || next.x >= columns || next.y >= rows) return;
      const key = cellKey(next.x, next.y);
      if (visited.has(key)) return;
      visited.add(key);
      queue.push(next);
    });
  }

  return false;
}
