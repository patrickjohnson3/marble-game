import { cockroachConfig } from "./game-config.js";
import { pointInEllipsePatch } from "./geometry.js";
import { ELLIPTICAL_SURFACE_SHAPES } from "./map-elements.js";
import {
  circleObstacleContact,
  resolveObstacleCollision,
} from "./physics-collisions.js";

const probe = { x: 0, y: 0, r: 0 };
const contact = {};
const tickFrames = 0.5;
const targetMarble = { x: 0, y: 0, vx: 0, vy: 0 };
const recoveryPhysics = { bounce: 0 };
const noImpact = () => {};

export function createCockroach(map) {
  if (!map.cockroach || map.theme !== "kitchenFloor") return null;
  if (![map.cockroach.x, map.cockroach.y].every(Number.isFinite)) {
    throw new Error("Cockroach spawn must have finite coordinates.");
  }
  return {
    x: map.cockroach.x,
    y: map.cockroach.y,
    previousX: map.cockroach.x,
    previousY: map.cockroach.y,
    r: cockroachConfig.radius,
    vx: 0,
    vy: 0,
    angle: -Math.PI / 2,
    gait: 0,
    mode: "scurry",
    modeFrames: 0,
    harassmentIn: cockroachConfig.harassmentInterval,
    decisionIn: 0,
    decisionIndex: 0,
    pendingFrames: 0,
    knockbackX: 0,
    knockbackY: 0,
    contactLatched: false,
    engaged: false,
    attackRecoveryFrames: 0,
  };
}

function clearAt(x, y, radius, mapState) {
  const world = mapState.activeMap.world;
  if (
    x < radius ||
    y < radius ||
    x > world.width - radius ||
    y > world.height - radius
  ) {
    return false;
  }
  probe.x = x;
  probe.y = y;
  probe.r = radius;
  for (const obstacle of mapState.obstacles) {
    if (circleObstacleContact(probe, obstacle, 0, contact).intersects) {
      return false;
    }
  }
  return true;
}

function clearContactLine(x1, y1, x2, y2, mapState) {
  const distance = Math.hypot(x2 - x1, y2 - y1);
  // Overlapping probes also catch thin utensil parts between the two bodies.
  const samples = Math.max(1, Math.ceil(distance / 3));
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    if (!clearAt(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, 1.5, mapState)) {
      return false;
    }
  }
  return true;
}

function retreat(cockroach, marble, frames) {
  cockroach.mode = "retreat";
  cockroach.modeFrames = frames;
  cockroach.angle = Math.atan2(cockroach.y - marble.y, cockroach.x - marble.x);
  cockroach.decisionIn = cockroachConfig.decisionInterval;
}

function forage(cockroach, mapState, kitchenState) {
  let closest = Infinity;
  let targetX = cockroach.x;
  let targetY = cockroach.y;
  const radius = cockroachConfig.forageRadius;
  // Read the existing mutable food positions. Pushed/eaten cereal must not
  // leave a second set of stale attraction points on the floor.
  for (const cereal of kitchenState?.cheerios ?? []) {
    if (!cereal.active || cereal.kind !== "cheerio") continue;
    const x = cereal.originX + cereal.pushX;
    const y = cereal.originY + cereal.pushY;
    const distance = Math.hypot(x - cockroach.x, y - cockroach.y);
    if (distance >= closest || !clearAt(x, y, cockroach.r, mapState)) continue;
    closest = distance;
    targetX = x;
    targetY = y;
    if (distance < radius * 2) {
      // Walk around the food rather than repeatedly overshooting its center.
      const angle = Math.atan2(cockroach.y - y, cockroach.x - x) + 0.8;
      targetX += Math.cos(angle) * radius;
      targetY += Math.sin(angle) * radius;
    }
  }
  const shape = ELLIPTICAL_SURFACE_SHAPES.gooPatch;
  for (const patch of mapState.terrainByType?.gooPatch?.elements ?? []) {
    const x = patch.x + patch.w * shape.centerX;
    const y = patch.y + patch.h * shape.centerY;
    const dx = cockroach.x - x;
    const dy = cockroach.y - y;
    const rx =
      patch.w * shape.radiusX + cockroach.r + cockroachConfig.gooEdgeMargin;
    const ry =
      patch.h * shape.radiusY + cockroach.r + cockroachConfig.gooEdgeMargin;
    let angle = Math.atan2(
      (-dx * shape.sin + dy * shape.cos) / ry,
      (dx * shape.cos + dy * shape.sin) / rx,
    );
    let localX = Math.cos(angle) * rx;
    let localY = Math.sin(angle) * ry;
    const edgeX = x + localX * shape.cos - localY * shape.sin;
    const edgeY = y + localX * shape.sin + localY * shape.cos;
    const distance = Math.hypot(edgeX - cockroach.x, edgeY - cockroach.y);
    if (distance >= closest || !clearAt(edgeX, edgeY, cockroach.r, mapState))
      continue;
    closest = distance;
    if (distance < radius) angle += 0.35;
    localX = Math.cos(angle) * rx;
    localY = Math.sin(angle) * ry;
    targetX = x + localX * shape.cos - localY * shape.sin;
    targetY = y + localX * shape.sin + localY * shape.cos;
  }
  if (closest === Infinity) return false;
  cockroach.angle = Math.atan2(targetY - cockroach.y, targetX - cockroach.x);
  return true;
}

