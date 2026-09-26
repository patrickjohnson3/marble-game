import { mouseConfig } from "./game-config.js";
import { clamp } from "./geometry.js";

export function createMouse(map) {
  if (!map.mouse) return null;
  const region = map.regions?.find(
    (candidate) => candidate.id === map.mouse.roamRegion,
  );
  if (!region) {
    throw new Error(`Mouse roam region "${map.mouse.roamRegion}" not found.`);
  }
  if (
    ![region.x, region.y, region.w, region.h].every(Number.isFinite) ||
    region.w <= mouseConfig.radius * 2 ||
    region.h <= mouseConfig.radius * 2
  ) {
    throw new Error(
      "Mouse roam region must provide space beyond its body radius.",
    );
  }
  return {
    x: map.mouse.x,
    y: map.mouse.y,
    previousX: map.mouse.x,
    previousY: map.mouse.y,
    r: mouseConfig.radius,
    vx: 0,
    vy: 0,
    angle: -Math.PI / 2,
    previousAngle: -Math.PI / 2,
    targetAngle: -Math.PI / 2,
    health: mouseConfig.maxHealth,
    maxHealth: mouseConfig.maxHealth,
    hitFlash: 0,
    gait: 0,
    contactLatched: false,
    turnIn: 0,
    pauseFrames: 0,
    scurryFrames: 0,
    fleeFrames: 0,
    turnIndex: 0,
    roamRegion: { x: region.x, y: region.y, w: region.w, h: region.h },
  };
}

export function mouseImpactDamage(normalSpeed) {
  return (
    mouseConfig.maxDamage *
    clamp(
      (normalSpeed - mouseConfig.minDamageSpeed) /
        (mouseConfig.fullDamageSpeed - mouseConfig.minDamageSpeed),
      0,
      1,
    )
  );
}

// Pick runs inside the clear encounter area. The margin is a behavioral cue,
// not another collider: a knocked mouse still has the full region available.
function planMouseRun(mouse, angle, duration, speed) {
  const region = mouse.roamRegion;
  const margin = Math.min(
    mouseConfig.roamMargin,
    (region.w - mouse.r * 2) * 0.2,
    (region.h - mouse.r * 2) * 0.2,
  );
  const left = region.x + mouse.r + margin;
  const right = region.x + region.w - mouse.r - margin;
  const top = region.y + mouse.r + margin;
  const bottom = region.y + region.h - mouse.r - margin;
  const desiredAngle = angle;
  // Reserve the remaining decaying kick toward each edge. Otherwise a good
  // hit carries an escape beyond its planned pivot into the safety reflection.
  const kickX = mouse.vx / -Math.log(mouseConfig.knockbackRetention);
  const kickY = mouse.vy / -Math.log(mouseConfig.knockbackRetention);
  let space = 0;
  for (let attempt = 0; attempt < 4; attempt++) {
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    space = Math.min(
      dx > 0
        ? (right - mouse.x - Math.max(0, kickX)) / dx
        : dx < 0
          ? (left - mouse.x - Math.min(0, kickX)) / dx
          : Infinity,
      dy > 0
        ? (bottom - mouse.y - Math.max(0, kickY)) / dy
        : dy < 0
          ? (top - mouse.y - Math.min(0, kickY)) / dy
          : Infinity,
    );
    if (space >= speed * duration * 0.5 || attempt === 3) break;
    // Try a side-step before turning inward, so an escape near an edge does
    // not automatically send the mouse straight back toward the marble.
    angle =
      attempt === 0
        ? desiredAngle + Math.PI / 2
        : attempt === 1
          ? desiredAngle - Math.PI / 2
          : Math.atan2(
              region.y + region.h / 2 - mouse.y,
              region.x + region.w / 2 - mouse.x,
            );
  }
  mouse.targetAngle =
    mouse.angle +
    Math.atan2(Math.sin(angle - mouse.angle), Math.cos(angle - mouse.angle));
  return Math.min(duration, Math.max(0, space) / speed);
}

