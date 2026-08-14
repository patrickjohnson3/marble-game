let wakeLock = null;
let wakeLockRequest = null;

function fullscreenElement(documentRef = globalThis.document) {
  if (!documentRef) return null;

  return (
    documentRef.fullscreenElement || documentRef.webkitFullscreenElement || null
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
    target.requestFullscreen || target.webkitRequestFullscreen;

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
    documentRef.exitFullscreen || documentRef.webkitExitFullscreen;

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

export function createPwaInstallController({
  onAvailabilityChange = () => {},
  windowRef = globalThis.window,
} = {}) {
  let installPrompt = null;
  let available = false;

  function setAvailable(nextAvailable) {
    if (available === nextAvailable) return;

    available = nextAvailable;
    onAvailabilityChange(available);
  }

  function clearPrompt() {
    installPrompt = null;
    setAvailable(false);
  }

  function onBeforeInstallPrompt(event) {
    if (typeof event?.prompt !== "function") return;

    event.preventDefault?.();
    installPrompt = event;
    setAvailable(true);
  }

  async function promptInstall() {
    if (!installPrompt) return false;

    const prompt = installPrompt;
    clearPrompt();
    try {
      const promptResult = await prompt.prompt();
      const choice = prompt.userChoice ? await prompt.userChoice : promptResult;
      return choice?.outcome === "accepted";
    } catch {
      return false;
    }
  }

  windowRef?.addEventListener?.("beforeinstallprompt", onBeforeInstallPrompt);
  windowRef?.addEventListener?.("appinstalled", clearPrompt);

  return {
    promptInstall,
  };
}

const serviceWorkerUpdateStatusTimeoutMs = 30000;

function watchServiceWorkerRegistration({
  clearTimeoutFn,
  navigatorRef,
  onStatusChange,
  notifyUpdateReady,
  registration,
  setTimeoutFn,
}) {
  if (!registration?.addEventListener) return;

  if (registration.waiting && navigatorRef.serviceWorker.controller) {
    notifyUpdateReady();
  }

  registration.addEventListener("updatefound", () => {
    notifyServiceWorkerStatus(onStatusChange, "update-installing");
    const worker = registration.installing;
    if (!worker?.addEventListener) {
      notifyServiceWorkerStatus(onStatusChange, "ready");
      return;
    }

    let finished = false;
    const statusTimeout = setTimeoutFn(() => {
      if (!finished) {
        notifyServiceWorkerStatus(onStatusChange, "update-delayed");
      }
    }, serviceWorkerUpdateStatusTimeoutMs);

    function finish(status) {
      if (finished) return;

      finished = true;
      clearTimeoutFn(statusTimeout);
      if (status === "update-ready") {
        notifyUpdateReady();
      } else {
        notifyServiceWorkerStatus(onStatusChange, status);
      }
    }

    function handleStateChange() {
      if (worker.state === "installed") {
        finish(
          navigatorRef.serviceWorker.controller ? "update-ready" : "ready",
        );
      } else if (worker.state === "activated") {
        finish("ready");
      } else if (worker.state === "redundant") {
        finish("update-failed");
      }
    }

    worker.addEventListener("statechange", handleStateChange);
    handleStateChange();
  });
}

export function registerServiceWorker({
  navigatorRef = globalThis.navigator,
  onStatusChange,
  onUpdateReady,
  windowRef = globalThis.window,
  scriptUrl = "sw.js",
  setTimeoutFn = globalThis.setTimeout,
  clearTimeoutFn = globalThis.clearTimeout,
} = {}) {
  if (!navigatorRef?.serviceWorker || !windowRef?.addEventListener) {
    notifyServiceWorkerStatus(onStatusChange, "unsupported");
    return false;
  }

  let updateReadyNotified = false;
  let updateReloadStarted = false;
  function notifyUpdateReady() {
    if (updateReadyNotified) return;
    updateReadyNotified = true;
    notifyServiceWorkerUpdate(onUpdateReady);
    notifyServiceWorkerStatus(onStatusChange, "update-ready");
  }

  function reloadForActiveUpdate() {
    if (updateReloadStarted) return;
    updateReloadStarted = true;
    notifyUpdateReady();
    windowRef.location?.reload?.();
  }

  windowRef.addEventListener("load", () => {
    const hadController = Boolean(navigatorRef.serviceWorker.controller);
    notifyServiceWorkerStatus(onStatusChange, "checking");
    if (hadController && navigatorRef.serviceWorker.addEventListener) {
      navigatorRef.serviceWorker.addEventListener(
        "controllerchange",
        reloadForActiveUpdate,
        { once: true },
      );
    }

    navigatorRef.serviceWorker
      .register(scriptUrl, { type: "module" })
      .then((registration) => {
        notifyServiceWorkerStatus(onStatusChange, "ready");
        watchServiceWorkerRegistration({
          clearTimeoutFn,
          navigatorRef,
          onStatusChange,
          notifyUpdateReady,
          registration,
          setTimeoutFn,
        });
      })
      .catch((error) => {
        notifyServiceWorkerStatus(onStatusChange, "error");
        console.warn("service worker registration failed", error);
      });
  });
  return true;
}
