const bodyReferenceRadius = 24;
const canvasReferenceRadius = 66;
const strideLength = 18;

function drawCockroach(context, cockroach) {
  const stunned = cockroach.mode === "stunned";
  const harassing = cockroach.mode === "harass";
  const stride = ((cockroach.gait ?? 0) * Math.PI * 2) / strideLength;
  const twitch = stunned ? Math.sin(cockroach.modeFrames * 0.5) : 0;
  const scale = cockroach.r / bodyReferenceRadius;
  const cos = Math.cos(cockroach.angle);
  const sin = Math.sin(cockroach.angle);
  context.save();
  context.transform(cos * scale, sin * scale, -sin * scale, cos * scale, 0, 0);
  context.fillStyle = "#3a281f2b";
  context.beginPath();
  context.ellipse(-1, 3, 24, 14, 0, 0, Math.PI * 2);
  context.fill();

  // Alternating tripods: the middle leg moves opposite its two neighbours.
  // All animation follows travelled distance, without advancing actor state.
  context.lineCap = "round";
  for (let side = -1; side <= 1; side += 2) {
    for (let leg = 0; leg < 3; leg += 1) {
      const swing = stunned
        ? twitch * 1.5
        : Math.sin(stride + leg * Math.PI + (side < 0 ? Math.PI : 0)) * 4;
      const rootX = 11 - leg * 11;
      const kneeX = rootX + 7 - leg * 6 + swing;
      const kneeY = side * (stunned ? 23 : 20);
      const footX = kneeX + 6 - leg * 9 + swing * 0.6;
      const footY = side * (stunned ? 29 : 28);
      context.strokeStyle = "#352318";
      context.lineWidth = 2.3;
      context.beginPath();
      context.moveTo(rootX, side * 9);
      context.lineTo(kneeX, kneeY);
      context.lineTo(footX, footY);
      context.stroke();
      context.strokeStyle = "#986642";
      context.lineWidth = 0.8;
      context.beginPath();
      context.moveTo(rootX, side * 9);
      context.lineTo(kneeX, kneeY);
      context.stroke();
      // A small tibial spine gives the silhouette its bristly, low stance.
      context.strokeStyle = "#423023";
      context.beginPath();
      context.moveTo(kneeX, kneeY);
      context.lineTo(kneeX - 3, kneeY + side * 4);
      context.moveTo(footX, footY);
      context.lineTo(footX - 3, footY + side * 1.5);
      context.stroke();
    }
  }

  context.strokeStyle = "#453024";
  context.lineWidth = 1.2;
  context.beginPath();
  for (let side = -1; side <= 1; side += 2) {
    context.moveTo(-20, side * 5);
    context.lineTo(-28, side * 9); // Paired short cerci, not a mammal's tail.
    const probe = stunned ? twitch : Math.sin(stride * 0.32 + side) * 2;
    context.moveTo(21, side * 3);
    context.quadraticCurveTo(
      stunned ? 25 : 42,
      side * (stunned ? 13 : 10 + probe),
      stunned ? 29 : 55,
      side * (stunned ? 22 : (harassing ? 18 : 25) + probe),
    );
  }
  context.stroke();

  const shell = context.createLinearGradient(-10, -14, 5, 14);
  shell.addColorStop(0, "#9b6034");
  shell.addColorStop(0.42, "#6e4025");
  shell.addColorStop(1, "#38251b");
  context.fillStyle = shell;
  context.strokeStyle = "#352319";
  context.lineWidth = 1.2;
  context.beginPath();
  context.ellipse(-5, 0, 19, 13.5, 0, 0, Math.PI * 2);
  context.fill();
  context.stroke();

  // Two long overlapping wing cases and restrained veins, not body segments
  // like the ants. The central seam remains readable at gameplay zoom.
  context.strokeStyle = "#37261ed9";
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(10, 0);
  context.quadraticCurveTo(-4, -1, -23, 0);
  context.stroke();
  context.strokeStyle = "#c792544d";
  context.lineWidth = 0.7;
  context.beginPath();
  for (let side = -1; side <= 1; side += 2) {
    context.moveTo(7, side * 3);
    context.quadraticCurveTo(-8, side * 5, -20, side * 4);
    context.moveTo(6, side * 6);
    context.quadraticCurveTo(-6, side * 10, -17, side * 8);
  }
  context.stroke();

  context.fillStyle = "#39271e";
  context.beginPath();
  context.ellipse(20, 0, 6, 6.5, 0, 0, Math.PI * 2);
  context.fill();
  const shield = context.createLinearGradient(9, -10, 15, 10);
  shield.addColorStop(0, "#b07a42");
  shield.addColorStop(0.3, "#754526");
  shield.addColorStop(1, "#482e20");
  context.fillStyle = shield;
  context.beginPath();
  context.ellipse(12, 0, 9, 10.5, 0, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = "#c998594f";
  context.lineWidth = 1;
  context.stroke();
  context.fillStyle = "#291e18";
  for (let side = -1; side <= 1; side += 2) {
    context.beginPath();
    context.ellipse(14, side * 4, 5, 1.4, 0.15 * side, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

export function appendCockroachCanvas(overlay, themeState, cockroach) {
  if (!cockroach) return;
  const canvas = document.createElement("canvas");
  canvas.className = "cockroachCanvas";
  canvas.style.position = "absolute";
  canvas.style.pointerEvents = "none";
  canvas.setAttribute("aria-hidden", "true");
  overlay.appendChild(canvas);
  themeState.cockroachCanvas = canvas;
  themeState.cockroachContext = canvas.getContext("2d");
  themeState.cockroachPose = {};
  renderCockroach(themeState, cockroach);
}

export function renderCockroach(themeState, cockroach) {
  const canvas = themeState.cockroachCanvas;
  if (!canvas) return;
  if (!cockroach) {
    canvas.remove();
    themeState.cockroachCanvas = null;
    themeState.cockroachContext = null;
    themeState.cockroachPose = null;
    return;
  }
  const context = themeState.cockroachContext;
  if (!context) return;
  const pose = themeState.cockroachPose;
  if (pose.r !== cockroach.r) {
    const size =
      Math.ceil((cockroach.r / bodyReferenceRadius) * canvasReferenceRadius) *
      2;
    canvas.width = canvas.height = size;
    canvas.style.width = canvas.style.height = size + "px";
    canvas.style.left = canvas.style.top = -size / 2 + "px";
  }
  if (pose.x !== cockroach.x || pose.y !== cockroach.y) {
    canvas.style.transform =
      "translate(" + cockroach.x + "px, " + cockroach.y + "px)";
    pose.x = cockroach.x;
    pose.y = cockroach.y;
  }
  const stunFrames = cockroach.mode === "stunned" ? cockroach.modeFrames : 0;
  if (
    pose.r === cockroach.r &&
    pose.angle === cockroach.angle &&
    pose.gait === cockroach.gait &&
    pose.mode === cockroach.mode &&
    pose.stunFrames === stunFrames
  )
    return;
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.setTransform(1, 0, 0, 1, canvas.width / 2, canvas.height / 2);
  drawCockroach(context, cockroach);
  pose.r = cockroach.r;
  pose.angle = cockroach.angle;
  pose.gait = cockroach.gait;
  pose.mode = cockroach.mode;
  pose.stunFrames = stunFrames;
}
