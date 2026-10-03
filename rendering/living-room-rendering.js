function placeBox(element, rect) {
  element.style.left = rect.x + "px";
  element.style.top = rect.y + "px";
  element.style.width = rect.w + "px";
  element.style.height = rect.h + "px";
  element.style.transform = "rotate(" + (rect.angle ?? 0) + "rad)";
}

export function renderLivingRoom({
  underlay,
  overlay,
  mapConfig,
  world,
  dynamicsState,
  themeState = {},
}) {
  const floor = document.createElement("div");
  floor.className = "mapThemeSurface livingRoomSurface";
  placeBox(floor, { x: 0, y: 0, w: world.width, h: world.height });
  underlay.appendChild(floor);

  for (const scenery of mapConfig.scenery ?? []) {
    const item = document.createElement("div");
    item.className = "themeObject livingRoomDressing " + scenery.kind;
    placeBox(item, scenery);
    overlay.appendChild(item);
  }
  themeState.popcornEntries = [];
  for (const piece of dynamicsState?.cheerios ?? []) {
    if (piece.kind !== "popcorn") continue;
    const element = document.createElement("div");
    element.className = "themeObject livingRoomPopcorn";
    element.style.left = "0px";
    element.style.top = "0px";
    element.style.width = piece.radius * 2 + "px";
    element.style.height = piece.radius * 2 + "px";
    overlay.appendChild(element);
    themeState.popcornEntries.push({
      piece,
      element,
      x: null,
      y: null,
      active: null,
    });
  }
  renderLivingRoomPopcorn(themeState);
}

export function renderLivingRoomPopcorn(themeState) {
  // Cache only the last painted pose. Physics owns every piece, and stationary
  // food needs neither canvas redraws nor repeated style changes.
  for (const entry of themeState.popcornEntries ?? []) {
    const { piece, element } = entry;
    if (
      entry.x === piece.x &&
      entry.y === piece.y &&
      entry.active === piece.active
    )
      continue;
    element.style.display = piece.active ? "" : "none";
    element.style.transform = `translate(${piece.x - piece.radius}px, ${piece.y - piece.radius}px) rotate(${piece.rotation}rad)`;
    entry.x = piece.x;
    entry.y = piece.y;
    entry.active = piece.active;
  }
}

export function renderLivingRoomFixtures(container, obstacles) {
  const layer = document.createElement("div");
  layer.className = "obstacleCanvas livingRoomObstacleLayer";
  layer.setAttribute("aria-hidden", "true");
  let blockIndex = 0;

  for (const fixture of obstacles) {
    const item = document.createElement("div");
    item.className = "livingRoomFixture " + (fixture.fixture ?? "");
    placeBox(item, fixture);
    // The authored rounded rectangle is shared with contact geometry. No
    // extra sprite padding or CSS border may expand the visible silhouette.
    item.style.borderRadius = (fixture.cornerRadius ?? 0) + "px";
    if (fixture.fixture) item.setAttribute("data-fixture", fixture.fixture);
    if (fixture.fixture === "toyBlock") {
      item.setAttribute("data-letter", "ABC"[blockIndex % 3]);
      item.style.setProperty(
        "--block-color",
        ["#b35643", "#687f78", "#c99e4c"][blockIndex % 3],
      );
      blockIndex += 1;
    }
    layer.appendChild(item);
  }
  container.replaceChildren(layer);
}
