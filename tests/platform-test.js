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

await testWakeLockRequestIsNotDuplicatedWhilePending();
await testFullscreenUsesInjectedDocument();
await testMotionPermissionUsesInjectedWindow();
await testScreenAdjustedUsesInjectedScreen();

console.log("Platform tests passed.");
