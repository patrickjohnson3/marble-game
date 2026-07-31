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

export function appDisplayMode({
  navigatorRef = globalThis.navigator,
  windowRef = globalThis.window,
} = {}) {
  if (windowRef?.matchMedia?.("(display-mode: fullscreen)")?.matches) {
    return "fullscreen";
  }
  if (windowRef?.matchMedia?.("(display-mode: standalone)")?.matches) {
    return "standalone";
  }
  if (navigatorRef?.standalone) return "standalone";

  return "browser";
}

export function isInstalledPwa({
  navigatorRef = globalThis.navigator,
  windowRef = globalThis.window,
} = {}) {
  return appDisplayMode({ navigatorRef, windowRef }) !== "browser";
}

export async function requestFullscreenMode({
  fullscreenOnStart,
  documentRef = globalThis.document,
  navigatorRef = globalThis.navigator,
  windowRef = globalThis.window,
} = {}) {
  if (
    !fullscreenOnStart ||
    !documentRef ||
    fullscreenElement(documentRef) ||
    isInstalledPwa({ navigatorRef, windowRef })
  )
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

function notifyServiceWorkerUpdate(onUpdateReady) {
  if (typeof onUpdateReady === "function") onUpdateReady();
}

function notifyServiceWorkerStatus(onStatusChange, status) {
  if (typeof onStatusChange === "function") onStatusChange(status);
}

function watchServiceWorkerRegistration({
  navigatorRef,
  onStatusChange,
  notifyUpdateReady,
  registration,
}) {
  if (!registration?.addEventListener) return;

  if (registration.waiting && navigatorRef.serviceWorker.controller) {
    notifyUpdateReady();
  }

  registration.addEventListener("updatefound", () => {
    notifyServiceWorkerStatus(onStatusChange, "update-installing");
    const worker = registration.installing;
    if (!worker?.addEventListener) return;

    worker.addEventListener("statechange", () => {
      if (
        worker.state === "installed" &&
        navigatorRef.serviceWorker.controller
      ) {
        notifyUpdateReady();
      }
    });
  });
}

export function registerServiceWorker({
  navigatorRef = globalThis.navigator,
  onStatusChange,
  onUpdateReady,
  windowRef = globalThis.window,
  scriptUrl = "sw.js",
} = {}) {
  if (!navigatorRef?.serviceWorker || !windowRef?.addEventListener) {
    notifyServiceWorkerStatus(onStatusChange, "unsupported");
    return false;
  }

  let updateReadyNotified = false;
  function notifyUpdateReady() {
    if (updateReadyNotified) return;
    updateReadyNotified = true;
    notifyServiceWorkerUpdate(onUpdateReady);
    notifyServiceWorkerStatus(onStatusChange, "update-ready");
  }

  windowRef.addEventListener("load", () => {
    const hadController = Boolean(navigatorRef.serviceWorker.controller);
    notifyServiceWorkerStatus(onStatusChange, "checking");
    if (hadController && navigatorRef.serviceWorker.addEventListener) {
      navigatorRef.serviceWorker.addEventListener(
        "controllerchange",
        notifyUpdateReady,
        { once: true },
      );
    }

    navigatorRef.serviceWorker
      .register(scriptUrl, { type: "module" })
      .then((registration) => {
        notifyServiceWorkerStatus(onStatusChange, "ready");
        watchServiceWorkerRegistration({
          navigatorRef,
          onStatusChange,
          notifyUpdateReady,
          registration,
        });
      })
      .catch((error) => {
        notifyServiceWorkerStatus(onStatusChange, "error");
        console.warn("service worker registration failed", error);
      });
  });
  return true;
}
