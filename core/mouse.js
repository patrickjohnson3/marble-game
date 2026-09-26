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
    targetAngle: -Math.PI / 2,
    health: mouseConfig.maxHealth,
    maxHealth: mouseConfig.maxHealth,
    hitFlash: 0,
    gait: 0,
    contactLatched: false,
    turnIn: 0,
    pauseFrames: 0,
    scurryFrames: 0,
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
  let space = 0;
  for (let attempt = 0; attempt < 4; attempt++) {
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    space = Math.min(
      dx > 0
        ? (right - mouse.x) / dx
        : dx < 0
          ? (left - mouse.x) / dx
          : Infinity,
      dy > 0
        ? (bottom - mouse.y) / dy
        : dy < 0
          ? (top - mouse.y) / dy
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

export function updateMouse(mouse, marble, dt) {
  if (!mouse || mouse.health <= 0 || !Number.isFinite(dt) || dt <= 0) return;
  mouse.previousX = mouse.x;
  mouse.previousY = mouse.y;
  mouse.hitFlash = Math.max(0, mouse.hitFlash - mouseConfig.hitFlashDecay * dt);
  const fromMarbleX = mouse.x - marble.x;
  const fromMarbleY = mouse.y - marble.y;
  const threatDistance = Math.hypot(fromMarbleX, fromMarbleY);
  if (
    mouse.scurryFrames === 0 &&
    threatDistance > 0 &&
    threatDistance < mouseConfig.threatDistance &&
    marble.vx * fromMarbleX + marble.vy * fromMarbleY > 0
  ) {
    mouse.scurryFrames = planMouseRun(
      mouse,
      Math.atan2(fromMarbleY, fromMarbleX),
      mouseConfig.turnInterval,
      mouseConfig.scurrySpeed,
    );
    mouse.turnIn = 0;
    // Briefly orient before darting. A fast marble can catch this reaction;
    // the mouse never teleports its heading through a half turn.
    mouse.pauseFrames = Math.max(
      mouseConfig.startlePause,
      Math.abs(mouse.targetAngle - mouse.angle) / mouseConfig.scurryTurnRate,
    );
  }

  // Split at behavior transitions, retaining the same walking/paused time for
  // different physics partitions. Turns happen during the pause, not as snaps
  // halfway through a run. Decision variation is deterministic and has no
  // per-frame randomness or synchronized two-angle patrol pattern.
  let remaining = dt;
  while (remaining > 0) {
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
  const radius = mouse.r + marble.r;
  const startX = previous.x - mouse.previousX;
  const startY = previous.y - mouse.previousY;
  const endX = marble.x - mouse.x;
  const endY = marble.y - mouse.y;
  const startDistance = Math.hypot(startX, startY);
  if (startDistance > radius + mouseConfig.separationMargin) {
    mouse.contactLatched = false;
  }

  let normalX = startX;
  let normalY = startY;
  if (startDistance > radius) {
    // First contact of the relative sweep, including the mouse's own scurry.
    // A closest-point normal would lose the direct component of a fast hit.
    const dx = endX - startX;
    const dy = endY - startY;
    const a = dx * dx + dy * dy;
    const b = startX * dx + startY * dy;
    const c = startX * startX + startY * startY - radius * radius;
    const discriminant = b * b - a * c;
    if (a === 0 || b >= 0 || discriminant < 0) return 0;
    const hitTime = (-b - Math.sqrt(discriminant)) / a;
    if (hitTime < 0 || hitTime > 1) return 0;
    normalX += dx * hitTime;
    normalY += dy * hitTime;
  } else if (Math.hypot(endX, endY) > radius) {
    // Existing contact is separating; do not pull it back to the mouse.
    return 0;
  } else {
    normalX = endX;
    normalY = endY;
  }

  const normalLength = Math.hypot(normalX, normalY);
  if (normalLength > 0) {
    normalX /= normalLength;
    normalY /= normalLength;
  } else {
    const speed = Math.hypot(marble.vx, marble.vy);
    normalX = speed > 0 ? -marble.vx / speed : 1;
    normalY = speed > 0 ? -marble.vy / speed : 0;
  }
  // Correction is less than the rearm margin, so it cannot create a fresh hit.
  marble.x = mouse.x + normalX * radius;
  marble.y = mouse.y + normalY * radius;
  const incomingSpeed = -(marble.vx * normalX + marble.vy * normalY);
  const damage = mouse.contactLatched ? 0 : mouseImpactDamage(incomingSpeed);
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
    }
  }
  if (incomingSpeed > 0) {
    marble.vx += (1 + mouseConfig.bounce) * incomingSpeed * normalX;
    marble.vy += (1 + mouseConfig.bounce) * incomingSpeed * normalY;
  }
  return damage;
}
