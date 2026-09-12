function placeBox(element, rect) {
  element.style.left = rect.x + "px";
  element.style.top = rect.y + "px";
  element.style.width = rect.w + "px";
  element.style.height = rect.h + "px";
  element.style.transform = "rotate(" + (rect.angle ?? 0) + "rad)";
}

export function renderLivingRoom({ underlay, overlay, mapConfig, world }) {
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