function startMouseScurry(mouse, angle, duration, speed) {
  mouse.scurryFrames = planMouseRun(mouse, angle, duration, speed);
  mouse.turnIn = 0;
  // Orient before darting while a hit's existing knockback carries the body.
  mouse.pauseFrames = Math.max(
    mouseConfig.startlePause,
    Math.abs(mouse.targetAngle - mouse.angle) / mouseConfig.scurryTurnRate,
  );
}

export function updateMouse(mouse, marble, dt) {
  if (!mouse || mouse.health <= 0 || !Number.isFinite(dt) || dt <= 0) return;
  mouse.previousX = mouse.x;
  mouse.previousY = mouse.y;
  mouse.previousAngle = mouse.angle;
  mouse.hitFlash = Math.max(0, mouse.hitFlash - mouseConfig.hitFlashDecay * dt);
  const fromMarbleX = mouse.x - marble.x;
  const fromMarbleY = mouse.y - marble.y;
  const threatDistance = Math.hypot(fromMarbleX, fromMarbleY);
  if (
    mouse.fleeFrames === 0 &&
    mouse.scurryFrames === 0 &&
    threatDistance > 0 &&
    threatDistance < mouseConfig.threatDistance &&
    marble.vx * fromMarbleX + marble.vy * fromMarbleY > 0
  ) {
    startMouseScurry(
      mouse,
      Math.atan2(fromMarbleY, fromMarbleX),
      mouseConfig.turnInterval,
      mouseConfig.scurrySpeed,
    );
  }

  // Split at behavior transitions, retaining the same walking/paused time for
  // different physics partitions. Turns happen during the pause, not as snaps
  // halfway through a run. Decision variation is deterministic and has no
  // per-frame randomness or synchronized two-angle patrol pattern.
  let remaining = dt;
  while (remaining > 0) {
    const fleeing = mouse.fleeFrames > 0;
    if (fleeing && mouse.scurryFrames === 0) {
      // A short run may end at an edge before the flight timer does. Choose
      // another clear escape without shortening or extending the reaction.
      startMouseScurry(
        mouse,
        Math.atan2(mouse.y - marble.y, mouse.x - marble.x),
        Math.min(mouseConfig.turnInterval, mouse.fleeFrames),
        mouseConfig.fleeSpeed,
      );
    }
    const scurrying = mouse.scurryFrames > 0;
    if (!scurrying && mouse.pauseFrames === 0 && mouse.turnIn <= 0) {
      mouse.turnIndex += 1;
      const variation = Math.sin(mouse.turnIndex * 2.4);
      mouse.turnIn = planMouseRun(
        mouse,
        mouse.angle + mouseConfig.turnAngle * variation,
        mouseConfig.turnInterval *
          (1 +
            mouseConfig.runDurationVariation * Math.sin(mouse.turnIndex * 1.7)),
        mouseConfig.walkSpeed,
      );
      mouse.pauseFrames = Math.max(
        mouseConfig.pauseDuration *
          (1 + mouseConfig.pauseDurationVariation * variation),
        Math.abs(mouse.targetAngle - mouse.angle) / mouseConfig.turnRate,
      );
    }
    const paused = mouse.pauseFrames > 0;
    const step = Math.min(
      remaining,
      fleeing ? mouse.fleeFrames : Infinity,
      paused
        ? mouse.pauseFrames
        : scurrying
          ? mouse.scurryFrames
          : mouse.turnIn,
    );
    if (paused) {
      const turn =
        (scurrying ? mouseConfig.scurryTurnRate : mouseConfig.turnRate) * step;
      mouse.angle += clamp(mouse.targetAngle - mouse.angle, -turn, turn);
    }
    const speed = paused
      ? 0
      : fleeing
        ? mouseConfig.fleeSpeed
        : scurrying
          ? mouseConfig.scurrySpeed
          : mouseConfig.walkSpeed;
    const retention = Math.pow(mouseConfig.knockbackRetention, step);
    const knockbackDistance =
      mouseConfig.knockbackRetention === 1
        ? step
        : (1 - retention) / -Math.log(mouseConfig.knockbackRetention);
    const dx =
      Math.cos(mouse.angle) * speed * step + mouse.vx * knockbackDistance;
    const dy =
      Math.sin(mouse.angle) * speed * step + mouse.vy * knockbackDistance;
    mouse.vx *= retention;
    mouse.vy *= retention;
    const region = mouse.roamRegion;
    const left = region.x + mouse.r;
    const right = region.x + region.w - mouse.r;
    const top = region.y + mouse.r;
    const bottom = region.y + region.h - mouse.r;
    let nextX = mouse.x + dx;
    let nextY = mouse.y + dy;
    // Planned runs stop before these bounds. Preserve reflected overshoot for
    // knockback so an impulse cannot strand the mouse outside reachable space.
    while (nextX < left || nextX > right) {
      nextX = nextX < left ? 2 * left - nextX : 2 * right - nextX;
      mouse.angle = Math.PI - mouse.angle;
      mouse.targetAngle = Math.PI - mouse.targetAngle;
      mouse.vx = -mouse.vx;
    }
    while (nextY < top || nextY > bottom) {
      nextY = nextY < top ? 2 * top - nextY : 2 * bottom - nextY;
      mouse.angle = -mouse.angle;
      mouse.targetAngle = -mouse.targetAngle;
      mouse.vy = -mouse.vy;
    }
    mouse.gait += Math.hypot(dx, dy);
    mouse.x = nextX;
    mouse.y = nextY;
    if (paused) mouse.pauseFrames -= step;
    else if (scurrying) mouse.scurryFrames -= step;
    else mouse.turnIn -= step;
    if (fleeing) {
      mouse.fleeFrames = Math.max(0, mouse.fleeFrames - step);
      if (mouse.fleeFrames === 0) {
        // Discard the remaining escape run/pivot before normal roaming resumes.
        mouse.scurryFrames = 0;
        mouse.pauseFrames = 0;
        mouse.turnIn = 0;
      }
    }
    remaining -= step;
  }
}

