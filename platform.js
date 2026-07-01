let wakeLock = null;

function fullscreenElement() {
  return document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.msFullscreenElement ||
    null;
}

export async function requestFullscreenMode({ fullscreenOnStart }) {
  if (!fullscreenOnStart || fullscreenElement()) return;

  const target = document.documentElement;
  const requestFullscreen = target.requestFullscreen ||
    target.webkitRequestFullscreen ||
    target.msRequestFullscreen;

  if (!requestFullscreen) return;

  try {
    await requestFullscreen.call(target);
  } catch {
    // Fullscreen is best-effort; some mobile browsers reject it.
  }
}

export async function exitFullscreenMode() {
  if (!fullscreenElement()) return;

  const exitFullscreen = document.exitFullscreen ||
    document.webkitExitFullscreen ||
    document.msExitFullscreen;

  if (!exitFullscreen) return;

  try {
    await exitFullscreen.call(document);
  } catch {
    // Fullscreen exit is best-effort; browser chrome may handle it instead.
  }
}

export async function requestWakeLock() {
  if (!("wakeLock" in navigator)) return;
  if (wakeLock || document.visibilityState !== "visible") return;

  try {
    wakeLock = await navigator.wakeLock.request("screen");
    wakeLock.addEventListener("release", () => {
      wakeLock = null;
    });
  } catch {
    wakeLock = null;
  }
}

export async function requestMotionPermissionIfNeeded() {
  try {
    if (typeof DeviceOrientationEvent !== "undefined" &&
        typeof DeviceOrientationEvent.requestPermission === "function") {
      const p = await DeviceOrientationEvent.requestPermission();
      if (p !== "granted") return false;
    }
    if (typeof DeviceMotionEvent !== "undefined" &&
        typeof DeviceMotionEvent.requestPermission === "function") {
      const p = await DeviceMotionEvent.requestPermission();
      if (p !== "granted") return false;
    }
  } catch {
    return false;
  }
  return true;
}

export function screenAdjusted(gamma, beta) {
  const angle = screen.orientation && typeof screen.orientation.angle === "number"
    ? screen.orientation.angle
    : (window.orientation || 0);

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
