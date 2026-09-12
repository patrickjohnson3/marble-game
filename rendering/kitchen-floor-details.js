// Flat, authored litter, baked into the existing floor canvas at map load.
// Raised food remains in kitchen-dynamics, where the marble and ants affect it.
const riceGrains = [
  [-142, 27, 0.2],
  [-119, 49, -0.8],
  [-92, 1, 0.5],
  [-73, 67, 1.1],
  [-40, 13, -0.4],
  [-11, 103, 0.7],
  [15, 74, -1.2],
  [55, 132, 0.1],
  [82, 100, -0.6],
  [123, 161, 1.3],
  [152, 130, 0.4],
  [194, 188, -0.3],
];

function drawPacket(context) {
  // An empty, opened paper packet: torn lip and folded white reverse.
  const paper = context.createLinearGradient(-150, -160, 20, -10);
  paper.addColorStop(0, "#b6a37c");
  paper.addColorStop(0.45, "#d6c397");
  paper.addColorStop(1, "#bdaa82");
  context.beginPath();
  context.moveTo(-153, -157);
  context.lineTo(28, -143);
  context.lineTo(47, -27);
  context.lineTo(28, -39);
  context.lineTo(12, -24);
  context.lineTo(-8, -34);
  context.lineTo(-21, -21);
  context.lineTo(-43, -31);
  context.lineTo(-62, -18);
  context.lineTo(-148, -32);
  context.closePath();
  context.fillStyle = paper;
  context.fill();
  context.strokeStyle = "#73695359";
  context.lineWidth = 1.5;
  context.stroke();
  context.fillStyle = "#597c7780";
  context.beginPath();
  context.moveTo(-151, -131);
  context.lineTo(32, -117);
  context.lineTo(35, -98);
  context.lineTo(-151, -110);
  context.closePath();
  context.fill();
  context.fillStyle = "#f0e7ce";
  context.beginPath();
  context.moveTo(-148, -32);
  context.lineTo(-64, -45);
  context.lineTo(-21, -21);
  context.lineTo(-62, -18);
  context.closePath();
  context.fill();
  context.strokeStyle = "#7f72583d";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(-124, -146);
  context.lineTo(-109, -51);
  context.moveTo(7, -134);
  context.lineTo(23, -49);
  context.moveTo(-105, -78);
  context.lineTo(-40, -73);
  context.stroke();
}

function drawNapkin(context) {
  const paper = context.createLinearGradient(-169, -197, 78, -49);
  paper.addColorStop(0, "#f7f1e4");
  paper.addColorStop(0.55, "#e5decc");
  paper.addColorStop(1, "#faf5e8");
  context.beginPath();
  context.moveTo(-173, -182);
  context.lineTo(-63, -208);
  context.lineTo(-25, -191);
  context.lineTo(68, -186);
  context.lineTo(87, -74);
  context.lineTo(48, -48);
  context.lineTo(-30, -65);
  context.lineTo(-159, -43);
  context.lineTo(-148, -112);
  context.closePath();
  context.fillStyle = paper;
  context.fill();
  context.strokeStyle = "#91887455";
  context.lineWidth = 1.6;
  context.stroke();
  context.fillStyle = "#ada18a24";
  context.beginPath();
  context.moveTo(-159, -43);
  context.lineTo(-55, -116);
  context.lineTo(68, -186);
  context.lineTo(-30, -65);
  context.closePath();
  context.fill();
  context.strokeStyle = "#fffdf1b3";
  context.beginPath();
  context.moveTo(-169, -179);
  context.lineTo(-55, -116);
  context.lineTo(83, -74);
  context.stroke();
  context.strokeStyle = "#9b8e7440";
  context.beginPath();
  context.moveTo(-151, -55);
  context.lineTo(-55, -116);
  context.lineTo(-64, -197);
  context.stroke();
  context.fillStyle = "#b5a0711c";
  context.beginPath();
  context.ellipse(-111, -99, 27, 16, -0.6, 0, Math.PI * 2);
  context.fill();
}

