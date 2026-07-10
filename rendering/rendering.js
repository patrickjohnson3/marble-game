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

function svgEl(tag) {
  return document.createElementNS("http://www.w3.org/2000/svg", tag);
}

let gradientId = 0;

function addLinearGradient(svg, colors) {
  gradientId++;
  const id = "wallGradient" + gradientId;
  const defs = svgEl("defs");
  const gradient = svgEl("linearGradient");
  gradient.setAttribute("id", id);
  gradient.setAttribute("x1", "0");
  gradient.setAttribute("y1", "0");
  gradient.setAttribute("x2", "1");
  gradient.setAttribute("y2", "1");
  colors.forEach(([offset, color]) => {
    const stop = svgEl("stop");
    stop.setAttribute("offset", offset);
    stop.setAttribute("stop-color", color);
    gradient.append(stop);
  });
  defs.append(gradient);
  svg.append(defs);
  return "url(#" + id + ")";
}

function rectPath(x, y, w, h) {
  return "M" + x + " " + y + "H" + (x + w) + "V" + (y + h) + "H" + x + "Z";
}

function coveredByAny(rects, left, top, right, bottom) {
  return rects.some((rect) =>
    left >= rect.x &&
    right <= rect.x + rect.w &&
    top >= rect.y &&
    bottom <= rect.y + rect.h
  );
}

function rectsTouchOrOverlap(a, b) {
  return a.x <= b.x + b.w &&
    b.x <= a.x + a.w &&
    a.y <= b.y + b.h &&
    b.y <= a.y + a.h;
}

function connectedRectGroups(rects) {
  const remaining = [...rects];
  const groups = [];

  while (remaining.length > 0) {
    const group = [remaining.shift()];
    for (let index = 0; index < group.length; index++) {
      for (let candidate = remaining.length - 1; candidate >= 0; candidate--) {
        if (!rectsTouchOrOverlap(group[index], remaining[candidate])) continue;
        group.push(remaining.splice(candidate, 1)[0]);
      }
    }
    groups.push(group);
  }

  return groups;
}

function mergedRectPaths(rects) {
  const xs = [...new Set(rects.flatMap((rect) => [rect.x, rect.x + rect.w]))].sort((a, b) => a - b);
  const ys = [...new Set(rects.flatMap((rect) => [rect.y, rect.y + rect.h]))].sort((a, b) => a - b);
  const covered = [];
  let fill = "";
  let outline = "";

  for (let y = 0; y < ys.length - 1; y++) {
    covered[y] = [];
    for (let x = 0; x < xs.length - 1; x++) {
      covered[y][x] = coveredByAny(rects, xs[x], ys[y], xs[x + 1], ys[y + 1]);
      if (covered[y][x]) {
        fill += rectPath(xs[x], ys[y], xs[x + 1] - xs[x], ys[y + 1] - ys[y]);
      }
    }
  }

  for (let y = 0; y < ys.length - 1; y++) {
    for (let x = 0; x < xs.length - 1; x++) {
      if (!covered[y][x]) continue;

      const left = xs[x];
      const right = xs[x + 1];
      const top = ys[y];
      const bottom = ys[y + 1];
      if (!covered[y - 1]?.[x]) outline += "M" + left + " " + top + "H" + right;
      if (!covered[y + 1]?.[x]) outline += "M" + left + " " + bottom + "H" + right;
      if (!covered[y]?.[x - 1]) outline += "M" + left + " " + top + "V" + bottom;
      if (!covered[y]?.[x + 1]) outline += "M" + right + " " + top + "V" + bottom;
    }
  }

  return { fill, outline };
}

function wallFramePath(walls) {
  const frame = wallFrameGeometry(walls);
  if (!frame) return "";

  return rectPath(frame.left, frame.top, frame.right - frame.left, frame.bottom - frame.top) +
    rectPath(frame.innerLeft, frame.innerTop, frame.innerRight - frame.innerLeft, frame.innerBottom - frame.innerTop);
}

