let wakeLock = null;
let wakeLockRequest = null;

function fullscreenElement(documentRef = globalThis.document) {
  if (!documentRef) return null;

  return (
    documentRef.fullscreenElement ||
    documentRef.webkitFullscreenElement ||
    documentRef.msFullscreenElement ||
    null
  );
}

export async function requestFullscreenMode({
  fullscreenOnStart,
  documentRef = globalThis.document,
} = {}) {
  if (!fullscreenOnStart || !documentRef || fullscreenElement(documentRef))
    return;

  const target = documentRef.documentElement;
  if (!target) return;
  const requestFullscreen =
    target.requestFullscreen ||
    target.webkitRequestFullscreen ||
    target.msRequestFullscreen;

  if (!requestFullscreen) return;

  try {
    await requestFullscreen.call(target);
  } catch {
    // Fullscreen is best-effort; some mobile browsers reject it.
  }
}

export async function exitFullscreenMode({
  documentRef = globalThis.document,
} = {}) {
  if (!documentRef || !fullscreenElement(documentRef)) return;

  const exitFullscreen =
    documentRef.exitFullscreen ||
    documentRef.webkitExitFullscreen ||
    documentRef.msExitFullscreen;

  if (!exitFullscreen) return;

  try {
    await exitFullscreen.call(documentRef);
  } catch {
    // Fullscreen exit is best-effort; browser chrome may handle it instead.
  }
}

export async function requestWakeLock({
  documentRef = globalThis.document,
  navigatorRef = globalThis.navigator,
} = {}) {
  if (!navigatorRef || !("wakeLock" in navigatorRef)) return;
  if (wakeLock || wakeLockRequest || documentRef?.visibilityState !== "visible")
    return;

  wakeLockRequest = navigatorRef.wakeLock.request("screen");
  try {
    const lock = await wakeLockRequest;
    wakeLock = lock;
    wakeLock.addEventListener("release", () => {
      wakeLock = null;
    });
  } catch {
    wakeLock = null;
  } finally {
    wakeLockRequest = null;
  }
}

export async function requestMotionPermissionIfNeeded({
  windowRef = globalThis.window,
} = {}) {
  try {
    const OrientationEvent =
      windowRef?.DeviceOrientationEvent || globalThis.DeviceOrientationEvent;
    const MotionEvent =
      windowRef?.DeviceMotionEvent || globalThis.DeviceMotionEvent;

    if (
      typeof OrientationEvent !== "undefined" &&
      typeof OrientationEvent.requestPermission === "function"
    ) {
      const p = await OrientationEvent.requestPermission();
      if (p !== "granted") return false;
    }
    if (
      typeof MotionEvent !== "undefined" &&
      typeof MotionEvent.requestPermission === "function"
    ) {
      const p = await MotionEvent.requestPermission();
      if (p !== "granted") return false;
    }
  } catch {
    return false;
  }
  return true;
}

export function screenAdjusted(
  gamma,
  beta,
  { screenRef = globalThis.screen, windowRef = globalThis.window } = {},
) {
  const angle =
    screenRef?.orientation && typeof screenRef.orientation.angle === "number"
      ? screenRef.orientation.angle
      : windowRef?.orientation || 0;

  let tx = gamma || 0;
  let ty = beta || 0;

  if (angle === 90) {
    [tx, ty] = [ty, -tx];
  } else if (angle === -90 || angle === 270) {
    [tx, ty] = [-ty, tx];
  } else if (angle === 180) {
    tx = -tx;
    ty = -ty;
  }

  return [tx, ty];
}

export function createViewport(target = globalThis) {
  return {
    width: () => target.innerWidth,
    height: () => target.innerHeight,
  };
}

export function registerServiceWorker({
  navigatorRef = globalThis.navigator,
  windowRef = globalThis.window,
  scriptUrl = "sw.js",
} = {}) {
  if (!navigatorRef?.serviceWorker || !windowRef?.addEventListener) {
    return false;
  }

  windowRef.addEventListener("load", () => {
    navigatorRef.serviceWorker
      .register(scriptUrl, { type: "module" })
      .catch((error) => {
        console.warn("service worker registration failed", error);
      });
  });
  return true;
}
