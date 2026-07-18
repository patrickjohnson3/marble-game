export function createGameController({
  start,
  reset,
  pause,
  resume,
  openSettings,
  closeSettings,
  tick,
}) {
  return {
    start,
    reset,
    pause,
    resume,
    openSettings,
    closeSettings,
    tick,
  };
}
