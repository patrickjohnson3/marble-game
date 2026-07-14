export function createHapticsController(state, tuning) {
  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

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

  function pulseGoal(kind) {
    if (!canVibrate()) return;

    if (kind === "complete") {
      navigator.vibrate(tuning.goalCompletePattern);
    } else if (kind === "hold") {
      const now = performance.now();
      if (now - state.goal.lastHoldPulse < state.goal.holdCooldownMs) return;

      state.goal.lastHoldPulse = now;
      navigator.vibrate(tuning.goalHoldDurationMs);
    } else {
      navigator.vibrate(tuning.goalEnterDurationMs);
    }
  }

  return {
    pulseImpact,
    pulseGoal,
    pulseSurface
  };
}
