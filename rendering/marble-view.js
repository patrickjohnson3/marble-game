import { clamp } from "../core/geometry.js";
import { KITCHEN_CUP_SPRITE } from "../core/map-elements.js";

function prepareCupReveal(cup) {
  const sprite = KITCHEN_CUP_SPRITE;
  const scale = Math.min(
    Math.max(cup.hitboxW ?? cup.w, sprite.minWidth) / sprite.width,
    Math.max(cup.hitboxH ?? cup.h, sprite.minHeight) / sprite.height,
  );
  return {
    centerX: cup.x + cup.w / 2,
    centerY: cup.y + cup.h / 2,
    cos: Math.cos(cup.angle ?? 0),
    sin: Math.sin(cup.angle ?? 0),
    left: (sprite.interior.left - sprite.width / 2) * scale,
    right: (sprite.interior.right - sprite.width / 2) * scale,
    top: (sprite.interior.top - sprite.height / 2) * scale,
    bottom: (sprite.interior.bottom - sprite.height / 2) * scale,
  };
}

export function createMarbleView({
  marbleEl,
  marble,
  world,
  mapConfig,
  mapState,
  visualConfig,
}) {
  const light = mapConfig.light;
  let worldDiagonal = Math.hypot(world.width, world.height);
  // Disposable geometry cache for static cup artwork. Map activation/Retry
  // replaces activeMap; the reveal itself is always derived from live position.
  let cupMap = null;
  let cupReveals = [];
  const contactShadowY = light.contactShadowY.toFixed(1) + "px";
  const contactShadowBlur = light.contactShadowBlur.toFixed(1) + "px";
  const lastStyle = {
    glintX: "",
    glintY: "",
    ready: null,
    roll: "",
    shadowBlur: "",
    shadowX: "",
    shadowY: "",
    transform: "",
    insideCup: null,
  };

  marbleEl.style.setProperty("--marble-contact-shadow-y", contactShadowY);
  marbleEl.style.setProperty("--marble-contact-shadow-blur", contactShadowBlur);

  function setStyleProperty(cacheKey, property, value) {
    if (lastStyle[cacheKey] === value) return;

    lastStyle[cacheKey] = value;
    marbleEl.style.setProperty(property, value);
  }

  function syncRadius() {
    marble.r = Math.max(marbleEl.offsetWidth, marbleEl.offsetHeight) / 2;
  }

  function setWorld(nextWorld) {
    worldDiagonal = Math.hypot(nextWorld.width, nextWorld.height);
  }

  function marbleHasValidLayout() {
    return (
      marble.r > 0 && Number.isFinite(marble.x) && Number.isFinite(marble.y)
    );
  }

  function updateLighting() {
    const dx = marble.x - light.x;
    const dy = marble.y - light.y;
    const distance = Math.hypot(dx, dy) || 1;
    const reach = clamp(distance / worldDiagonal, 0, 1);
    const shadowDistance =
      light.shadowMinDistance +
      (light.shadowMaxDistance - light.shadowMinDistance) * reach;
    const shadowBlur =
      light.shadowMinBlur + (light.shadowMaxBlur - light.shadowMinBlur) * reach;

    setStyleProperty(
      "shadowX",
      "--marble-shadow-x",
      ((dx / distance) * shadowDistance).toFixed(1) + "px",
    );
    setStyleProperty(
      "shadowY",
      "--marble-shadow-y",
      ((dy / distance) * shadowDistance).toFixed(1) + "px",
    );
    setStyleProperty(
      "shadowBlur",
      "--marble-shadow-blur",
      shadowBlur.toFixed(1) + "px",
    );
    const marbleVisual = visualConfig.marble;
    const glintX =
      marbleVisual.glintCenter +
      (-dx / distance) * marbleVisual.glintLightOffset +
      clamp(
        marble.vx * marbleVisual.glintVelocityScale,
        -marbleVisual.glintVelocityLimit,
        marbleVisual.glintVelocityLimit,
      );
    const glintY =
      marbleVisual.glintCenter +
      (-dy / distance) * marbleVisual.glintLightOffset +
      clamp(
        marble.vy * marbleVisual.glintVelocityScale,
        -marbleVisual.glintVelocityLimit,
        marbleVisual.glintVelocityLimit,
      );
    setStyleProperty("glintX", "--marble-glint-x", glintX.toFixed(1) + "px");
    setStyleProperty("glintY", "--marble-glint-y", glintY.toFixed(1) + "px");
    setStyleProperty("roll", "--marble-roll", marble.roll.toFixed(3) + "rad");
  }

  function render() {
    const activeMap = mapState?.activeMap;
    if (cupMap !== activeMap) {
      cupMap = activeMap;
      cupReveals = (activeMap?.elements ?? [])
        .filter((element) => element.fixture === "tippedCup")
        .map(prepareCupReveal);
    }
    let insideCup = false;
    for (const cup of cupReveals) {
      const dx = marble.x - cup.centerX;
      const dy = marble.y - cup.centerY;
      const x = cup.cos * dx + cup.sin * dy;
      const y = -cup.sin * dx + cup.cos * dy;
      if (x >= cup.left && x <= cup.right && y >= cup.top && y <= cup.bottom) {
        insideCup = true;
        break;
      }
    }
    if (lastStyle.insideCup !== insideCup) {
      lastStyle.insideCup = insideCup;
      marbleEl.classList.toggle("insideCup", insideCup);
    }
    const scaleX = (
      1 +
      marble.impactSquash * visualConfig.marble.impactScaleX
    ).toFixed(3);
    const scaleY = (
      1 -
      marble.impactSquash * visualConfig.marble.impactScaleY
    ).toFixed(3);
    const transform =
      "translate(" +
      marble.x +
      "px, " +
      marble.y +
      "px) translate(-50%, -50%) scale(" +
      scaleX +
      ", " +
      scaleY +
      ")";
    if (lastStyle.transform !== transform) {
      lastStyle.transform = transform;
      marbleEl.style.transform = transform;
    }
    updateLighting();
    const ready = marbleHasValidLayout();
    if (lastStyle.ready !== ready) {
      lastStyle.ready = ready;
      marbleEl.classList.toggle("ready", ready);
    }
  }

  return {
    render,
    setWorld,
    syncRadius,
  };
}
