import { clamp } from "./geometry.js";

export function createHapticsController(state, tuning) {
  function canVibrate() {
    return state.enabled && "vibrate" in navigator;
  }

  function pulseImpact(impact) {
    if (!canVibrate()) return;
    if (impact < state.impact.minImpact) return;

    const now = performance.now();
    if (now - state.impact.lastPulse < state.impact.cooldownMs) return;

    state.impact.lastPulse = now;
    navigator.vibrate(clamp(
      Math.round(impact * tuning.impactScale),
      tuning.impactMinDurationMs,
      tuning.impactMaxDurationMs
    ));
  }

  function pulseSurface(speed) {
    if (!canVibrate()) return;
    if (speed < state.surface.minSpeed) return;

    const now = performance.now();
    if (now - state.surface.lastPulse < state.surface.cooldownMs) return;

    state.surface.lastPulse = now;
    navigator.vibrate(clamp(
      Math.round(speed * tuning.surfaceScale),
      tuning.surfaceMinDurationMs,
      tuning.surfaceMaxDurationMs
    ));
  }

  return {
    pulseImpact,
    pulseSurface
  };
}