export function wallFrameGeometry(walls) {
  if (!Array.isArray(walls) || walls.length === 0) return null;

  const left = Math.min(...walls.map((wall) => wall.x));
  const top = Math.min(...walls.map((wall) => wall.y));
  const right = Math.max(...walls.map((wall) => wall.x + wall.w));
  const bottom = Math.max(...walls.map((wall) => wall.y + wall.h));
  const verticalWalls = walls.filter((wall) => wall.w < wall.h);
  const horizontalWalls = walls.filter((wall) => wall.w > wall.h);
  if (verticalWalls.length === 0 || horizontalWalls.length === 0) return null;

  const innerLeft = Math.min(...verticalWalls.map((wall) => wall.x + wall.w));
  const innerRight = Math.max(...verticalWalls.map((wall) => wall.x));
  const innerTop = Math.min(...horizontalWalls.map((wall) => wall.y + wall.h));
  const innerBottom = Math.max(...horizontalWalls.map((wall) => wall.y));
  const thickness = Math.max(innerLeft - left, innerTop - top, right - innerRight, bottom - innerBottom);
  if (![left, top, right, bottom, innerLeft, innerRight, innerTop, innerBottom, thickness].every(Number.isFinite)) {
    return null;
  }
  if (right <= left || bottom <= top || innerRight <= innerLeft || innerBottom <= innerTop) return null;

  return {
    bottom,
    innerBottom,
    innerLeft,
    innerRight,
    innerTop,
    left,
    right,
    thickness,
    top
  };
}

function createWallSvg(className, walls) {
  const left = Math.min(...walls.map((wall) => wall.x));
  const top = Math.min(...walls.map((wall) => wall.y));
  const right = Math.max(...walls.map((wall) => wall.x + wall.w));
  const bottom = Math.max(...walls.map((wall) => wall.y + wall.h));
  const svg = svgEl("svg");
  svg.classList.add(className);
  svg.setAttribute("viewBox", left + " " + top + " " + (right - left) + " " + (bottom - top));
  svg.style.left = left + "px";
  svg.style.top = top + "px";
  svg.style.width = (right - left) + "px";
  svg.style.height = (bottom - top) + "px";
  return svg;
}

export function renderWalls(container, walls) {
  if (!Array.isArray(walls) || walls.length === 0) {
    container.replaceChildren();
    return;
  }
  const framePath = wallFramePath(walls);
  if (!framePath) {
    container.replaceChildren();
    return;
  }

  const svg = createWallSvg("wallSvg", walls);
  const fill = addLinearGradient(svg, [
    ["0%", "#f2f6fd"],
    ["48%", "#d8e2f0"],
    ["100%", "#a9b7cc"]
  ]);
  const frame = svgEl("path");
  frame.classList.add("wallFrame");
  frame.setAttribute("d", framePath);
  frame.setAttribute("fill-rule", "evenodd");
  frame.setAttribute("fill", fill);
  svg.append(frame);
  container.replaceChildren(svg);
}

export function renderObstacleWalls(container, obstacles) {
  if (obstacles.length === 0) {
    container.replaceChildren();
    return;
  }

  const svg = createWallSvg("obstacleSvg", obstacles);
  const obstacleGroups = connectedRectGroups(obstacles);
  obstacleGroups.forEach((group) => {
    const fill = addLinearGradient(svg, [
      ["0%", "#ffd166"],
      ["46%", "#ff9f66"],
      ["100%", "#ef476f"]
    ]);
    const fillPath = svgEl("path");
    fillPath.classList.add("obstacleWallFill");
    fillPath.setAttribute("d", mergedRectPaths(group).fill);
    fillPath.setAttribute("fill", fill);
    svg.append(fillPath);
  });
  const paths = mergedRectPaths(obstacles);
  const outlinePath = svgEl("path");
  outlinePath.classList.add("obstacleWallOutline");
  outlinePath.setAttribute("d", paths.outline);
  svg.append(outlinePath);
  container.replaceChildren(svg);
}
