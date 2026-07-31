import { GAME_PHASES } from "../core/runtime-states.js";

export function createTrailRenderer({
  trailEl,
  trailSegmentsEl,
  marble,
  game,
  settings,
  config,
  clamp,
}) {
  const points = [];
  const pointPool = [];
  const segmentPool = [];
  const svgNamespace = "http://www.w3.org/2000/svg";
  let firstPointIndex = 0;

  function createSegment() {
    return document.createElementNS(svgNamespace, "line");
  }

  function addPoint(x, y, t) {
    const point = pointPool.pop() ?? { x: 0, y: 0, t: 0 };
    point.x = x;
    point.y = y;
    point.t = t;
    points.push(point);
  }

  function clear() {
    for (let i = firstPointIndex; i < points.length; i++) {
      pointPool.push(points[i]);
    }
    points.length = 0;
    firstPointIndex = 0;
    if (trailSegmentsEl.childNodes.length > 0)
      trailSegmentsEl.replaceChildren();
  }

  function update(now) {
    if (!settings.trailEnabled || game.phase === GAME_PHASES.waiting) {
      clear();
      return;
    }

    const last =
      points.length > firstPointIndex ? points[points.length - 1] : null;
    const movedEnough =
      !last ||
      Math.hypot(marble.x - last.x, marble.y - last.y) >= config.minDistance;
    const waitedEnough = !last || now - last.t >= config.minIntervalMs;

    if (movedEnough && waitedEnough) {
      addPoint(marble.x, marble.y, now);
    }

    const oldest = now - config.durationMs;
    while (
      firstPointIndex < points.length &&
      points[firstPointIndex].t < oldest
    ) {
      pointPool.push(points[firstPointIndex]);
      firstPointIndex++;
    }
    if (firstPointIndex === points.length) {
      points.length = 0;
      firstPointIndex = 0;
    } else if (firstPointIndex > 64) {
      points.splice(0, firstPointIndex);
      firstPointIndex = 0;
    }

    if (points.length - firstPointIndex < 2) {
      trailSegmentsEl.replaceChildren();
      return;
    }

    const segmentCount = points.length - firstPointIndex - 1;
    for (let i = firstPointIndex + 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];
      const opacity =
        clamp(1 - (now - b.t) / config.durationMs, 0, 1) * config.maxOpacity;
      const segmentIndex = i - firstPointIndex - 1;
      const segment = segmentPool[segmentIndex] ?? createSegment();
      segmentPool[segmentIndex] = segment;
      segment.setAttribute("x1", a.x.toFixed(1));
      segment.setAttribute("y1", a.y.toFixed(1));
      segment.setAttribute("x2", b.x.toFixed(1));
      segment.setAttribute("y2", b.y.toFixed(1));
      segment.setAttribute("opacity", opacity.toFixed(3));
      const parent = segment.parentNode ?? segment.parent;
      if (parent !== trailSegmentsEl) {
        trailSegmentsEl.appendChild(segment);
      }
    }

    while (trailSegmentsEl.childNodes.length > segmentCount) {
      trailSegmentsEl.childNodes[
        trailSegmentsEl.childNodes.length - 1
      ].remove();
    }
  }

  function setEnabled(enabled) {
    trailEl.hidden = !enabled;
    if (!enabled) clear();
  }

  return { clear, setEnabled, update };
}
