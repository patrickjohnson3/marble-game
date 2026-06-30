export function debugLines({ game, sensor, calibration, tilt, marble, camera, haptics, intro }) {
  return [
    "phase: " + game.phase,
    "sensor: " + sensor.using,
    "orientation seen: " + sensor.gotOrientation + " | motion seen: " + sensor.gotMotion,
    "auto neutral: " + calibration.autoNeutralDone,
    "raw x/y: " + tilt.rawX.toFixed(2) + " / " + tilt.rawY.toFixed(2),
    "neutral x/y: " + (tilt.neutralX ?? 0).toFixed(2) + " / " + (tilt.neutralY ?? 0).toFixed(2),
    "tilt x/y: " + tilt.smoothX.toFixed(2) + " / " + tilt.smoothY.toFixed(2),
    "vel x/y: " + marble.vx.toFixed(2) + " / " + marble.vy.toFixed(2),
    "zoom: " + camera.scale.toFixed(2) +
      " | rotation: " + (camera.rotation * 180 / Math.PI).toFixed(0) + "deg" +
      " | enabled: " + camera.rotationEnabled,
    "haptics: " + (haptics.enabled ? "on" : "off"),
    "follow cooldown: " + camera.gestureCooldown.toFixed(1),
    "map released: " + intro.released
  ];
}
