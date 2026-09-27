const canvasReferenceRadius = 120;
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

  // Tail and toes are cosmetic. The square sprite keeps its native aspect
  // ratio; the three contact circles follow its tapered body.
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

  ellipse(context, -3, 3, 41, defeated ? 16 : 23, "#332b282b");
  for (const side of [-1, 1]) {
    ellipse(
      context,
      -23 + gait * side * 4,
      side * 22,
      7,
      3,
      "#af9182",
      -side * 0.3,
    );
    ellipse(
      context,
      18 - gait * side * 4,
      side * 16,
      6,
      2.5,
      "#af9182",
      side * 0.3,
    );
  }

  context.save();
  if (defeated) context.transform(1, 0, 0.24, 0.7, 0, 0);
  if (sprite) {
    context.drawImage(sprite, -51, -51, 102, 102);
  } else {
    // A readable fallback while the image loads or if it fails offline.
    const coat = context.createRadialGradient(-12, -9, 2, -5, 0, 40);
    coat.addColorStop(0, "#a09480");
    coat.addColorStop(1, "#5c5147");
    ellipse(context, -8, 0, 35, 23, coat);
    ellipse(context, 21, 0, 25, 13, coat);
    for (const side of [-1, 1]) {
      ellipse(context, 15, side * 14, 7, 6, "#b09888");
      ellipse(context, 32, side * 5.5, 2, 2, "#242526");
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
  const barWidth = healthBarWidth * scale;
  const barY = -mouse.r - 20;
  context.fillStyle = "#322e29e6";
  context.fillRect(-barWidth / 2 - 2, barY - 2, barWidth + 4, 12);
  context.fillStyle = "#f6eddc";
  context.fillRect(-barWidth / 2, barY, barWidth, 8);
  context.fillStyle = hitFlash > 0 ? "#fff7cf" : "#b15b48";
  context.fillRect(-barWidth / 2, barY, barWidth * fraction, 8);
}

export function appendMouseCanvas(overlay, themeState, mouse) {
  if (!mouse) return;
  const canvas = document.createElement("canvas");
  canvas.className = "mouseCanvas";
  canvas.style.position = "absolute";
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
    const cleanup = () => {
      image.removeEventListener("load", repaint);
      image.removeEventListener("error", repaint);
      themeState.mouseSpriteCleanup = null;
    };
    const repaint = () => {
      cleanup();
      if (themeState.mouseCanvas === canvas) renderMouse(themeState, mouse);
    };
    themeState.mouseSpriteCleanup = cleanup;
    image.addEventListener("load", repaint);
    image.addEventListener("error", repaint);
  }
}

export function renderMouse(themeState, mouse) {
  const canvas = themeState.mouseCanvas;
  if (!canvas) return;
  if (!mouse) {
    themeState.mouseSpriteCleanup?.();
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
  if (pose.r !== mouse.r) {
    // Reserve room for the rotating tail as well as the collision-sized body.
    // Derive storage from actor size so tuning radius cannot silently clip art.
    const size =
      Math.ceil((mouse.r / bodyReferenceRadius) * canvasReferenceRadius) * 2;
    canvas.width = canvas.height = size;
    canvas.style.width = canvas.style.height = size + "px";
    canvas.style.left = canvas.style.top = -size / 2 + "px";
  }
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
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.setTransform(1, 0, 0, 1, canvas.width / 2, canvas.height / 2);
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
