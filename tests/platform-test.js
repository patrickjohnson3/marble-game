import assert from "node:assert/strict";

async function testWakeLockRequestIsNotDuplicatedWhilePending() {
  let requestCount = 0;
  let resolveWakeLock;

  const documentRef = { visibilityState: "visible" };
  const navigatorRef = {
    wakeLock: {
      request(type) {
        requestCount++;
        assert.equal(type, "screen");
        return new Promise((resolve) => {
          resolveWakeLock = resolve;
        });
      },
    },
  };

  const { requestWakeLock } = await import(
    "../platform/platform.js?test=" + Date.now()
  );
  const firstRequest = requestWakeLock({ documentRef, navigatorRef });
  const secondRequest = requestWakeLock({ documentRef, navigatorRef });

  assert.equal(requestCount, 1);
  resolveWakeLock({ addEventListener() {} });
  await Promise.all([firstRequest, secondRequest]);
  assert.equal(requestCount, 1);
}

async function testFullscreenUsesInjectedDocument() {
  let requested = false;
  const documentRef = {
    fullscreenElement: null,
    documentElement: {
      requestFullscreen() {
        requested = true;
      },
    },
  };

  const { requestFullscreenMode } = await import(
    "../platform/platform.js?test=" + Date.now()
  );
  await requestFullscreenMode({ fullscreenOnStart: true, documentRef });

  assert.equal(requested, true);
}

async function testFullscreenSkipsInstalledPwaDisplayMode() {
  let requested = false;
  const documentRef = {
    fullscreenElement: null,
    documentElement: {
      requestFullscreen() {
        requested = true;
      },
    },
  };
  const windowRef = {
    matchMedia(query) {
      return { matches: query === "(display-mode: standalone)" };
    },
  };

  const { requestFullscreenMode } = await import(
    "../platform/platform.js?test=" + Date.now()
  );
  await requestFullscreenMode({
    fullscreenOnStart: true,
    documentRef,
    windowRef,
  });

  assert.equal(requested, false);
}

async function testAppDisplayModeDetectsInstalledPwa() {
  const { appDisplayMode, isInstalledPwa } = await import(
    "../platform/platform.js?test=" + Date.now()
  );
  const windowRef = {
    matchMedia(query) {
      return { matches: query === "(display-mode: fullscreen)" };
    },
  };

  assert.equal(appDisplayMode({ windowRef }), "fullscreen");
  assert.equal(isInstalledPwa({ windowRef }), true);
}

async function testMotionPermissionUsesInjectedWindow() {
  let orientationRequested = false;
  let motionRequested = false;
  const windowRef = {
    DeviceOrientationEvent: {
      requestPermission() {
        orientationRequested = true;
        return "granted";
      },
    },
    DeviceMotionEvent: {
      requestPermission() {
        motionRequested = true;
        return "granted";
      },
    },
  };

  const { requestMotionPermissionIfNeeded } = await import(
    "../platform/platform.js?test=" + Date.now()
  );
  const granted = await requestMotionPermissionIfNeeded({ windowRef });

  assert.equal(granted, true);
  assert.equal(orientationRequested, true);
  assert.equal(motionRequested, true);
}

async function testScreenAdjustedUsesInjectedScreen() {
  const { screenAdjusted } = await import(
    "../platform/platform.js?test=" + Date.now()
  );

  assert.deepEqual(
    screenAdjusted(3, 8, {
      screenRef: { orientation: { angle: 90 } },
      windowRef: {},
    }),
    [8, -3],
  );
}

async function testPwaInstallControllerUsesAvailableBrowserPromptOnce() {
  const listeners = {};
  const availability = [];
  let preventDefaultCount = 0;
  let promptCount = 0;
  const { createPwaInstallController } = await import(
    "../platform/platform.js?test=" + Date.now()
  );
  const controller = createPwaInstallController({
    onAvailabilityChange(available) {
      availability.push(available);
    },
    windowRef: {
      addEventListener(type, listener) {
        listeners[type] = listener;
      },
    },
  });
  const promptEvent = {
    preventDefault() {
      preventDefaultCount++;
    },
    prompt() {
      promptCount++;
    },
    userChoice: Promise.resolve({ outcome: "accepted" }),
  };

  listeners.beforeinstallprompt(promptEvent);
  assert.deepEqual(availability, [true]);
  assert.equal(preventDefaultCount, 1);

  assert.equal(await controller.promptInstall(), true);
  assert.equal(promptCount, 1);
  assert.deepEqual(availability, [true, false]);
  assert.equal(await controller.promptInstall(), false);
  assert.equal(promptCount, 1);

  listeners.beforeinstallprompt(promptEvent);
  listeners.appinstalled();
  assert.deepEqual(availability, [true, false, true, false]);
}