function chooseDirection(cockroach, marble, mapState, kitchenState) {
  cockroach.decisionIndex++;
  if (cockroach.mode === "harass") {
    // A short lead is readable and still lets a quick turn evade the charge.
    const distance = Math.hypot(marble.x - cockroach.x, marble.y - cockroach.y);
    const lead = Math.min(
      cockroachConfig.interceptFrames,
      distance / cockroachConfig.harassSpeed,
    );
    cockroach.angle = Math.atan2(
      marble.y + marble.vy * lead - cockroach.y,
      marble.x + marble.vx * lead - cockroach.x,
    );
  } else if (cockroach.mode === "retreat") {
    cockroach.angle = Math.atan2(
      cockroach.y - marble.y,
      cockroach.x - marble.x,
    );
  } else if (
    cockroach.mode === "scurry" &&
    !forage(cockroach, mapState, kitchenState)
  ) {
    cockroach.angle += Math.sin(cockroach.decisionIndex * 2.4) * 0.65;
  }
  cockroach.decisionIn =
    cockroach.mode === "harass"
      ? cockroachConfig.attackDecisionInterval
      : cockroachConfig.decisionInterval;
}

function moveCockroach(cockroach, speed, mapState) {
  const goo = mapState.terrainByType?.gooPatch?.elements;
  if (speed > 0 && goo) {
    for (const patch of goo) {
      if (
        pointInEllipsePatch(
          cockroach.x,
          cockroach.y,
          patch,
          ELLIPTICAL_SURFACE_SHAPES.gooPatch,
        )
      ) {
        // Slow its own steps, not the player's counter-hit knockback.
        speed *= cockroachConfig.gooSpeedScale;
        break;
      }
    }
  }
  const retention = Math.pow(cockroachConfig.knockbackRetention, tickFrames);
  let dx = Math.cos(cockroach.angle) * speed * tickFrames;
  let dy = Math.sin(cockroach.angle) * speed * tickFrames;
  dx += cockroach.knockbackX * tickFrames;
  dy += cockroach.knockbackY * tickFrames;
  cockroach.knockbackX *= retention;
  cockroach.knockbackY *= retention;
  let nextX = cockroach.x + dx;
  let nextY = cockroach.y + dy;
  if (!clearAt(nextX, nextY, cockroach.r, mapState)) {
    // Yield to solid scenery, then try both sides before turning around. A
    // rejected move never pushes the marble or projects it through furniture.
    cockroach.knockbackX = 0;
    cockroach.knockbackY = 0;
    const angle = cockroach.angle;
    const side = cockroach.decisionIndex % 2 ? 1 : -1;
    let found = false;
    for (let attempt = 0; attempt < 5; attempt++) {
      const turn =
        attempt === 4 ? Math.PI : ((Math.floor(attempt / 2) + 1) * Math.PI) / 3;
      cockroach.angle = angle + turn * (attempt % 2 ? -side : side);
      dx = Math.cos(cockroach.angle) * speed * tickFrames;
      dy = Math.sin(cockroach.angle) * speed * tickFrames;
      nextX = cockroach.x + dx;
      nextY = cockroach.y + dy;
      if (clearAt(nextX, nextY, cockroach.r, mapState)) {
        found = true;
        break;
      }
    }
    if (!found) {
      cockroach.vx = 0;
      cockroach.vy = 0;
      return;
    }
    cockroach.decisionIn = cockroachConfig.decisionInterval;
  }
  cockroach.vx = dx / tickFrames;
  cockroach.vy = dy / tickFrames;
  cockroach.x = nextX;
  cockroach.y = nextY;
  cockroach.gait += Math.hypot(dx, dy);
}

