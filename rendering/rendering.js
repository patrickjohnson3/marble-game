export function renderMapElements(container, className, elements) {
  container.replaceChildren(...elements.map((element) => {
    const el = document.createElement("div");
    el.className = className;
    el.style.left = element.x + "px";
    el.style.top = element.y + "px";
    el.style.width = element.w + "px";
    el.style.height = element.h + "px";
    return el;
  }));
}

export function renderWalls(container, walls) {
  renderMapElements(container, "wall", walls);
}
