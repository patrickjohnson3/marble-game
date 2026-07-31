const realWorldThemes = new Set([
  "hockeyRink",
  "kitchenFloor",
  "livingRoom",
  "parkingLot",
  "sandLot",
]);

function rectFromRatio(world, rect) {
  return {
    x: rect.x * world.width,
    y: rect.y * world.height,
    w: rect.w * world.width,
    h: rect.h * world.height,
  };
}

function applyBox(element, rect) {
  element.style.left = rect.x + "px";
  element.style.top = rect.y + "px";
  element.style.width = rect.w + "px";
  element.style.height = rect.h + "px";
}

function appendBox(parent, className, world, rect, options = {}) {
  const element = document.createElement("div");

  element.className = className;
  applyBox(element, rectFromRatio(world, rect));
  if (Number.isFinite(options.angle)) {
    element.style.setProperty("--theme-angle", options.angle + "rad");
  }
  parent.appendChild(element);
  return element;
}

function appendCircle(parent, className, world, circle) {
  return appendBox(parent, className, world, {
    x: circle.x - circle.r,
    y: circle.y - circle.r,
    w: circle.r * 2,
    h: circle.r * 2,
  });
}

function appendKitchenCheerio(parent, world, circle, themeState) {
  const radius = 0.00525;
  const element = appendCircle(parent, "kitchenCheerio", world, {
    ...circle,
    r: radius,
  });
  const state = {
    element,
    originX: circle.x * world.width,
    originY: circle.y * world.height,
    pushX: 0,
    pushY: 0,
    radius: radius * world.width,
  };

  themeState.kitchenCheerios.push(state);
}

function appendFloor(parent, theme, world) {
  appendBox(parent, "mapThemeSurface " + theme + "Surface", world, {
    x: 0.055,
    y: 0.055,
    w: 0.89,
    h: 0.89,
  });
}

function renderHockeyRink({ underlay, overlay, world }) {
  appendFloor(underlay, "hockeyRink", world);
  appendBox(underlay, "rinkLine redLine horizontal", world, {
    x: 0.08,
    y: 0.496,
    w: 0.84,
    h: 0.008,
  });
  [0.32, 0.68].forEach((y) =>
    appendBox(underlay, "rinkLine blueLine horizontal", world, {
      x: 0.08,
      y,
      w: 0.84,
      h: 0.007,
    }),
  );
  appendCircle(underlay, "rinkCircle centerCircle", world, {
    x: 0.5,
    y: 0.5,
    r: 0.09,
  });
  [
    { x: 0.26, y: 0.24 },
    { x: 0.74, y: 0.24 },
    { x: 0.26, y: 0.76 },
    { x: 0.74, y: 0.76 },
  ].forEach((circle) =>
    appendCircle(underlay, "rinkCircle faceoffCircle", world, {
      ...circle,
      r: 0.06,
    }),
  );
  [0.105, 0.855].forEach((y) =>
    appendBox(overlay, "goalCrease", world, { x: 0.42, y, w: 0.16, h: 0.055 }),
  );
}

function renderKitchenFloor({ underlay, overlay, themeState, world }) {
  appendFloor(underlay, "kitchenFloor", world);
  [
    { x: 0.18, y: 0.31, w: 0.05, h: 0.05 },
    { x: 0.39, y: 0.2, w: 0.05, h: 0.05 },
    { x: 0.56, y: 0.58, w: 0.05, h: 0.05 },
    { x: 0.76, y: 0.73, w: 0.05, h: 0.05 },
  ].forEach((rect) => appendBox(underlay, "kitchenTileAccent", world, rect));
  [
    { x: 0.16, y: 0.49 },
    { x: 0.19, y: 0.52 },
    { x: 0.22, y: 0.48 },
    { x: 0.24, y: 0.55 },
    { x: 0.27, y: 0.51 },
    { x: 0.31, y: 0.57 },
    { x: 0.36, y: 0.46 },
    { x: 0.39, y: 0.5 },
    { x: 0.42, y: 0.55 },
    { x: 0.44, y: 0.61 },
    { x: 0.6, y: 0.37 },
    { x: 0.63, y: 0.39 },
    { x: 0.66, y: 0.36 },
    { x: 0.69, y: 0.4 },
    { x: 0.47, y: 0.68 },
    { x: 0.49, y: 0.71 },
    { x: 0.52, y: 0.69 },
    { x: 0.54, y: 0.73 },
    { x: 0.57, y: 0.7 },
    { x: 0.59, y: 0.75 },
    { x: 0.51, y: 0.77 },
    { x: 0.45, y: 0.74 },
    { x: 0.61, y: 0.8 },
    { x: 0.64, y: 0.76 },
    { x: 0.67, y: 0.82 },
    { x: 0.7, y: 0.78 },
    { x: 0.74, y: 0.84 },
    { x: 0.78, y: 0.8 },
    { x: 0.8, y: 0.87 },
    { x: 0.73, y: 0.69 },
    { x: 0.78, y: 0.64 },
    { x: 0.83, y: 0.71 },
    { x: 0.86, y: 0.59 },
    { x: 0.88, y: 0.67 },
  ].forEach((circle) =>
    appendKitchenCheerio(overlay, world, circle, themeState),
  );
  appendBox(underlay, "kitchenCleanerSpill", world, {
    x: 0.2,
    y: 0.74,
    w: 0.1,
    h: 0.08,
  });
}

