export function createTimeoutRegistry({
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout
} = {}) {
  const timers = new Set();

  function schedule(callback, delay) {
    const timer = setTimeoutFn(() => {
      timers.delete(timer);
      callback();
    }, delay);
    timers.add(timer);
    return timer;
  }

  function clearAll() {
    timers.forEach((timer) => clearTimeoutFn(timer));
    timers.clear();
  }

  return {
    clearAll,
    schedule
  };
}

export function createPausableTimeout({
  delayMs,
  onRun,
  now = () => performance.now(),
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout
}) {
  let timer = 0;
  let startedAt = 0;
  let remainingDelayMs = delayMs;

  function run() {
    timer = 0;
    startedAt = 0;
    remainingDelayMs = delayMs;
    onRun();
  }

  function schedule(delay = delayMs) {
    clearTimeoutFn(timer);
    startedAt = now();
    remainingDelayMs = delay;
    timer = setTimeoutFn(run, delay);
  }

  function pause() {
    if (!timer) return;

    const elapsed = now() - startedAt;
    remainingDelayMs = Math.max(0, remainingDelayMs - elapsed);
    clearTimeoutFn(timer);
    timer = 0;
  }

  function resume(shouldResume) {
    if (!shouldResume() || timer) return;

    schedule(Math.max(0, remainingDelayMs));
  }

  function reset() {
    clearTimeoutFn(timer);
    timer = 0;
    startedAt = 0;
    remainingDelayMs = delayMs;
  }

  return {
    pause,
    reset,
    resume,
    schedule
  };
}