export function updateCockroach(
  cockroach,
  marble,
  dt,
  mapState,
  previousMarble = marble,
  kitchenState,
) {
  if (!cockroach || mapState.goalCompleted || !Number.isFinite(dt) || dt <= 0)
    return;
  // The movable sponge can overlap a previously clear position. Reuse the
  // established obstacle correction on the insect, never on the marble.
  if (!clearAt(cockroach.x, cockroach.y, cockroach.r, mapState)) {
    for (let pass = 0; pass < 4; pass++) {
      for (const obstacle of mapState.obstacles) {
        resolveObstacleCollision(
          cockroach,
          obstacle,
          recoveryPhysics,
          noImpact,
          contact,
        );
      }
      const world = mapState.activeMap.world;
      cockroach.x = Math.max(
        cockroach.r,
        Math.min(world.width - cockroach.r, cockroach.x),
      );
      cockroach.y = Math.max(
        cockroach.r,
        Math.min(world.height - cockroach.r, cockroach.y),
      );
      if (clearAt(cockroach.x, cockroach.y, cockroach.r, mapState)) break;
    }
  }
  cockroach.previousX = cockroach.x;
  cockroach.previousY = cockroach.y;
  // One small, local 120 Hz tick keeps obstacle choices and behavior clocks
  // independent of the marble's varying physics partitions. No per-tick data
  // is allocated; the maximum normal move is smaller than the body radius.
  let tickTime = tickFrames - cockroach.pendingFrames;
  cockroach.pendingFrames += dt;
  targetMarble.vx = marble.vx;
  targetMarble.vy = marble.vy;
  while (cockroach.pendingFrames >= tickFrames - 1e-10) {
    const t = Math.min(1, tickTime / dt);
    targetMarble.x = previousMarble.x + (marble.x - previousMarble.x) * t;
    targetMarble.y = previousMarble.y + (marble.y - previousMarble.y) * t;
    tickTime += tickFrames;
    cockroach.pendingFrames = Math.max(0, cockroach.pendingFrames - tickFrames);
    cockroach.harassmentIn = Math.max(0, cockroach.harassmentIn - tickFrames);
    cockroach.attackRecoveryFrames = Math.max(
      0,
      cockroach.attackRecoveryFrames - tickFrames,
    );
    // Distant acquisition still has a timeout. Once a hit starts an encounter,
    // only escape distance (or a strong counter-hit) ends the pressure.
    if (
      cockroach.mode === "harass" &&
      (cockroach.engaged
        ? Math.hypot(
            cockroach.x - targetMarble.x,
            cockroach.y - targetMarble.y,
          ) > cockroachConfig.escapeDistance
        : cockroach.modeFrames <= 0)
    ) {
      cockroach.mode = "scurry";
      cockroach.modeFrames = 0;
      cockroach.engaged = false;
      cockroach.attackRecoveryFrames = 0;
      cockroach.decisionIn = 0;
      cockroach.harassmentIn = cockroachConfig.postContactCooldown;
    } else if (
      cockroach.mode !== "scurry" &&
      cockroach.mode !== "harass" &&
      cockroach.modeFrames <= 0
    ) {
      if (cockroach.mode === "stunned") {
        retreat(cockroach, targetMarble, cockroachConfig.retreatDuration);
      } else {
        cockroach.mode = "scurry";
        cockroach.decisionIn = 0;
      }
    }
    // Reacquire after the quiet interval even if foraging took us far away.
    if (
      cockroach.mode === "scurry" &&
      cockroach.harassmentIn === 0 &&
      !cockroach.contactLatched
    ) {
      cockroach.mode = "harass";
      cockroach.engaged = false;
      cockroach.modeFrames = cockroachConfig.harassmentDuration;
      cockroach.decisionIn = 0;
    }
    if (cockroach.decisionIn <= 0)
      chooseDirection(cockroach, targetMarble, mapState, kitchenState);
    // Brace after a strike and yield while bodies still touch. Without this,
    // pursuit would walk through the latched marble instead of making a new hit.
    const recovering =
      cockroach.mode === "harass" &&
      (cockroach.attackRecoveryFrames > 0 || cockroach.contactLatched);
    const speed =
      cockroach.mode === "stunned" || recovering
        ? 0
        : cockroach.mode === "harass"
          ? cockroachConfig.harassSpeed
          : cockroach.mode === "retreat"
            ? cockroachConfig.retreatSpeed
            : cockroachConfig.scurrySpeed;
    moveCockroach(cockroach, speed, mapState);
    cockroach.modeFrames = Math.max(0, cockroach.modeFrames - tickFrames);
    cockroach.decisionIn = Math.max(0, cockroach.decisionIn - tickFrames);
  }
}

