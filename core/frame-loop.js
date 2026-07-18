export function createFrameLoop({ requestFrame = requestAnimationFrame } = {}) {
  let frameId = 0;
  let rendered = false;
  let tick = null;

  function setTick(nextTick) {
    tick = nextTick;
  }

  function schedule() {
    if (frameId || !tick) return;

    frameId = requestFrame(tick);
  }

  function requestRender() {
    rendered = false;
    schedule();
  }

  function beginFrame() {
    frameId = 0;
  }

  function shouldSkipIdle(active) {
    return !active && rendered;
  }

  function markRendered() {
    rendered = true;
  }

  return {
    beginFrame,
    markRendered,
    requestRender,
    schedule,
    setTick,
    shouldSkipIdle,
  };
}
