import { drawRoundedRect } from "./wall-rendering.js";

const sceneryScale = 0.35;

function placeBox(element, rect) {
  const width = rect.hitboxW ?? rect.w;
  const height = rect.hitboxH ?? rect.h;
  element.style.left = rect.x + rect.w / 2 - width / 2 + "px";
  element.style.top = rect.y + rect.h / 2 - height / 2 + "px";
  element.style.width = width + "px";
  element.style.height = height + "px";
  element.style.transform = "rotate(" + (rect.angle ?? 0) + "rad)";
}

function noise(index, seed) {
  let value = Math.imul(index + seed, 374761393);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}

function drawScenery(context, item) {
  const { w, h } = item;
  const angle = item.angle ?? 0;
  const seed = Math.round(item.x * 17 + item.y * 31);
  context.save();
  context.transform(
    Math.cos(angle),
    Math.sin(angle),
    -Math.sin(angle),
    Math.cos(angle),
    item.x + w / 2,
    item.y + h / 2,
  );
  context.transform(1, 0, 0, 1, -w / 2, -h / 2);
  if (item.kind === "parkingBay") {
    context.strokeStyle = "#e4dfc8a6";
    context.lineWidth = 13;
    context.beginPath();
    context.moveTo(0, h);
    context.lineTo(0, 0);
    context.lineTo(w, 0);
    context.lineTo(w, h);
    context.stroke();
  } else if (item.kind === "paintArrow") {
    context.fillStyle = "#e9e4cf9c";
    context.beginPath();
    context.moveTo(w / 2, 0);
    context.lineTo(w, h * 0.37);
    context.lineTo(w * 0.64, h * 0.37);
    context.lineTo(w * 0.64, h);
    context.lineTo(w * 0.36, h);
    context.lineTo(w * 0.36, h * 0.37);
    context.lineTo(0, h * 0.37);
    context.closePath();
    context.fill();
  } else if (item.kind === "oilMark") {
    const stain = context.createRadialGradient(
      w * 0.45,
      h * 0.46,
      0,
      w * 0.5,
      h * 0.5,
      Math.max(w, h) * 0.6,
    );
    stain.addColorStop(0, "#14171386");
    stain.addColorStop(0.55, "#22282048");
    stain.addColorStop(1, "#22282000");
    context.fillStyle = stain;
    for (let i = 0; i < 6; i += 1) {
      context.beginPath();
      context.ellipse(
        w * (0.3 + noise(i, seed) * 0.4),
        h * (0.25 + noise(i + 6, seed) * 0.5),
        w * (0.12 + noise(i + 12, seed) * 0.18),
        h * (0.12 + noise(i + 18, seed) * 0.18),
        0,
        0,
        Math.PI * 2,
      );
      context.fill();
    }
  } else if (item.kind === "crack") {
    context.strokeStyle = "#15191577";
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(0, h * 0.5);
    for (let i = 1; i <= 9; i += 1) {
      context.lineTo((w * i) / 9, h * (0.25 + noise(i, seed) * 0.5));
    }
    context.stroke();
    context.strokeStyle = "#aaab9b23";
    context.lineWidth = 1;
    context.stroke();
  } else if (item.kind === "litter") {
    context.fillStyle = "#a8946b";
    context.beginPath();
    context.moveTo(w * 0.12, h * 0.18);
    context.lineTo(w * 0.9, 0);
    context.lineTo(w, h * 0.86);
    context.lineTo(0, h);
    context.closePath();
    context.fill();
    context.strokeStyle = "#e1d7bb88";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(w * 0.18, h * 0.2);
    context.lineTo(w * 0.7, h * 0.78);
    context.stroke();
  }
  // Small missing paint chips reveal the real asphalt below, rather than
  // scattering extra contrasting marks over the driving lane.
  if (item.kind === "parkingBay" || item.kind === "paintArrow") {
    context.globalCompositeOperation = "destination-out";
    for (let i = 0; i < 150; i += 1) {
      context.fillRect(
        noise(i, seed) * w - 7,
        noise(i + 150, seed) * h - 7,
        2 + noise(i + 300, seed) * 7,
        2 + noise(i + 450, seed) * 6,
      );
    }
  }
  context.restore();
}

export function renderAuthoredParkingLot({ underlay, mapConfig, world }) {
  const floor = document.createElement("div");
  floor.className = "mapThemeSurface authoredParkingSurface";
  placeBox(floor, { x: 0, y: 0, w: world.width, h: world.height });
  underlay.appendChild(floor);

  const canvas = document.createElement("canvas");
  canvas.className = "parkingSceneryCanvas";
  canvas.width = Math.ceil(world.width * sceneryScale);
  canvas.height = Math.ceil(world.height * sceneryScale);
  placeBox(canvas, { x: 0, y: 0, w: world.width, h: world.height });
  canvas.setAttribute("aria-hidden", "true");
  const context = canvas.getContext("2d");
  if (context) {
    context.setTransform(sceneryScale, 0, 0, sceneryScale, 0, 0);
    for (const item of mapConfig.scenery ?? []) drawScenery(context, item);
  }
  underlay.appendChild(canvas);

  if (mapConfig.goal) {
    const exitPaint = document.createElement("div");
    exitPaint.className = "parkingExitPaint";
    exitPaint.textContent = "EXIT";
    placeBox(exitPaint, {
      x: mapConfig.goal.x - 175,
      y: mapConfig.goal.y + mapConfig.goal.r + 80,
      w: 350,
      h: 110,
    });
    underlay.appendChild(exitPaint);
  }
}