function renderLivingRoom({ underlay, overlay, world }) {
  appendFloor(underlay, "livingRoom", world);
  appendBox(underlay, "themeRug", world, { x: 0.25, y: 0.3, w: 0.42, h: 0.34 });
  [
    { x: 0.1, y: 0.16, w: 0.34, h: 0.11 },
    { x: 0.7, y: 0.14, w: 0.12, h: 0.3 },
    { x: 0.35, y: 0.47, w: 0.24, h: 0.11 },
  ].forEach((rect) => appendBox(overlay, "themeObject sofa", world, rect));
  [
    { x: 0.13, y: 0.75, w: 0.22, h: 0.06 },
    { x: 0.69, y: 0.7, w: 0.2, h: 0.06 },
  ].forEach((rect) => appendBox(overlay, "themeObject shelf", world, rect));
  appendBox(overlay, "themeObject coffeeTable", world, {
    x: 0.4,
    y: 0.53,
    w: 0.18,
    h: 0.08,
  });
}

function renderParkingLot({ underlay, overlay, world }) {
  appendFloor(underlay, "parkingLot", world);
  [0.2, 0.36, 0.52, 0.68].forEach((x) =>
    appendBox(underlay, "parkingStripe", world, {
      x,
      y: 0.13,
      w: 0.006,
      h: 0.7,
    }),
  );
  [0.22, 0.52, 0.75].forEach((y) =>
    appendBox(underlay, "parkingDriveLine", world, {
      x: 0.1,
      y,
      w: 0.8,
      h: 0.004,
    }),
  );
  [
    { x: 0.16, y: 0.13, w: 0.18, h: 0.08 },
    { x: 0.47, y: 0.13, w: 0.18, h: 0.08 },
    { x: 0.14, y: 0.37, w: 0.08, h: 0.2 },
    { x: 0.75, y: 0.35, w: 0.08, h: 0.2 },
    { x: 0.32, y: 0.65, w: 0.22, h: 0.08 },
    { x: 0.66, y: 0.69, w: 0.2, h: 0.08 },
  ].forEach((rect) => appendBox(overlay, "themeObject parkedCar", world, rect));
  appendBox(underlay, "themeOil", world, {
    x: 0.42,
    y: 0.38,
    w: 0.13,
    h: 0.09,
  });
}

function renderSandLot({ underlay, overlay, world }) {
  appendFloor(underlay, "sandLot", world);
  [
    { x: 0.2, y: 0.18, w: 0.38, h: 0.035, angle: 0.28 },
    { x: 0.55, y: 0.46, w: 0.32, h: 0.035, angle: -0.4 },
    { x: 0.25, y: 0.78, w: 0.42, h: 0.035, angle: 0.12 },
  ].forEach((track) =>
    appendBox(underlay, "sandTrack", world, track, { angle: track.angle }),
  );
  [
    { x: 0.28, y: 0.43, r: 0.035 },
    { x: 0.7, y: 0.23, r: 0.028 },
    { x: 0.78, y: 0.72, r: 0.035 },
    { x: 0.44, y: 0.67, r: 0.025 },
  ].forEach((circle) =>
    appendCircle(overlay, "themeObject sandRock", world, circle),
  );
  [
    { x: 0.24, y: 0.5, w: 0.06, h: 0.04 },
    { x: 0.62, y: 0.18, w: 0.055, h: 0.038 },
    { x: 0.73, y: 0.6, w: 0.06, h: 0.04 },
  ].forEach((rect) => appendBox(overlay, "themeObject sandCrate", world, rect));
}

