const canvasSize = 240;
const canvasCenter = canvasSize / 2;
const bodyReferenceRadius = 44;
const healthBarWidth = 82;
const strideLength = 24;
let mouseSprite = null;

function getMouseSprite() {
  if (!mouseSprite && typeof globalThis.Image === "function") {
    mouseSprite = new globalThis.Image();
    mouseSprite.decoding = "async";
    mouseSprite.src = "assets/sprites/mouse.webp";
  }
  return mouseSprite?.complete && mouseSprite.naturalWidth > 0
    ? mouseSprite
    : null;
}

function ellipse(context, x, y, rx, ry, color, angle = 0) {
  context.fillStyle = color;
  context.beginPath();
  context.ellipse(x, y, rx, ry, angle, 0, Math.PI * 2);
  context.fill();
}

function drawMouse(context, mouse, sprite) {
  const defeated = mouse.health <= 0;
  const gait = defeated
    ? 0
    : Math.sin(((mouse.gait ?? 0) * Math.PI * 2) / strideLength);
  const sniff = defeated ? 0 : Math.sin((mouse.pauseFrames ?? 0) * 0.65);
  const hitFlash = defeated ? 0 : mouse.hitFlash;
  const cos = Math.cos(mouse.angle);
  const sin = Math.sin(mouse.angle);
  const scale = mouse.r / bodyReferenceRadius;
  context.save();
  context.transform(cos * scale, sin * scale, -sin * scale, cos * scale, 0, 0);
  context.globalAlpha = defeated ? 0.65 : 1;

  // Tail and toes are cosmetic. Fur covers the same compact contact footprint;
  // the source image's transparent padding is included in these draw bounds.
  context.lineCap = "round";
  context.lineWidth = 5;
  context.strokeStyle = "#866961";
  context.beginPath();
  context.moveTo(-36, 0);
  context.bezierCurveTo(-55, 3, -63, 20 + gait * 3, -80, 18 + gait * 3);
  context.stroke();
  context.lineWidth = 2.5;
  context.strokeStyle = "#b69587";
  context.beginPath();
  context.moveTo(-39, 0);
  context.bezierCurveTo(-56, 4, -63, 20 + gait * 3, -80, 18 + gait * 3);
  context.quadraticCurveTo(-97, 17, -101, 5);
  context.stroke();

  ellipse(context, -3, 4, 41, defeated ? 23 : 35, "#332b282b");
  for (const side of [-1, 1]) {
    ellipse(
      context,
      -23 + gait * side * 4,
      side * 30,
      7,
      3,
      "#af9182",
      -side * 0.3,
    );
    ellipse(
      context,
      18 - gait * side * 4,
      side * 23,
      6,
      2.5,
      "#af9182",
      side * 0.3,
    );
  }

  context.save();
  if (defeated) context.transform(1, 0, 0.24, 0.7, 0, 0);
  if (sprite) {
    context.drawImage(sprite, -51, -76, 102, 152);
  } else {
    // A readable fallback while the image loads or if it fails offline.
    const coat = context.createRadialGradient(-12, -9, 2, -5, 0, 40);
    coat.addColorStop(0, "#a09480");
    coat.addColorStop(1, "#5c5147");
    ellipse(context, -8, 0, 35, 34, coat);
    ellipse(context, 21, 0, 25, 19, coat);
    for (const side of [-1, 1]) {
      ellipse(context, 15, side * 20, 7, 9, "#b09888");
      ellipse(context, 32, side * 8, 2, 2, "#242526");
    }
  }
  // Tiny muzzle/whisker motion remains visible during a stationary sniff.
  ellipse(context, 43 + sniff * 0.5, 0, 2, 2, "#97756c");
  context.strokeStyle = "#d4caba70";
  context.lineWidth = 0.6;
  context.beginPath();
  for (const side of [-1, 1]) {
    context.moveTo(40, side * 3);
    context.lineTo(53, side * (11 + sniff));
    context.moveTo(39, side * 5);
    context.lineTo(49, side * (17 - sniff));
  }
  context.stroke();
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
  if (mouseSprite && !mouseSprite.complete) {
    // Paused/waiting games do not poll dynamic rendering. Repaint on load, but
    // never let a retired canvas or actor paint over a Retry/new map.
    const image = mouseSprite;
    const repaint = () => {
      image.removeEventListener("load", repaint);
      image.removeEventListener("error", repaint);
      if (themeState.mouseCanvas === canvas) renderMouse(themeState, mouse);
    };
    image.addEventListener("load", repaint);
    image.addEventListener("error", repaint);
  }
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
  const sprite = getMouseSprite();
  const pose = themeState.mousePose;
  // Once defeated the pose is static, even if the last pause was unfinished.
  const pauseFrames = mouse.health > 0 ? mouse.pauseFrames : 0;
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
    pose.gait === mouse.gait &&
    pose.pauseFrames === pauseFrames &&
    pose.sprite === sprite
  )
    return;
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, canvasSize, canvasSize);
  context.setTransform(1, 0, 0, 1, canvasCenter, canvasCenter);
  drawMouse(context, mouse, sprite);
  pose.r = mouse.r;
  pose.angle = mouse.angle;
  pose.health = mouse.health;
  pose.maxHealth = mouse.maxHealth;
  pose.hitFlash = mouse.hitFlash;
  pose.gait = mouse.gait;
  pose.pauseFrames = pauseFrames;
  pose.sprite = sprite;
}