export function resolveCockroachContact(
  cockroach,
  marble,
  previousMarble,
  mapState,
  onImpact = () => {},
) {
  if (!cockroach || mapState.goalCompleted) return null;
  const radius = cockroach.r + marble.r;
  const startX = previousMarble.x - cockroach.previousX;
  const startY = previousMarble.y - cockroach.previousY;
  if (Math.hypot(startX, startY) > radius + cockroachConfig.separationMargin) {
    cockroach.contactLatched = false;
  }
  if (cockroach.contactLatched) return null;
  const endX = marble.x - cockroach.x;
  const endY = marble.y - cockroach.y;
  const dx = endX - startX;
  const dy = endY - startY;
  const c = startX * startX + startY * startY - radius * radius;
  let time = 0;
  if (c > 0) {
    const a = dx * dx + dy * dy;
    const b = 2 * (startX * dx + startY * dy);
    const discriminant = b * b - 4 * a * c;
    if (a === 0 || discriminant < 0) return null;
    time = (-b - Math.sqrt(discriminant)) / (2 * a);
    if (time < 0 || time > 1) return null;
  }
  let nx = startX + dx * time;
  let ny = startY + dy * time;
  const length = Math.hypot(nx, ny);
  if (length > 0) {
    nx /= length;
    ny /= length;
  } else {
    nx = Math.cos(cockroach.angle);
    ny = Math.sin(cockroach.angle);
  }
  const roachX =
    cockroach.previousX + (cockroach.x - cockroach.previousX) * time;
  const roachY =
    cockroach.previousY + (cockroach.y - cockroach.previousY) * time;
  if (
    !clearContactLine(
      roachX,
      roachY,
      roachX + nx * radius,
      roachY + ny * radius,
      mapState,
    )
  )
    return null;
  cockroach.contactLatched = true;
  const marbleIncoming = -(marble.vx * nx + marble.vy * ny);
  const relativeIncoming =
    marbleIncoming + cockroach.vx * nx + cockroach.vy * ny;
  if (relativeIncoming <= 0) return null;
  if (marbleIncoming >= cockroachConfig.repelSpeed) {
    cockroach.mode = "stunned";
    cockroach.engaged = false;
    cockroach.attackRecoveryFrames = 0;
    cockroach.modeFrames = cockroachConfig.stunDuration;
    cockroach.harassmentIn = cockroachConfig.postContactCooldown;
    cockroach.knockbackX =
      -nx * Math.min(marbleIncoming, cockroachConfig.maxKnockbackSpeed);
    cockroach.knockbackY =
      -ny * Math.min(marbleIncoming, cockroachConfig.maxKnockbackSpeed);
    cockroach.angle = Math.atan2(-ny, -nx);
    onImpact(Math.min(marbleIncoming, cockroachConfig.maxKnockbackSpeed));
    return "repel";
  }
  if (cockroach.mode !== "harass" || cockroach.attackRecoveryFrames > 0)
    return null;
  // Cancel a sub-repel incoming component before applying the outward kick.
  // A medium-speed bump must visibly rebound rather than continue into the bug.
  const impulse = cockroachConfig.contactImpulse + Math.max(0, marbleIncoming);
  marble.vx += nx * impulse;
  marble.vy += ny * impulse;
  const speed = Math.hypot(marble.vx, marble.vy);
  if (speed > cockroachConfig.maxDisruptedSpeed) {
    marble.vx *= cockroachConfig.maxDisruptedSpeed / speed;
    marble.vy *= cockroachConfig.maxDisruptedSpeed / speed;
  }
  cockroach.engaged = true;
  cockroach.attackRecoveryFrames = cockroachConfig.attackRecoveryDuration;
  onImpact(cockroachConfig.contactImpulse);
  return "attack";
}