const renderers = {
  hockeyRink: renderHockeyRink,
  kitchenFloor: renderKitchenFloor,
  livingRoom: renderLivingRoom,
  parkingLot: renderParkingLot,
  sandLot: renderSandLot,
};

export function isRealWorldTheme(theme) {
  return realWorldThemes.has(theme);
}

function capVectorLength(x, y, maxLength) {
  const length = Math.hypot(x, y);
  if (length <= maxLength || length === 0) return { x, y };

  return {
    x: (x / length) * maxLength,
    y: (y / length) * maxLength,
  };
}

function distanceToSegment(point, start, end) {
  const segmentX = end.x - start.x;
  const segmentY = end.y - start.y;
  const lengthSq = segmentX * segmentX + segmentY * segmentY;
  const t =
    lengthSq > 0
      ? Math.max(
          0,
          Math.min(
            1,
            ((point.x - start.x) * segmentX + (point.y - start.y) * segmentY) /
              lengthSq,
          ),
        )
      : 1;
  const closest = {
    x: start.x + segmentX * t,
    y: start.y + segmentY * t,
  };

  return {
    closest,
    distance: Math.hypot(point.x - closest.x, point.y - closest.y),
  };
}

function pointInRect(point, rect) {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.w &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.h
  );
}

function cheerioSurfaceInfluence(point, elements = []) {
  const surface = elements.find(
    (element) =>
      ["gooPatch", "icePatch", "roughPatch", "waterPatch"].includes(
        element.type,
      ) && pointInRect(point, element),
  )?.type;

  return (
    {
      gooPatch: { maxPush: 0.55, shove: 0.36, speed: 0.015 },
      icePatch: { maxPush: 1.35, shove: 1.08, speed: 0.08 },
      roughPatch: { maxPush: 0.75, shove: 0.55, speed: 0.025 },
      waterPatch: { maxPush: 1.18, shove: 0.92, speed: 0.06 },
    }[surface] ?? { maxPush: 1, shove: 0.78, speed: 0.04 }
  );
}

export function updateMapThemeDynamics({
  mapConfig,
  marble,
  previousMarble = marble,
  themeState,
}) {
  if (mapConfig?.theme !== "kitchenFloor" || !marble) return;

  const cheerios = themeState?.kitchenCheerios ?? [];

  cheerios.forEach((cheerio) => {
    const { originX, originY, radius, pushX, pushY } = cheerio;
    const currentX = originX + pushX;
    const currentY = originY + pushY;
    const current = { x: currentX, y: currentY };
    const swept = distanceToSegment(current, previousMarble, marble);
    const dx = currentX - swept.closest.x;
    const dy = currentY - swept.closest.y;
    const distance = swept.distance;
    const influence = cheerioSurfaceInfluence(current, mapConfig.elements);
    const shoveDistance = marble.r + radius + 18;
    const maxPush = marble.r * 3.2 * influence.maxPush;
    if (distance >= shoveDistance) return;

    const speed = Math.hypot(marble.vx || 0, marble.vy || 0);
    const nx =
      distance > 0.001 ? dx / distance : (marble.vx || 1) / Math.max(speed, 1);
    const ny =
      distance > 0.001 ? dy / distance : (marble.vy || 0) / Math.max(speed, 1);
    const amount =
      (shoveDistance - distance) * influence.shove + speed * influence.speed;
    const cappedPush = capVectorLength(
      pushX + nx * amount,
      pushY + ny * amount,
      maxPush,
    );

    cheerio.pushX = cappedPush.x;
    cheerio.pushY = cappedPush.y;
    cheerio.element.style.setProperty(
      "--push-x",
      cappedPush.x.toFixed(1) + "px",
    );
    cheerio.element.style.setProperty(
      "--push-y",
      cappedPush.y.toFixed(1) + "px",
    );
  });
}

export function renderMapTheme({
  container,
  overlayContainer,
  mapConfig,
  themeState = {},
  world = mapConfig?.world,
}) {
  container.replaceChildren();
  overlayContainer.replaceChildren();
  themeState.kitchenCheerios = [];
  const theme = mapConfig?.theme;
  if (!theme || !renderers[theme] || !world) return;

  const underlay = document.createElement("div");
  const overlay = document.createElement("div");
  underlay.className = "mapThemeLayer theme-" + theme;
  overlay.className = "mapThemeOverlayLayer theme-" + theme;
  underlay.setAttribute("aria-hidden", "true");
  overlay.setAttribute("aria-hidden", "true");

  renderers[theme]({ overlay, underlay, themeState, world });
  container.replaceChildren(underlay);
  overlayContainer.replaceChildren(overlay);
}
