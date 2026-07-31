export function createMarbleView({
  marbleEl,
  marble,
  world,
  mapConfig,
  visualConfig,
  clamp,
}) {
  const light = mapConfig.light;
  const worldDiagonal = Math.hypot(world.width, world.height);
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
    syncRadius,
  };
}
