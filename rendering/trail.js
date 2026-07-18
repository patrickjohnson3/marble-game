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
  const svgNamespace = "http://www.w3.org/2000/svg";

  function clear() {
    points.length = 0;
    if (trailSegmentsEl.childNodes.length > 0)
      trailSegmentsEl.replaceChildren();
  }

  function update(now) {
    if (!settings.trailEnabled || game.phase === "waiting") {
      clear();
      return;
    }

    const last = points[points.length - 1];
    const movedEnough =
      !last ||
      Math.hypot(marble.x - last.x, marble.y - last.y) >= config.minDistance;
    const waitedEnough = !last || now - last.t >= config.minIntervalMs;

    if (movedEnough && waitedEnough) {
      points.push({ x: marble.x, y: marble.y, t: now });
    }

    const oldest = now - config.durationMs;
    while (points.length > 0 && points[0].t < oldest) {
      points.shift();
    }

    if (points.length < 2) {
      trailSegmentsEl.replaceChildren();
      return;
    }

    const segments = [];
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];
      const opacity =
        clamp(1 - (now - b.t) / config.durationMs, 0, 1) * config.maxOpacity;
      const segment = document.createElementNS(svgNamespace, "line");
      segment.setAttribute("x1", a.x.toFixed(1));
      segment.setAttribute("y1", a.y.toFixed(1));
      segment.setAttribute("x2", b.x.toFixed(1));
      segment.setAttribute("y2", b.y.toFixed(1));
      segment.setAttribute("opacity", opacity.toFixed(3));
      segments.push(segment);
    }
    trailSegmentsEl.replaceChildren(...segments);
  }

  function setEnabled(enabled) {
    trailEl.hidden = !enabled;
    if (!enabled) clear();
  }

  return { clear, setEnabled, update };
}