function drawCleanupMarks(context) {
  // Dull, broken wipe strokes have none of a live spill's glossy edge.
  context.strokeStyle = "#9d977525";
  context.lineWidth = 4;
  for (let i = 0; i < 5; i++) {
    context.beginPath();
    context.moveTo(-218 + i * 7, -99 + i * 13);
    context.bezierCurveTo(
      -105,
      -160 + i * 12,
      5,
      -115 + i * 12,
      81 - i * 9,
      -111 + i * 18,
    );
    context.stroke();
  }
}

function drawDrinkRing(context) {
  context.strokeStyle = "#a4896338";
  context.lineWidth = 3;
  context.beginPath();
  context.ellipse(-56, -133, 86, 74, 0.16, 0.23, Math.PI * 1.82);
  context.stroke();
  context.strokeStyle = "#9b7e5421";
  context.lineWidth = 6;
  context.beginPath();
  context.ellipse(-56, -133, 89, 76, 0.16, 1.15, 2.7);
  context.stroke();
  context.fillStyle = "#8d724421";
  context.beginPath();
  context.ellipse(64, -84, 8, 5, -0.4, 0, Math.PI * 2);
  context.ellipse(90, -62, 4, 3, 0, 0, Math.PI * 2);
  context.fill();
}

export function drawKitchenFloorDetails(context, world, mapConfig) {
  const clusters = mapConfig?.clusters ?? [];
  context.save();
  context.transform(world.width / 4400, 0, 0, world.height / 4400, 0, 0);
  for (let index = 0; index < clusters.length; index++) {
    const cluster = clusters[index];
    const cos = Math.cos(cluster.angle);
    const sin = Math.sin(cluster.angle);
    context.save();
    context.transform(cos, sin, -sin, cos, cluster.x * 4400, cluster.y * 4400);
    if (cluster.kind === "cerealPacket") drawPacket(context);
    if (cluster.kind === "breakfastNapkin") drawNapkin(context);
    if (cluster.kind === "cleanupScraps") drawCleanupMarks(context);
    if (cluster.kind === "drinkSpill") drawDrinkRing(context);

    // Individual rice and toast flakes bridge the size gap to the live food.
    // Keep them confined to spills, with a sparse tail toward open floor.
    for (let i = 0; i < riceGrains.length; i++) {
      const [x, y, angle] = riceGrains[i];
      const offset = index % 2 ? 33 : -18;
      context.fillStyle = "#8e805b36";
      context.beginPath();
      context.ellipse(x + offset + 1, y + 2, 7, 2.7, angle, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = "#f6edcf";
      context.beginPath();
      context.ellipse(x + offset, y, 6.5, 2.2, angle, 0, Math.PI * 2);
      context.fill();
    }
    context.fillStyle = "#9c703760";
    context.beginPath();
    for (let i = 0; i < 18; i++) {
      // Fixed clusters, no random calls or per-frame regeneration.
      const x = -100 + ((i * 67 + index * 31) % 253);
      const y = 10 + ((i * 41 + index * 13) % 137);
      context.moveTo(x, y);
      context.lineTo(x + 3 + (i % 3), y - 1);
      context.lineTo(x + 2, y + 3);
      context.closePath();
    }
    context.fill();
    context.restore();
  }

  // Tiny matte deposits outside the wet bodies, unlike the real glossy drops.
  for (const patch of mapConfig?.elements ?? []) {
    if (
      (patch.type !== "waterPatch" && patch.type !== "gooPatch") ||
      patch.w < 250
    )
      continue;
    context.strokeStyle =
      patch.type === "waterPatch" ? "#a4a18d30" : "#85844e35";
    context.lineWidth = 1.5;
    context.beginPath();
    for (let i = 0; i < 5; i++) {
      const x = ((patch.x + patch.w * (0.24 + i * 0.12)) * 4400) / world.width;
      const y =
        ((patch.y + patch.h * (i % 2 ? 1.05 : 1.11)) * 4400) / world.height;
      const radius = 3 + (i % 3) * 2;
      context.moveTo(x + radius, y);
      context.ellipse(x, y, radius, radius * 0.6, i * 0.8, 0, Math.PI * 1.7);
    }
    context.stroke();
  }
  context.restore();
}
