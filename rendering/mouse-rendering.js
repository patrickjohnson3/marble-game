const canvasSize = 240;
const canvasCenter = canvasSize / 2;
const bodyReferenceRadius = 44;
const healthBarWidth = 82;
const strideLength = 24;

function ellipse(context, x, y, rx, ry, color, angle = 0) {
  context.fillStyle = color;
  context.beginPath();
  context.ellipse(x, y, rx, ry, angle, 0, Math.PI * 2);
  context.fill();
}

function drawMouse(context, mouse) {
  const defeated = mouse.health <= 0;
  const gait = defeated
    ? 0
    : Math.sin(((mouse.gait ?? 0) * Math.PI * 2) / strideLength);
  const hitFlash = defeated ? 0 : mouse.hitFlash;
  const cos = Math.cos(mouse.angle);
  const sin = Math.sin(mouse.angle);
  const scale = mouse.r / bodyReferenceRadius;
  context.save();
  context.transform(cos * scale, sin * scale, -sin * scale, cos * scale, 0, 0);
  context.globalAlpha = defeated ? 0.65 : 1;

  // The thin tail and whiskers are cosmetic; the torso stays close to the
  // circular contact radius instead of hiding a large collision margin.
  context.lineCap = "round";
  context.lineWidth = 5;
  context.strokeStyle = "#b78f86";
  context.beginPath();
  context.moveTo(-35, 0);
  context.bezierCurveTo(-60, 8, -61, 27 + gait * 3, -82, 21 + gait * 3);
  context.quadraticCurveTo(-98, 18, -100, 5);
  context.stroke();

  ellipse(context, 0, 5, 43, defeated ? 22 : 35, "#332b282b");
  for (const side of [-1, 1]) {
    ellipse(
      context,
      -22 + gait * side * 4,
      side * 31,
      11,
      5,
      "#b89587",
      -side * 0.3,
    );
    ellipse(
      context,
      19 - gait * side * 4,
      side * 29,
      9,
      4,
      "#b89587",
      side * 0.3,
    );
  }

  // A tapered muzzle, round ears and long tail carry the silhouette at phone
  // scale; restrained coat highlights avoid a flat cartoon disk.
  context.save();
  if (defeated) context.transform(1, 0, 0.24, 0.7, 0, 0);
  ellipse(context, -5, 0, 38, 37, hitFlash > 0 ? "#d9c7ad" : "#796c5e");
  ellipse(context, -11, -5, 26, 27, hitFlash > 0 ? "#eee1cc" : "#938474");
  context.fillStyle = hitFlash > 0 ? "#e0ceb2" : "#8a7969";
  context.beginPath();
  context.moveTo(9, -28);
  context.bezierCurveTo(27, -25, 33, -13, 44, -5);
  context.quadraticCurveTo(49, 0, 44, 5);
  context.bezierCurveTo(33, 13, 27, 25, 9, 28);
  context.closePath();
  context.fill();
  for (const side of [-1, 1]) {
    ellipse(context, 10, side * 27, 13, 15, "#695c52", side * 0.25);
    ellipse(context, 12, side * 28, 9, 10, "#c59c91", side * 0.25);
    if (defeated) {
      context.strokeStyle = "#292725";
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(28, side * 12);
      context.lineTo(34, side * 10);
      context.stroke();
    } else {
      ellipse(context, 29, side * 12, 3.5, 4, "#242526");
      ellipse(context, 30, side * 12 - 1, 1, 1.2, "#fff6de");
    }
    context.strokeStyle = "#b9aba080";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(39, side * 4);
    context.lineTo(58, side * 13);
    context.moveTo(39, side * 6);
    context.lineTo(53, side * 20);
    context.stroke();
  }
  ellipse(context, 45, 0, 4, 4, "#b1847e");
  context.restore();
  context.restore();

  if (defeated) return;
  // Draw after restoring heading: health remains horizontal as the mouse turns.
  const fraction = Math.max(0, Math.min(1, mouse.health / mouse.maxHealth));
  const barY = -mouse.r - 20;
  context.fillStyle = "#322e29e6";
  context.fillRect(-healthBarWidth / 2 - 2, barY - 2, healthBarWidth + 4, 12);
  context.fillStyle = "#f6eddc";
  context.fillRect(-healthBarWidth / 2, barY, healthBarWidth, 8);
  context.fillStyle = hitFlash > 0 ? "#fff7cf" : "#b15b48";
  context.fillRect(-healthBarWidth / 2, barY, healthBarWidth * fraction, 8);
}

export function appendMouseCanvas(overlay, themeState, mouse) {
  if (!mouse) return;
  const canvas = document.createElement("canvas");
  canvas.className = "mouseCanvas";
  canvas.width = canvasSize;
  canvas.height = canvasSize;
  canvas.style.position = "absolute";
  canvas.style.left = -canvasCenter + "px";
  canvas.style.top = -canvasCenter + "px";
  canvas.style.width = canvasSize + "px";
  canvas.style.height = canvasSize + "px";
  canvas.style.pointerEvents = "none";
  canvas.setAttribute("aria-hidden", "true");
  overlay.appendChild(canvas);
  themeState.mouseCanvas = canvas;
  themeState.mouseContext = canvas.getContext("2d");
  themeState.mousePose = {};
  renderMouse(themeState, mouse);
}

export function renderMouse(themeState, mouse) {
  const canvas = themeState.mouseCanvas;
  if (!canvas) return;
  if (!mouse) {
    canvas.remove();
    themeState.mouseCanvas = null;
    themeState.mouseContext = null;
    themeState.mousePose = null;
    return;
  }
  const context = themeState.mouseContext;
  if (!context) return;
  const pose = themeState.mousePose;
  if (pose.x !== mouse.x || pose.y !== mouse.y) {
    canvas.style.transform = "translate(" + mouse.x + "px, " + mouse.y + "px)";
    pose.x = mouse.x;
    pose.y = mouse.y;
  }
  if (
    pose.r === mouse.r &&
    pose.angle === mouse.angle &&
    pose.health === mouse.health &&
    pose.maxHealth === mouse.maxHealth &&
    pose.hitFlash === mouse.hitFlash &&
    pose.gait === mouse.gait
  )
    return;
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, canvasSize, canvasSize);
  context.setTransform(1, 0, 0, 1, canvasCenter, canvasCenter);
  drawMouse(context, mouse);
  pose.r = mouse.r;
  pose.angle = mouse.angle;
  pose.health = mouse.health;
  pose.maxHealth = mouse.maxHealth;
  pose.hitFlash = mouse.hitFlash;
  pose.gait = mouse.gait;
}