async function testServiceWorkerRegistrationIsDeferredUntilLoad() {
  const listeners = {};
  let registration = null;
  let registrationListener = null;
  const statuses = [];
  const { registerServiceWorker } = await import(
    "../platform/platform.js?test=" + Date.now()
  );
  const registered = registerServiceWorker({
    navigatorRef: {
      serviceWorker: {
        register(scriptUrl, options) {
          registration = { options, scriptUrl };
          return Promise.resolve({
            addEventListener(type, listener) {
              registrationListener = { listener, type };
            },
          });
        },
      },
    },
    onStatusChange(status) {
      statuses.push(status);
    },
    windowRef: {
      addEventListener(type, listener) {
        listeners[type] = listener;
      },
    },
  });

  assert.equal(registered, true);
  assert.equal(registration, null);
  await listeners.load();
  await Promise.resolve();
  assert.deepEqual(registration, {
    options: { type: "module" },
    scriptUrl: "sw.js",
  });
  assert.deepEqual(statuses, ["checking", "ready"]);
  assert.equal(registrationListener.type, "updatefound");
  assert.equal(typeof registrationListener.listener, "function");
}

async function testServiceWorkerRegistrationHandlesUnsupportedBrowsers() {
  const { registerServiceWorker } = await import(
    "../platform/platform.js?test=" + Date.now()
  );
  const statuses = [];

  assert.equal(
    registerServiceWorker({
      navigatorRef: {},
      onStatusChange(status) {
        statuses.push(status);
      },
      windowRef: {},
    }),
    false,
  );
  assert.deepEqual(statuses, ["unsupported"]);
}

async function testServiceWorkerRegistrationReportsWaitingUpdate() {
  const listeners = {};
  let updateReadyCount = 0;
  const { registerServiceWorker } = await import(
    "../platform/platform.js?test=" + Date.now()
  );

  registerServiceWorker({
    navigatorRef: {
      serviceWorker: {
        controller: {},
        register() {
          return Promise.resolve({
            addEventListener() {},
            waiting: {},
          });
        },
      },
    },
    onUpdateReady() {
      updateReadyCount++;
    },
    windowRef: {
      addEventListener(type, listener) {
        listeners[type] = listener;
      },
    },
  });

  await listeners.load();
  await Promise.resolve();
  assert.equal(updateReadyCount, 1);
}

async function testServiceWorkerRegistrationReportsInstalledUpdate() {
  const listeners = {};
  const workerListeners = {};
  const statuses = [];
  const worker = {
    state: "installing",
    addEventListener(type, listener) {
      workerListeners[type] = listener;
    },
  };
  let registrationListener = null;
  let updateReadyCount = 0;
  const { registerServiceWorker } = await import(
    "../platform/platform.js?test=" + Date.now()
  );

  registerServiceWorker({
    navigatorRef: {
      serviceWorker: {
        controller: {},
        register() {
          return Promise.resolve({
            get installing() {
              return worker;
            },
            addEventListener(type, listener) {
              registrationListener = listener;
            },
          });
        },
      },
    },
    onUpdateReady() {
      updateReadyCount++;
    },
    onStatusChange(status) {
      statuses.push(status);
    },
    windowRef: {
      addEventListener(type, listener) {
        listeners[type] = listener;
      },
    },
  });

  await listeners.load();
  await Promise.resolve();
  registrationListener();
  worker.state = "installed";
  workerListeners.statechange();

  assert.equal(updateReadyCount, 1);
  assert.deepEqual(statuses, [
    "checking",
    "ready",
    "update-installing",
    "update-ready",
  ]);
}

