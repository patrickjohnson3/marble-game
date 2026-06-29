function rectStyle(rect) {
  return "left:" + rect.x + "px;top:" + rect.y + "px;width:" + rect.w + "px;height:" + rect.h + "px";
}

export function renderMapElements(container, className, elements) {
  container.innerHTML = elements.map((element) => (
    '<div class="' + className + '" style="' + rectStyle(element) + '"></div>'
  )).join("");
}

export function renderWalls(container, walls) {
  renderMapElements(container, "wall", walls);
}