export function resolveMouseContact(
  mouse,
  marble,
  previous,
  onImpact = () => {},
) {
  if (!mouse || mouse.health <= 0) return 0;
  const cos = Math.cos(mouse.angle);
  const sin = Math.sin(mouse.angle);
  const previousCos = Math.cos(mouse.previousAngle);
  const previousSin = Math.sin(mouse.previousAngle);
  let separated = true;
  let hitTime = Infinity;
  let penetration = -Infinity;
  let normalX = 0;
  let normalY = 0;
  let contactX = 0;
  let contactY = 0;
  let contactRadius = 0;
  for (const part of mouseConfig.bodyParts) {
    const offset = part.x * mouse.r;
    const radius = part.r * mouse.r + marble.r;
    const startX = previous.x - mouse.previousX - previousCos * offset;
    const startY = previous.y - mouse.previousY - previousSin * offset;
    const centerX = mouse.x + cos * offset;
    const centerY = mouse.y + sin * offset;
    const endX = marble.x - centerX;
    const endY = marble.y - centerY;
    const startDistance = Math.hypot(startX, startY);
    if (startDistance <= radius + mouseConfig.separationMargin) {
      separated = false;
    }
    let time = 0;
    let nx = endX;
    let ny = endY;
    const depth = radius - Math.hypot(endX, endY);
    if (startDistance > radius) {
      // Sweep each part from the previous heading as well as position. Select
      // the earliest entry across the body, never the first part in the list.
      const dx = endX - startX;
      const dy = endY - startY;
      const a = dx * dx + dy * dy;
      const b = startX * dx + startY * dy;
      const c = startX * startX + startY * startY - radius * radius;
      const discriminant = b * b - a * c;
      if (a === 0 || b >= 0 || discriminant < 0) continue;
      time = (-b - Math.sqrt(discriminant)) / a;
      if (time < 0 || time > 1) continue;
      nx = startX + dx * time;
      ny = startY + dy * time;
    } else if (depth < 0) {
      // Existing contact is separating; do not pull it back to the mouse.
      continue;
    }
    if (time > hitTime || (time === hitTime && depth <= penetration)) continue;
    hitTime = time;
    penetration = depth;
    normalX = nx;
    normalY = ny;
    contactX = centerX;
    contactY = centerY;
    contactRadius = radius;
  }
  // One body owns the contact latch, including where adjacent parts overlap.
  if (separated) mouse.contactLatched = false;
  if (hitTime === Infinity) return 0;

  const normalLength = Math.hypot(normalX, normalY);
  if (normalLength > 0) {
    normalX /= normalLength;
    normalY /= normalLength;
  } else {
    const speed = Math.hypot(marble.vx, marble.vy);
    normalX = speed > 0 ? -marble.vx / speed : 1;
    normalY = speed > 0 ? -marble.vy / speed : 0;
  }
  marble.x = contactX + normalX * contactRadius;
  marble.y = contactY + normalY * contactRadius;
  // At a seam, correcting one circle can leave penetration in its neighbor.
  // Continue along the same outward normal beyond any overlapping part. Each
  // correction passes that circle's far intersection, so it cannot recur.
  for (let pass = 0; pass < mouseConfig.bodyParts.length; pass++) {
    let corrected = false;
    for (const part of mouseConfig.bodyParts) {
      const offset = part.x * mouse.r;
      const dx = marble.x - mouse.x - cos * offset;
      const dy = marble.y - mouse.y - sin * offset;
      const radius = part.r * mouse.r + marble.r;
      const c = dx * dx + dy * dy - radius * radius;
      if (c >= -1e-8) continue;
      const b = dx * normalX + dy * normalY;
      const distance = -b + Math.sqrt(b * b - c);
      marble.x += normalX * distance;
      marble.y += normalY * distance;
      corrected = true;
    }
    if (!corrected) break;
  }
  const incomingSpeed = -(marble.vx * normalX + marble.vy * normalY);
  const freshContact = !mouse.contactLatched;
  const damage = freshContact ? mouseImpactDamage(incomingSpeed) : 0;
  mouse.contactLatched = true;
  if (damage > 0) {
    mouse.health = Math.max(0, mouse.health - damage);
    mouse.hitFlash = damage / mouseConfig.maxDamage;
    const hitSpeed = Math.min(incomingSpeed, mouseConfig.fullDamageSpeed);
    onImpact(hitSpeed);
    if (mouse.health > 0) {
      mouse.vx = -normalX * hitSpeed * mouseConfig.knockbackScale;
      mouse.vy = -normalY * hitSpeed * mouseConfig.knockbackScale;
    } else {
      mouse.vx = 0;
      mouse.vy = 0;
      mouse.fleeFrames = 0;
      mouse.scurryFrames = 0;
      mouse.pauseFrames = 0;
    }
  }
  if (freshContact && incomingSpeed > 0 && mouse.health > 0) {
    mouse.fleeFrames = mouseConfig.fleeDuration;
    startMouseScurry(
      mouse,
      Math.atan2(-normalY, -normalX),
      Math.min(mouseConfig.turnInterval, mouse.fleeFrames),
      mouseConfig.fleeSpeed,
    );
  }
  if (incomingSpeed > 0) {
    marble.vx += (1 + mouseConfig.bounce) * incomingSpeed * normalX;
    marble.vy += (1 + mouseConfig.bounce) * incomingSpeed * normalY;
  }
  return damage;
}
