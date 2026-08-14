export function createHapticsController(
  state,
  tuning,
  { vibrate = null, now = () => 0 } = {},
) {
  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function canVibrate() {
    return state.enabled && typeof vibrate === "function";
  }

  function pulseImpact(impact) {
    if (!canVibrate()) return;
    if (impact < state.impact.minImpact) return;

    const currentTime = now();
    if (currentTime - state.impact.lastPulse < state.impact.cooldownMs) return;

    state.impact.lastPulse = currentTime;
    vibrate(
      clamp(
        Math.round(impact * tuning.impactScale),
        tuning.impactMinDurationMs,
        tuning.impactMaxDurationMs,
      ),
    );
  }

  function pulseSurface(speed, surfaceType = "roughPatch") {
    if (!canVibrate()) return;
    if (speed < state.surface.minSpeed) return;

    const currentTime = now();
    if (currentTime - state.surface.lastPulse < state.surface.cooldownMs)
      return;

    state.surface.lastPulse = currentTime;
    const scale =
      {
        gooPatch: tuning.gooSurfaceScale,
        waterPatch: tuning.waterSurfaceScale,
      }[surfaceType] ?? tuning.surfaceScale;
    vibrate(
      clamp(
        Math.round(speed * scale),
        tuning.surfaceMinDurationMs,
        tuning.surfaceMaxDurationMs,
      ),
    );
  }

  function pulseGoal(kind) {
    if (!canVibrate()) return;

    if (kind === "complete") {
      vibrate(tuning.goalCompletePattern);
    } else if (kind === "hold") {
      const currentTime = now();
      if (currentTime - state.goal.lastHoldPulse < state.goal.holdCooldownMs)
        return;

      state.goal.lastHoldPulse = currentTime;
      vibrate(tuning.goalHoldDurationMs);
    } else {
      vibrate(tuning.goalEnterDurationMs);
    }
  }

  return {
    pulseImpact,
    pulseGoal,
    pulseSurface,
  };
}
