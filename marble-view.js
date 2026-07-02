export function createMarbleView({ marbleEl, marble, world, mapConfig, visualConfig, clamp }) {
  function syncRadius() {
    marble.r = Math.max(marbleEl.offsetWidth, marbleEl.offsetHeight) / 2;
  }

  function updateLighting() {
    const light = mapConfig.light;
    const dx = marble.x - light.x;
    const dy = marble.y - light.y;
    const distance = Math.hypot(dx, dy) || 1;
    const worldDiagonal = Math.hypot(world.width, world.height);
    const reach = clamp(distance / worldDiagonal, 0, 1);
    const shadowDistance = light.shadowMinDistance +
      (light.shadowMaxDistance - light.shadowMinDistance) * reach;
    const shadowBlur = light.shadowMinBlur +
      (light.shadowMaxBlur - light.shadowMinBlur) * reach;

    marbleEl.style.setProperty("--marble-shadow-x", (dx / distance * shadowDistance).toFixed(1) + "px");
    marbleEl.style.setProperty("--marble-shadow-y", (dy / distance * shadowDistance).toFixed(1) + "px");
    marbleEl.style.setProperty("--marble-shadow-blur", shadowBlur.toFixed(1) + "px");
    marbleEl.style.setProperty("--marble-contact-shadow-y", light.contactShadowY.toFixed(1) + "px");
    marbleEl.style.setProperty("--marble-contact-shadow-blur", light.contactShadowBlur.toFixed(1) + "px");

    const marbleVisual = visualConfig.marble;
    const glintX = marbleVisual.glintCenter +
      (-dx / distance) * marbleVisual.glintLightOffset +
      clamp(marble.vx * marbleVisual.glintVelocityScale, -marbleVisual.glintVelocityLimit, marbleVisual.glintVelocityLimit);
    const glintY = marbleVisual.glintCenter +
      (-dy / distance) * marbleVisual.glintLightOffset +
      clamp(marble.vy * marbleVisual.glintVelocityScale, -marbleVisual.glintVelocityLimit, marbleVisual.glintVelocityLimit);
    marbleEl.style.setProperty("--marble-glint-x", glintX.toFixed(1) + "px");
    marbleEl.style.setProperty("--marble-glint-y", glintY.toFixed(1) + "px");
    marbleEl.style.setProperty("--marble-roll", marble.roll.toFixed(3) + "rad");
  }

  function render() {
    marbleEl.style.left = marble.x + "px";
    marbleEl.style.top = marble.y + "px";
    marbleEl.style.setProperty("--marble-scale-x", (1 + marble.impactSquash * visualConfig.marble.impactScaleX).toFixed(3));
    marbleEl.style.setProperty("--marble-scale-y", (1 - marble.impactSquash * visualConfig.marble.impactScaleY).toFixed(3));
    updateLighting();
  }

  return {
    render,
    syncRadius
  };
}
