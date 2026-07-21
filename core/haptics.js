export function createHapticsController(
  state,
  tuning,
  {
    navigatorRef = () => globalThis.navigator,
    performanceRef = () => globalThis.performance,
  } = {},
) {
  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function now() {
    return performanceRef()?.now?.() ?? Date.now();
  }

  function vibrate(pattern) {
    const navigator = navigatorRef();
    if (!state.enabled || typeof navigator?.vibrate !== "function")
      return false;

    try {
      return navigator.vibrate(pattern) !== false;
    } catch {
      // Vibration support can disappear or be blocked by browser policy.
      return false;
    }
  }

  function pulseImpact(impact) {
    if (impact < state.impact.minImpact) return;

    const currentTime = now();
    if (currentTime - state.impact.lastPulse < state.impact.cooldownMs) return;

    if (
      vibrate(
        clamp(
          Math.round(impact * tuning.impactScale),
          tuning.impactMinDurationMs,
          tuning.impactMaxDurationMs,
        ),
      )
    ) {
      state.impact.lastPulse = currentTime;
    }
  }

  function pulseSurface(speed) {
    if (speed < state.surface.minSpeed) return;

    const currentTime = now();
    if (currentTime - state.surface.lastPulse < state.surface.cooldownMs)
      return;

    if (
      vibrate(
        clamp(
          Math.round(speed * tuning.surfaceScale),
          tuning.surfaceMinDurationMs,
          tuning.surfaceMaxDurationMs,
        ),
      )
    ) {
      state.surface.lastPulse = currentTime;
    }
  }

  function pulseGoal(kind) {
    if (kind === "complete") {
      vibrate(tuning.goalCompletePattern);
    } else if (kind === "hold") {
      const currentTime = now();
      if (currentTime - state.goal.lastHoldPulse < state.goal.holdCooldownMs)
        return;

      if (vibrate(tuning.goalHoldDurationMs)) {
        state.goal.lastHoldPulse = currentTime;
      }
    } else {
      vibrate(tuning.goalEnterDurationMs);
    }
  }

  function primeGesture() {
    vibrate(tuning.startPrimeDurationMs);
  }

  return {
    primeGesture,
    pulseImpact,
    pulseGoal,
    pulseSurface,
  };
}
