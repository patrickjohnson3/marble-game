export function elapsedMsToFrameDelta(elapsedMs, timing, clamp) {
  return clamp(
    elapsedMs / timing.targetFrameMs,
    timing.minFrameStep,
    timing.maxFrameStep,
  );
}

export function frameDeltaToMs(frameDelta, timing) {
  return frameDelta * timing.targetFrameMs;
}
