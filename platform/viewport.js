export function createViewport(target = globalThis) {
  return {
    width: () => target.innerWidth,
    height: () => target.innerHeight
  };
}