export function renderParkingFixtures(container, obstacles) {
  const layer = document.createElement("div");
  layer.className = "obstacleCanvas parkingObstacleLayer";
  layer.setAttribute("aria-hidden", "true");
  const renderedCars = new Set();
  for (const obstacle of obstacles) {
    const fixture = obstacle.fixtureSource ?? obstacle;
    if (fixture.fixture === "parkedCar") {
      if (renderedCars.has(fixture)) continue;
      renderedCars.add(fixture);
    }
    const item = document.createElement("div");
    item.className = "parkingFixture " + (fixture.fixture ?? "");
    item.setAttribute("data-fixture", fixture.fixture ?? "");
    placeBox(item, fixture);
    item.style.borderRadius = (fixture.cornerRadius ?? 0) + "px";
    if (fixture.fixture === "parkedCar") {
      const sprite = document.createElement("div");
      sprite.className = "parkingCarSprite";
      item.appendChild(sprite);
    }
    layer.appendChild(item);
  }
  container.replaceChildren(layer);
}

export function drawDrainOpening(context, patch) {
  // The black opening is the exact lethal rectangle. The narrow frame sits
  // outside it; no decorative grille falsely suggests a safe crossing.
  context.fillStyle = "#101511";
  context.fillRect(patch.x, patch.y, patch.w, patch.h);
  context.strokeStyle = "#635c49";
  context.lineWidth = 12;
  context.strokeRect(patch.x - 6, patch.y - 6, patch.w + 12, patch.h + 12);
  context.strokeStyle = "#a293715c";
  context.lineWidth = 2;
  context.strokeRect(patch.x - 11, patch.y - 11, patch.w + 22, patch.h + 22);
  const recess = context.createLinearGradient(
    patch.x,
    patch.y,
    patch.x + patch.w * 0.2,
    patch.y + patch.h * 0.3,
  );
  recess.addColorStop(0, "#36372b");
  recess.addColorStop(0.45, "#181d15");
  recess.addColorStop(1, "#090f0b");
  context.fillStyle = recess;
  context.fillRect(patch.x, patch.y, patch.w, patch.h);
  context.strokeStyle = "#77746266";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(patch.x + 18, patch.y + patch.h);
  context.lineTo(patch.x + 18, patch.y + 18);
  context.lineTo(patch.x + patch.w, patch.y + 18);
  context.stroke();
  context.fillStyle = "#262820";
  for (let i = 0; i < 4; i += 1) {
    const x = patch.x + patch.w * ((i % 2) * 0.84 + 0.08);
    const y = patch.y - 7 + Math.floor(i / 2) * (patch.h + 14);
    context.beginPath();
    context.ellipse(x, y, 3, 3, 0, 0, Math.PI * 2);
    context.fill();
  }
}

export function drawParkingGravel(context, patch) {
  const seed = Math.round(patch.x * 19 + patch.y * 7);
  const colors = ["#77756e", "#595750", "#a39c8b", "#494b46", "#8b8678"];
  context.save();
  context.beginPath();
  drawRoundedRect(context, patch, 2);
  context.clip();
  const base = context.createLinearGradient(
    patch.x,
    patch.y,
    patch.x + patch.w,
    patch.y + patch.h,
  );
  base.addColorStop(0, "#555650");
  base.addColorStop(0.55, "#4c4f48");
  base.addColorStop(1, "#636259");
  context.fillStyle = base;
  context.fillRect(patch.x, patch.y, patch.w, patch.h);
  // Fine aggregate fills the gaps between larger angular chips. This is baked
  // once; no noisy tile or grain generation runs during gameplay frames.
  const gritCount = Math.ceil((patch.w * patch.h) / 12);
  for (let i = 0; i < gritCount; i += 1) {
    const size = 1.4 + noise(i + gritCount * 2, seed) * 2.2;
    context.fillStyle = colors[i % colors.length];
    context.fillRect(
      patch.x + noise(i, seed) * patch.w,
      patch.y + noise(i + gritCount, seed) * patch.h,
      size,
      size * (0.5 + noise(i + gritCount * 3, seed)),
    );
  }
  const count = Math.ceil((patch.w * patch.h) / 80);
  for (let i = 0; i < count; i += 1) {
    const x = patch.x + noise(i, seed) * patch.w;
    const y = patch.y + noise(i + count, seed) * patch.h;
    const radius = 1.5 + noise(i + count * 2, seed) * 3;
    context.fillStyle = colors[i % colors.length];
    context.beginPath();
    context.moveTo(x - radius, y - radius * 0.25);
    context.lineTo(x + radius * 0.1, y - radius * 0.8);
    context.lineTo(x + radius, y + radius * 0.2);
    context.lineTo(x, y + radius * 0.65);
    context.closePath();
    context.fill();
  }
  context.strokeStyle = "#302d254d";
  context.lineWidth = 5;
  context.strokeRect(patch.x, patch.y, patch.w, patch.h);
  context.restore();
}