async function testServiceWorkerFirstInstallReturnsToReady() {
  const listeners = {};
  const workerListeners = {};
  const statuses = [];
  const clearedTimers = [];
  const worker = {
    state: "installing",
    addEventListener(type, listener) {
      workerListeners[type] = listener;
    },
  };
  let registrationListener = null;
  const { registerServiceWorker } = await import(
    "../platform/platform.js?test=" + Date.now()
  );

  registerServiceWorker({
    navigatorRef: {
      serviceWorker: {
        controller: null,
        register() {
          return Promise.resolve({
            get installing() {
              return worker;
            },
            addEventListener(type, listener) {
              registrationListener = listener;
            },
          });
        },
      },
    },
    onStatusChange(status) {
      statuses.push(status);
    },
    setTimeoutFn() {
      return 17;
    },
    clearTimeoutFn(timer) {
      clearedTimers.push(timer);
    },
    windowRef: {
      addEventListener(type, listener) {
        listeners[type] = listener;
      },
    },
  });

  await listeners.load();
  await Promise.resolve();
  registrationListener();
  worker.state = "installed";
  workerListeners.statechange();

  assert.deepEqual(statuses, [
    "checking",
    "ready",
    "update-installing",
    "ready",
  ]);
  assert.deepEqual(clearedTimers, [17]);
}

async function testServiceWorkerReportsDelayedAndFailedUpdates() {
  const listeners = {};
  const workerListeners = {};
  const statuses = [];
  const worker = {
    state: "installing",
    addEventListener(type, listener) {
      workerListeners[type] = listener;
    },
  };
  let registrationListener = null;
  let timeoutCallback = null;
  const { registerServiceWorker } = await import(
    "../platform/platform.js?test=" + Date.now()
  );

  registerServiceWorker({
    navigatorRef: {
      serviceWorker: {
        controller: {},
        register() {
          return Promise.resolve({
            get installing() {
              return worker;
            },
            addEventListener(type, listener) {
              registrationListener = listener;
            },
          });
        },
      },
    },
    onStatusChange(status) {
      statuses.push(status);
    },
    setTimeoutFn(callback) {
      timeoutCallback = callback;
      return 23;
    },
    clearTimeoutFn() {},
    windowRef: {
      addEventListener(type, listener) {
        listeners[type] = listener;
      },
    },
  });

  await listeners.load();
  await Promise.resolve();
  registrationListener();
  timeoutCallback();
  worker.state = "redundant";
  workerListeners.statechange();

  assert.deepEqual(statuses, [
    "checking",
    "ready",
    "update-installing",
    "update-delayed",
    "update-failed",
  ]);
}

async function testServiceWorkerRegistrationReloadsWhenUpdateTakesControl() {
  const windowListeners = {};
  const serviceWorkerListeners = {};
  const statuses = [];
  let reloadCount = 0;
  const { registerServiceWorker } = await import(
    "../platform/platform.js?test=" + Date.now()
  );

  registerServiceWorker({
    navigatorRef: {
      serviceWorker: {
        controller: {},
        addEventListener(type, listener) {
          serviceWorkerListeners[type] = listener;
        },
        register() {
          return Promise.resolve({ addEventListener() {} });
        },
      },
    },
    onStatusChange(status) {
      statuses.push(status);
    },
    windowRef: {
      addEventListener(type, listener) {
        windowListeners[type] = listener;
      },
      location: {
        reload() {
          reloadCount++;
        },
      },
    },
  });

  await windowListeners.load();
  await Promise.resolve();
  serviceWorkerListeners.controllerchange();
  serviceWorkerListeners.controllerchange();

  assert.equal(reloadCount, 1);
  assert.deepEqual(statuses, ["checking", "ready", "update-ready"]);
}

await testWakeLockRequestIsNotDuplicatedWhilePending();
await testFullscreenUsesInjectedDocument();
await testFullscreenSkipsInstalledPwaDisplayMode();
await testAppDisplayModeDetectsInstalledPwa();
await testMotionPermissionUsesInjectedWindow();
await testScreenAdjustedUsesInjectedScreen();
await testPwaInstallControllerUsesAvailableBrowserPromptOnce();
await testServiceWorkerRegistrationIsDeferredUntilLoad();
await testServiceWorkerRegistrationHandlesUnsupportedBrowsers();
await testServiceWorkerRegistrationReportsWaitingUpdate();
await testServiceWorkerRegistrationReportsInstalledUpdate();
await testServiceWorkerFirstInstallReturnsToReady();
await testServiceWorkerReportsDelayedAndFailedUpdates();
await testServiceWorkerRegistrationReloadsWhenUpdateTakesControl();

console.log("Platform tests passed.");
