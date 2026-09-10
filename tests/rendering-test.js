import assert from "node:assert/strict";
import { circleOrientedRectContact } from "../core/physics-collisions.js";
import { createForkCollisionRects } from "../core/map-obstacles.js";
import {
  createKitchenDynamics,
  createKitchenDynamicsState,
} from "../core/kitchen-dynamics.js";
import { renderGooPatches } from "../rendering/goo-patch-rendering.js";
import { renderHazardPatches } from "../rendering/hazard-patch-rendering.js";
import { renderIcePatches } from "../rendering/ice-patch-rendering.js";
import {
  renderMapTheme,
  renderMapThemeDynamics,
} from "../rendering/map-theme-rendering.js";
import {
  renderObstacleHitboxes,
  renderObstacleWalls,
} from "../rendering/obstacle-rendering.js";
import { renderRoughPatches } from "../rendering/rough-patch-rendering.js";
import { renderWaterPatches } from "../rendering/water-patch-rendering.js";
import { renderOuterWalls } from "../rendering/wall-rendering.js";
import {
  createMapRenderer,
  createTerrainView,
} from "../rendering/map-renderer.js";
import { createMarbleView } from "../rendering/marble-view.js";
import { createUi } from "../rendering/ui.js";
import { FakeCanvasElement, FakeElement } from "./test-dom.js";

function withFakeDocument(callback) {
  const originalDocument = globalThis.document;

  globalThis.document = {
    createElement(tagName) {
      return tagName === "canvas" ? new FakeCanvasElement() : new FakeElement();
    },
  };
  try {
    callback();
  } finally {
    if (originalDocument === undefined) {
      delete globalThis.document;
    } else {
      globalThis.document = originalDocument;
    }
  }
}

function withFakeImage(callback) {
  const originalImage = globalThis.Image;

  globalThis.Image = class {
    constructor() {
      this.complete = true;
      this.naturalWidth = 252;
      this.src = "";
    }
  };
  try {
    callback();
  } finally {
    if (originalImage === undefined) {
      delete globalThis.Image;
    } else {
      globalThis.Image = originalImage;
    }
  }
}

function withFakeAnimationFrame(callback) {
  const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
  const callbacks = [];

  globalThis.requestAnimationFrame = (nextCallback) => {
    callbacks.push(nextCallback);
    return callbacks.length;
  };
  try {
    callback(callbacks);
  } finally {
    if (originalRequestAnimationFrame === undefined) {
      delete globalThis.requestAnimationFrame;
    } else {
      globalThis.requestAnimationFrame = originalRequestAnimationFrame;
    }
  }
}

function kitchenDynamicsWith(overrides = {}) {
  return createKitchenDynamics({
    ...createKitchenDynamicsState(),
    ...overrides,
  });
}

function createMapState({
  goal = { x: 100, y: 120, r: 50 },
  mapConfig = {},
  obstacleBounds = null,
  obstacles = [],
  terrainByType = {},
  world = { width: 100, height: 100 },
} = {}) {
  return {
    activeMap: { ...mapConfig, goal, world },
    obstacleBounds,
    obstacles,
    terrainByType,
  };
}

function updateAndRenderMapThemeDynamics({
  dynamics,
  mapConfig,
  marble,
  previousMarble = marble,
  frameDelta = 1,
  themeState = {},
}) {
  const events = dynamics.update(mapConfig, marble, previousMarble, frameDelta);
  renderMapThemeDynamics({
    dynamicsState: dynamics.state,
    mapConfig,
    themeState,
  });
  return events;
}

function testRenderOuterWallsKeepsPositiveInterior() {
  const container = new FakeElement();

  withFakeDocument(() => {
    renderOuterWalls(container, [
      { x: -34, y: -34, w: 2268, h: 34 },
      { x: -34, y: 2200, w: 2268, h: 34 },
      { x: -34, y: 0, w: 34, h: 2200 },
      { x: 2200, y: 0, w: 34, h: 2200 },
    ]);
  });

  const frame = container.children[0];
  assert.equal(container.children.length, 1);
  assert.equal(frame.className, "wallFrame");
  assert.equal(frame.style.left, "-34px");
  assert.equal(frame.style.top, "-34px");
  assert.equal(frame.style.width, "2268px");
  assert.equal(frame.style.height, "2268px");
  assert.equal(frame.style.properties["--wall-thickness"], "34px");
  assert.equal(
    frame.context,
    undefined,
    "wall frame should not allocate canvas",
  );
}

testRenderOuterWallsKeepsPositiveInterior();

function testRenderOuterWallsRejectsInvalidWalls() {
  [
    [],
    [{ x: 0, y: 0, w: 100, h: 10 }],
    [{ x: 0, y: 0, w: 10, h: 100 }],
    [{ x: 0, y: 0, w: Number.NaN, h: 10 }],
  ].forEach((walls) => {
    const container = new FakeElement();

    withFakeDocument(() => {
      renderOuterWalls(container, walls);
    });

    assert.equal(container.children.length, 0);
  });
}

testRenderOuterWallsRejectsInvalidWalls();

function testRenderOuterWallsReusesFrameElement() {
  const container = new FakeElement();

  withFakeDocument(() => {
    renderOuterWalls(container, [
      { x: -34, y: -34, w: 2268, h: 34 },
      { x: -34, y: 2200, w: 2268, h: 34 },
      { x: -34, y: 0, w: 34, h: 2200 },
      { x: 2200, y: 0, w: 34, h: 2200 },
    ]);
  });
  const frame = container.children[0];
  withFakeDocument(() => {
    renderOuterWalls(container, [
      { x: -20, y: -20, w: 1040, h: 20 },
      { x: -20, y: 1000, w: 1040, h: 20 },
      { x: -20, y: 0, w: 20, h: 1000 },
      { x: 1000, y: 0, w: 20, h: 1000 },
    ]);
  });

  assert.equal(container.children[0], frame);
  assert.equal(frame.style.width, "1040px");
  assert.equal(frame.style.properties["--wall-thickness"], "20px");
}

testRenderOuterWallsReusesFrameElement();

function testRenderOuterWallsUsesFrameGeometry() {
  const container = new FakeElement();

  withFakeDocument(() => {
    renderOuterWalls(container, [
      { x: -34, y: -34, w: 2268, h: 34 },
      { x: -34, y: 2200, w: 2268, h: 34 },
      { x: -34, y: 0, w: 34, h: 2200 },
      { x: 2200, y: 0, w: 34, h: 2200 },
    ]);
  });

  assert.equal(container.children.length, 1);
}

testRenderOuterWallsUsesFrameGeometry();

function testFpsCounterDefaultsHiddenAndUpdatesWhenEnabled() {
  const hint = new FakeElement();
  const fpsCounter = new FakeElement();
  const debug = new FakeElement();
  const settingsOverlay = new FakeElement();
  const settings = { fpsEnabled: false, statsEnabled: false };
  const ui = createUi({
    hint,
    fpsCounter,
    debug,
    settings,
    settingsOverlay,
    debugLines: () => [],
    state: {},
  });

  ui.updateFps(1000);
  assert.equal(fpsCounter.hidden, true);
  assert.equal(fpsCounter.attributes["aria-hidden"], "true");

  settings.fpsEnabled = true;
  ui.setFpsEnabled(settings.fpsEnabled);
  ui.updateFps(1000);
  ui.updateFps(1500);

  assert.equal(fpsCounter.hidden, false);
  assert.equal(fpsCounter.attributes["aria-hidden"], "false");
  assert.equal(fpsCounter.textContent, "fps 2");
}

testFpsCounterDefaultsHiddenAndUpdatesWhenEnabled();

function testStatsDefaultsHiddenAndUpdatesWhenEnabled() {
  const hint = new FakeElement();
  const fpsCounter = new FakeElement();
  const debug = new FakeElement();
  const settingsOverlay = new FakeElement();
  const settings = { fpsEnabled: false, statsEnabled: false };
  let phase = "running";
  const ui = createUi({
    hint,
    fpsCounter,
    debug,
    settings,
    settingsOverlay,
    debugLines: () => ["phase: " + phase],
    state: {},
  });

  ui.updateDebugPanel();
  assert.equal(debug.hidden, true);
  assert.equal(debug.attributes["aria-hidden"], "true");
  assert.equal(debug.textContent, "");

  settings.statsEnabled = true;
  ui.setStatsEnabled(settings.statsEnabled);
  ui.updateDebugPanel();

  assert.equal(debug.hidden, false);
  assert.equal(debug.attributes["aria-hidden"], "false");
  assert.equal(debug.textContent, "phase: running");

  phase = "paused";
  ui.updateDebugPanel({ now: performance.now() + 10 });
  assert.equal(debug.textContent, "phase: running");

  ui.updateDebugPanel({ now: performance.now() + 300 });
  assert.equal(debug.textContent, "phase: paused");
}

testStatsDefaultsHiddenAndUpdatesWhenEnabled();

function testPwaStatusUpdatesSettingsStatus() {
  const pwaStatus = new FakeElement();
  const installApp = new FakeElement();
  const ui = createUi({
    hint: new FakeElement(),
    fpsCounter: new FakeElement(),
    debug: new FakeElement(),
    installApp,
    pwaStatus,
    settings: { fpsEnabled: false, statsEnabled: false },
    settingsOverlay: new FakeElement(),
    debugLines: () => [],
    state: {},
  });

  ui.setPwaStatus("offline app ready.");
  assert.equal(pwaStatus.textContent, "offline app ready.");
  assert.equal(pwaStatus.hidden, false);

  ui.setPwaStatus("");
  assert.equal(pwaStatus.hidden, true);

  ui.setPwaInstallAvailable(true);
  assert.equal(installApp.hidden, false);
  ui.setPwaInstallAvailable(false);
  assert.equal(installApp.hidden, true);
}

testPwaStatusUpdatesSettingsStatus();

function testGameplayStatusVisibility() {
  const gameStatus = new FakeElement();
  const ui = createUi({
    gameStatus,
    hint: new FakeElement(),
    fpsCounter: new FakeElement(),
    debug: new FakeElement(),
    settings: { fpsEnabled: false, statsEnabled: false },
    settingsOverlay: new FakeElement(),
    debugLines: () => [],
    state: {},
  });

  ui.setGameStatus("keep holding normally for half a sec...");
  assert.equal(gameStatus.hidden, false);
  assert.equal(
    gameStatus.textContent,
    "keep holding normally for half a sec...",
  );

  ui.setGameStatus("");
  assert.equal(gameStatus.hidden, true);
}

testGameplayStatusVisibility();

function testLevelLabelHidesWhenEmpty() {
  const levelLabel = new FakeElement();
  const ui = createUi({
    hint: new FakeElement(),
    levelLabel,
    fpsCounter: new FakeElement(),
    debug: new FakeElement(),
    settings: { fpsEnabled: false, statsEnabled: false },
    settingsOverlay: new FakeElement(),
    debugLines: () => [],
    state: {},
  });

  ui.setLevelLabel("level 1: kitchen floor");
  assert.equal(levelLabel.hidden, false);
  assert.equal(levelLabel.textContent, "level 1: kitchen floor");

  ui.setLevelLabel("");
  assert.equal(levelLabel.hidden, true);
}

testLevelLabelHidesWhenEmpty();

function testLevelLabelCanHideAfterATransientHandoff() {
  const levelLabel = new FakeElement();
  let hideLabel = null;
  const ui = createUi({
    hint: new FakeElement(),
    levelLabel,
    fpsCounter: new FakeElement(),
    debug: new FakeElement(),
    settings: { fpsEnabled: false, statsEnabled: false },
    settingsOverlay: new FakeElement(),
    debugLines: () => [],
    state: {},
    clearTimeoutFn() {},
    setTimeoutFn(callback, delay) {
      assert.equal(delay, 1800);
      hideLabel = callback;
      return 1;
    },
  });

  ui.showLevelLabel("level 2: living room", 1800);
  assert.equal(levelLabel.hidden, false);
  assert.equal(levelLabel.textContent, "level 2: living room");

  hideLabel();
  assert.equal(levelLabel.hidden, true);
}

testLevelLabelCanHideAfterATransientHandoff();

function testMapObjectStatusUpdatesSettingsStatus() {
  const mapObjectsStatus = new FakeElement();
  const ui = createUi({
    hint: new FakeElement(),
    fpsCounter: new FakeElement(),
    debug: new FakeElement(),
    mapObjectsStatus,
    settings: { fpsEnabled: false, statsEnabled: false },
    settingsOverlay: new FakeElement(),
    debugLines: () => [],
    state: {},
  });

  ui.setMapObjects("objects: fork, spoon, Cheerios.");
  assert.equal(mapObjectsStatus.textContent, "objects: fork, spoon, Cheerios.");
  assert.equal(mapObjectsStatus.hidden, false);

  ui.setMapObjects("");
  assert.equal(mapObjectsStatus.hidden, true);
}

testMapObjectStatusUpdatesSettingsStatus();

function testGoalIndicatorUpdatesVisibilityAndAngle() {
  const goalIndicator = new FakeElement();
  const ui = createUi({
    hint: new FakeElement(),
    fpsCounter: new FakeElement(),
    debug: new FakeElement(),
    goalIndicator,
    levelLabel: new FakeElement(),
    settings: { fpsEnabled: false, statsEnabled: false },
    settingsOverlay: new FakeElement(),
    debugLines: () => [],
    state: {},
  });

  ui.setGoalIndicator(true, 1.25);

  assert.equal(goalIndicator.classList.contains("show"), true);
  assert.equal(
    goalIndicator.style.properties["--goal-indicator-angle"],
    "1.25rad",
  );

  ui.setGoalIndicator(false);
  assert.equal(goalIndicator.classList.contains("show"), false);
}

testGoalIndicatorUpdatesVisibilityAndAngle();

function testMarbleVisibleOnlyAfterValidLayout() {
  const marbleEl = new FakeElement("marble");
  const marble = { x: 100, y: 120, vx: 0, vy: 0, r: 0, roll: 0 };
  const view = createMarbleView({
    marbleEl,
    marble,
    world: { width: 400, height: 400 },
    mapConfig: {
      light: {
        x: 0,
        y: 0,
        shadowMinDistance: 1,
        shadowMaxDistance: 2,
        shadowMinBlur: 1,
        shadowMaxBlur: 2,
        contactShadowY: 1,
        contactShadowBlur: 1,
      },
    },
    visualConfig: {
      marble: {
        glintCenter: 29,
        glintLightOffset: 11,
        glintVelocityScale: 0.08,
        glintVelocityLimit: 1.5,
        impactScaleX: 0.08,
        impactScaleY: 0.06,
      },
    },
    clamp: (value, min, max) => Math.min(max, Math.max(min, value)),
  });

  view.render();
  assert.equal(marbleEl.classList.contains("ready"), false);

  view.syncRadius();
  view.render();
  assert.equal(marbleEl.classList.contains("ready"), true);

  const originalShadowBlur = marbleEl.style.properties["--marble-shadow-blur"];
  view.setWorld({ width: 800, height: 800 });
  view.render();
  assert.notEqual(
    marbleEl.style.properties["--marble-shadow-blur"],
    originalShadowBlur,
  );
}

testMarbleVisibleOnlyAfterValidLayout();

function testGoalProgressUsesRadialFillRadius() {
  const goalEl = new FakeElement();
  const terrainView = createTerrainView({
    obstaclesEl: new FakeElement(),
    goalEl,
    mapState: createMapState(),
    renderObstacleWalls() {},
    renderTerrainPatches() {},
  });

  terrainView.updateGoalProgress(0.5);

  assert.equal(goalEl.classList.contains("active"), true);
  assert.equal(goalEl.style.properties["--goal-fill-radius"], "35.4%");
  assert.equal(goalEl.style.properties["--goal-progress"], undefined);

  terrainView.updateGoalProgress(2);
  assert.equal(goalEl.style.properties["--goal-fill-radius"], "70.8%");

  terrainView.updateGoalProgress(-1);
  assert.equal(goalEl.classList.contains("active"), false);
  assert.equal(goalEl.style.properties["--goal-fill-radius"], "0.0%");
}

testGoalProgressUsesRadialFillRadius();

function testMapThemeRendersRealWorldVisualMarkers() {
  const container = new FakeElement();
  const overlayContainer = new FakeElement();

  withFakeDocument(() => {
    renderMapTheme({
      container,
      overlayContainer,
      mapConfig: { theme: "hockeyRink" },
      world: { width: 4400, height: 4400 },
    });
  });

  assert.equal(
    container.children[0].className.includes("theme-hockeyRink"),
    true,
  );
  assert.equal(
    container.children[0].children.some((child) =>
      child.className.includes("rinkCircle"),
    ),
    true,
    "hockey rink theme should render faceoff circles",
  );
  assert.equal(
    overlayContainer.children[0].children.some((child) =>
      child.className.includes("goalCrease"),
    ),
    true,
    "hockey rink theme should render goal creases",
  );
  assert.equal(
    overlayContainer.children[0].children.some((child) =>
      child.className.includes("hockeyStick"),
    ),
    true,
    "hockey rink theme should render map-specific gear",
  );

  [
    ["livingRoom", "toyBlock"],
    ["parkingLot", "trafficCone"],
    ["sandLot", "sandBucket"],
  ].forEach(([theme, expectedClass]) => {
    const themedContainer = new FakeElement();
    const themedOverlayContainer = new FakeElement();

    withFakeDocument(() => {
      renderMapTheme({
        container: themedContainer,
        overlayContainer: themedOverlayContainer,
        mapConfig: { theme },
        world: { width: 4400, height: 4400 },
      });
    });

    assert.equal(
      themedOverlayContainer.children[0].children.some((child) =>
        child.className.includes(expectedClass),
      ),
      true,
      theme + " should render map-specific object cues",
    );
  });
}

testMapThemeRendersRealWorldVisualMarkers();

function testKitchenThemeRendersQuietCeramicFloor() {
  const container = new FakeElement();
  const overlayContainer = new FakeElement();
  const themeState = {};
  const mapConfig = { theme: "kitchenFloor" };
  const world = { width: 4400, height: 4400 };
  const dynamics = kitchenDynamicsWith();
  dynamics.reset({ mapConfig, world });

  withFakeImage(() => {
    withFakeDocument(() => {
      renderMapTheme({
        container,
        dynamicsState: dynamics.state,
        overlayContainer,
        mapConfig,
        themeState,
        world,
      });
    });
  });

  const underlayChildren = container.children[0].children;
  const overlayChildren = overlayContainer.children[0].children;
  const floor = underlayChildren.find((child) =>
    child.className.includes("kitchenFloorCanvas"),
  );

  assert.equal(floor.style.left, "0px");
  assert.equal(floor.style.top, "0px");
  assert.equal(floor.style.width, "4400px");
  assert.equal(floor.style.height, "4400px");
  assert.equal(
    floor.width,
    1760,
    "static floor should retain its backing resolution",
  );
  assert.equal(floor.height, 1760);
  const tileFills = floor.context.calls.filter(
    (call) =>
      call[0] === "fillRect" &&
      call[3] >= 440 &&
      call[3] <= 660 &&
      call[4] === call[3],
  );
  assert.ok(
    tileFills.length > 0 && tileFills.length <= 200,
    "ceramic tiles should be substantially larger than the former 220px checker",
  );
  assert.equal(
    underlayChildren.some((child) =>
      child.className.includes("kitchenTileAccent"),
    ),
    false,
    "kitchen floor theme should not render brown accent boxes",
  );
  assert.equal(
    dynamics.state.cheerios.length,
    46,
    "kitchen floor theme should seed fistfuls of scattered cereal",
  );
  assert.equal(
    dynamics.state.cheerios.filter((cereal) => cereal.kind === "crumb").length,
    12,
    "kitchen floor theme should mix loose cereal crumbs into the pushable clutter",
  );
  assert.equal(
    overlayChildren.some((child) =>
      child.className.includes("kitchenDynamicCanvas"),
    ),
    true,
    "kitchen floor theme should render ants on one canvas layer",
  );
  const dynamicCanvas = overlayChildren.find((child) =>
    child.className.includes("kitchenDynamicCanvas"),
  );
  assert.equal(
    dynamicCanvas.context.calls.some((call) => call[0] === "drawImage"),
    true,
    "kitchen Cheerios should render from the textured sprite",
  );
  assert.equal(
    dynamics.state.ants.length,
    10,
    "kitchen floor should seed a small capped ant colony",
  );
  assert.equal(
    Array.isArray(dynamics.state.obstacles),
    true,
    "kitchen theme should precompute obstacle candidates",
  );
  assert.equal(
    Array.isArray(dynamics.state.terrainElements),
    true,
    "kitchen theme should precompute terrain candidates",
  );
  assert.equal(
    overlayChildren.some((child) => child.className.includes("themeObject")),
    false,
    "kitchen floor theme should not render decorative blockers",
  );
}

testKitchenThemeRendersQuietCeramicFloor();

function testKitchenFloorIsDeterministicAndDoesNotRedrawWithAnts() {
  const drawFloor = () => {
    const container = new FakeElement();
    const overlayContainer = new FakeElement();
    const themeState = {};
    const dynamics = kitchenDynamicsWith();
    const mapConfig = { theme: "kitchenFloor", elements: [] };
    const world = { width: 4400, height: 4400 };
    dynamics.reset({ mapConfig, world });
    withFakeDocument(() => {
      renderMapTheme({
        container,
        dynamicsState: dynamics.state,
        overlayContainer,
        mapConfig,
        themeState,
        world,
      });
    });
    const floor = container.children[0].children.find(
      (child) => child.className === "kitchenFloorCanvas",
    );
    return { floor, dynamics, mapConfig, themeState };
  };
  const first = drawFloor();
  const second = drawFloor();
  assert.deepEqual(
    first.floor.context.calls,
    second.floor.context.calls,
    "floor wear and tile variation should be reproducible across map loads",
  );

  const callsBeforeUpdate = first.floor.context.calls.length;
  updateAndRenderMapThemeDynamics({
    dynamics: first.dynamics,
    mapConfig: first.mapConfig,
    marble: { x: 2200, y: 2200, vx: 0, vy: 0, r: 29 },
    frameDelta: 1,
    themeState: first.themeState,
  });
  assert.equal(
    first.floor.context.calls.length,
    callsBeforeUpdate,
    "walking ants must not repaint the static floor",
  );
}

testKitchenFloorIsDeterministicAndDoesNotRedrawWithAnts();

function testKitchenDynamicsInitialDrawUsesNextFrame() {
  const container = new FakeElement();
  const overlayContainer = new FakeElement();
  const themeState = {};
  const mapConfig = { theme: "kitchenFloor" };
  const world = { width: 4400, height: 4400 };
  const dynamics = kitchenDynamicsWith();
  dynamics.reset({ mapConfig, world });

  withFakeImage(() => {
    withFakeDocument(() => {
      withFakeAnimationFrame((callbacks) => {
        renderMapTheme({
          container,
          dynamicsState: dynamics.state,
          overlayContainer,
          mapConfig,
          themeState,
          world,
        });

        const dynamicCanvas = overlayContainer.children[0].children.find(
          (child) => child.className === "kitchenDynamicCanvas",
        );
        assert.equal(
          dynamicCanvas.context.calls.some((call) => call[0] === "drawImage"),
          false,
          "kitchen objects should not extend synchronous map construction",
        );
        assert.equal(callbacks.length, 1);
        callbacks[0](0);
        assert.equal(
          dynamicCanvas.context.calls.some((call) => call[0] === "drawImage"),
          true,
          "kitchen objects should draw on the next animation frame",
        );
      });
    });
  });
}

testKitchenDynamicsInitialDrawUsesNextFrame();

function testKitchenCheeriosGiveWayToMarble() {
  const container = new FakeElement();
  const overlayContainer = new FakeElement();
  const themeState = {};
  const mapConfig = { theme: "kitchenFloor" };
  const world = { width: 4400, height: 4400 };
  const dynamics = kitchenDynamicsWith();
  dynamics.reset({ mapConfig, world });

  withFakeDocument(() => {
    renderMapTheme({
      container,
      dynamicsState: dynamics.state,
      overlayContainer,
      mapConfig,
      themeState,
      world,
    });
  });

  const cheerioState = dynamics.state.cheerios[0];
  const antCanvas = themeState.kitchenDynamicCanvas;
  const drawCallsBefore = antCanvas.context.calls.length;
  const marble = {
    x: cheerioState.originX,
    y: cheerioState.originY,
    vx: 18,
    vy: 0,
    r: 29,
  };

  updateAndRenderMapThemeDynamics({
    container,
    overlayContainer,
    dynamics,
    mapConfig,
    marble,
    themeState,
  });

  assert.notEqual(
    cheerioState.pushX,
    0,
    "nearby Cheerios should be shoved aside",
  );
  assert.equal(
    antCanvas.context.calls.length > drawCallsBefore,
    true,
    "Cheerio displacement should redraw the kitchen canvas",
  );
}

testKitchenCheeriosGiveWayToMarble();

function testKitchenCheeriosDoNotSlideUnderFork() {
  const cheerioState = {
    originX: 0,
    originY: 0,
    pushX: 0,
    pushY: 0,
    radius: 23,
    eaten: 0,
    active: true,
    lastHitFeedbackFrame: Number.NEGATIVE_INFINITY,
    revision: 0,
    sweptClosestX: 0,
    sweptClosestY: 0,
    sweptDistance: 0,
  };
  const fork = {
    type: "obstacle",
    fixture: "fork",
    x: 42,
    y: -40,
    w: 120,
    h: 80,
    hitboxW: 120,
    hitboxH: 30,
    angle: -0.42,
  };
  const dynamics = kitchenDynamicsWith({ cheerios: [cheerioState] });
  const mapConfig = {
    theme: "kitchenFloor",
    elements: [fork],
  };

  updateAndRenderMapThemeDynamics({
    dynamics,
    mapConfig,
    marble: {
      x: cheerioState.originX,
      y: cheerioState.originY,
      vx: 100,
      vy: 0,
      r: 29,
    },
    themeState: {},
  });
  for (let frame = 0; frame < 10; frame++) {
    updateAndRenderMapThemeDynamics({
      dynamics,
      mapConfig,
      marble: { x: -500, y: -500, vx: 0, vy: 0, r: 29 },
      themeState: {},
    });
  }

  for (const part of dynamics.state.obstacles) {
    const contact = circleOrientedRectContact(
      {
        x: cheerioState.originX + cheerioState.pushX,
        y: cheerioState.originY + cheerioState.pushY,
        r: cheerioState.radius,
      },
      part,
    );
    assert.equal(
      contact.intersects,
      false,
      "fork metal should block moving Cheerios",
    );
  }
}

testKitchenCheeriosDoNotSlideUnderFork();

function testKitchenAntsMunchCheerios() {
  const cheerioState = {
    originX: 100,
    originY: 100,
    pushX: 0,
    pushY: 0,
    radius: 23,
    eaten: 0,
    active: true,
    sweptClosestX: 0,
    sweptClosestY: 0,
    sweptDistance: 0,
    revision: 0,
  };
  const antCanvas = new FakeCanvasElement();
  const ant = {
    x: 105,
    y: 100,
    angle: 0,
    alive: true,
    squished: false,
    targetIndex: -1,
    wobble: 0,
    revision: 0,
  };
  const dynamics = kitchenDynamicsWith({
    cheerios: [cheerioState],
    ants: [ant],
  });
  const themeState = {
    kitchenDynamicCanvas: antCanvas,
    kitchenDynamicContext: antCanvas.context,
    kitchenDynamicWorld: { width: 200, height: 200 },
    kitchenDynamicRenderScale: 0.35,
    kitchenDynamicNeedsFullRedraw: true,
  };

  updateAndRenderMapThemeDynamics({
    dynamics,
    mapConfig: { theme: "kitchenFloor", elements: [] },
    marble: { x: 300, y: 300, vx: 0, vy: 0, r: 29 },
    frameDelta: 20,
    themeState,
  });

  assert.equal(cheerioState.eaten > 0, true, "ants should munch Cheerios");
  assert.equal(
    antCanvas.context.calls.some((call) => call[0] === "ellipse"),
    true,
    "munching should redraw the Cheerio visual",
  );
}

testKitchenAntsMunchCheerios();

function testKitchenDynamicsUseDirtyRedrawsAfterInitialRender() {
  const container = new FakeElement();
  const overlayContainer = new FakeElement();
  const themeState = {};
  const mapConfig = { theme: "kitchenFloor", elements: [] };
  const world = { width: 4400, height: 4400 };
  const dynamics = kitchenDynamicsWith();
  dynamics.reset({ mapConfig, world });

  withFakeDocument(() => {
    renderMapTheme({
      container,
      dynamicsState: dynamics.state,
      overlayContainer,
      mapConfig,
      themeState,
      world,
    });
  });

  const canvas = themeState.kitchenDynamicCanvas;
  canvas.context.calls.length = 0;

  updateAndRenderMapThemeDynamics({
    dynamics,
    mapConfig,
    marble: { x: 2200, y: 2200, vx: 0, vy: 0, r: 29 },
    frameDelta: 1,
    themeState,
  });

  const clearCalls = canvas.context.calls.filter(
    (call) => call[0] === "clearRect",
  );
  assert.equal(
    clearCalls.some(
      (call) => call[3] < canvas.width && call[4] < canvas.height,
    ),
    true,
    "kitchen dynamics should clear dirty regions instead of the full canvas",
  );
  assert.equal(
    clearCalls.length <= dynamics.state.ants.length,
    true,
    "each moving ant should clear one union of its old and new bounds",
  );
}

testKitchenDynamicsUseDirtyRedrawsAfterInitialRender();

function antRenderingFixture(overrides = {}) {
  const canvas = new FakeCanvasElement();
  canvas.width = 1000;
  canvas.height = 1000;
  const ant = {
    x: 300,
    y: 300,
    angle: 0,
    alive: true,
    squished: false,
    gaitPhase: 0,
    antennaPhase: 0,
    size: 1,
    mode: "forage",
    revision: 0,
    ...overrides,
  };
  const dynamicsState = { ants: [ant], cheerios: [] };
  const themeState = {
    kitchenDynamicCanvas: canvas,
    kitchenDynamicContext: canvas.context,
    kitchenDynamicWorld: { width: 2000, height: 2000 },
    kitchenDynamicRenderScale: 0.5,
    kitchenDynamicNeedsFullRedraw: true,
  };
  const render = () =>
    renderMapThemeDynamics({
      dynamicsState,
      mapConfig: { theme: "kitchenFloor" },
      themeState,
    });
  return { ant, canvas, dynamicsState, render, themeState };
}

function canvasPolylines(calls) {
  const paths = [];
  let path = null;
  for (const call of calls) {
    if (call[0] === "moveTo") {
      path = [call.slice(1)];
      paths.push(path);
    } else if (call[0] === "lineTo" && path) {
      path.push(call.slice(1));
    } else if (call[0] === "beginPath") {
      path = null;
    }
  }
  return paths;
}

function testKitchenAntAnatomyFacesItsHeading() {
  const fixture = antRenderingFixture({ angle: 0.7, size: 1.06 });
  const before = globalThis.structuredClone(fixture.dynamicsState);
  fixture.render();
  const calls = fixture.canvas.context.calls;
  const transform = calls.find((call) => call[0] === "transform");
  assert.deepEqual(transform.slice(1), [
    Math.cos(fixture.ant.angle) * fixture.ant.size,
    Math.sin(fixture.ant.angle) * fixture.ant.size,
    -Math.sin(fixture.ant.angle) * fixture.ant.size,
    Math.cos(fixture.ant.angle) * fixture.ant.size,
    fixture.ant.x,
    fixture.ant.y,
  ]);

  const segments = calls.filter(
    (call) => call[0] === "ellipse" && call[2] === 0,
  );
  assert.equal(
    segments.length,
    3,
    "ants should retain three distinct body segments",
  );
  const [abdomen, thorax, head] = segments;
  assert.equal(abdomen[1] < thorax[1] && thorax[1] < head[1], true);
  assert.equal(
    abdomen[4] > head[4] && head[4] > thorax[4],
    true,
    "the abdomen and head should be separated by a narrow thorax",
  );

  const appendages = canvasPolylines(calls).filter((path) => path.length === 3);
  assert.equal(
    appendages.length,
    8,
    "six legs and two feelers should each have a bend",
  );
  const legs = appendages.filter((path) => Math.abs(path[0][0]) <= thorax[3]);
  assert.equal(
    legs.length,
    6,
    "all six jointed legs should attach at the thorax",
  );
  assert.equal(legs.filter((path) => path[0][1] > 0).length, 3);
  assert.equal(legs.filter((path) => path[0][1] < 0).length, 3);
  assert.deepEqual(
    fixture.dynamicsState,
    before,
    "rendering must not advance ant state",
  );
}

testKitchenAntAnatomyFacesItsHeading();

function testKitchenAntPoseRedrawsWithinItsDirtyBounds() {
  const fixture = antRenderingFixture();
  fixture.render();
  const initialPose = canvasPolylines(fixture.canvas.context.calls);
  fixture.canvas.context.calls.length = 0;
  fixture.render();
  assert.equal(
    fixture.canvas.context.calls.length,
    0,
    "unchanged ants need no canvas work",
  );

  fixture.ant.gaitPhase = Math.PI / 2;
  fixture.ant.antennaPhase = 1.8;
  fixture.ant.revision += 1;
  fixture.render();
  const calls = fixture.canvas.context.calls;
  assert.notDeepEqual(
    canvasPolylines(calls),
    initialPose,
    "simulation phases should articulate legs and feelers",
  );
  const clear = calls.find((call) => call[0] === "clearRect");
  assert.equal(
    clear[3] < 100 && clear[4] < 100,
    true,
    "a stationary pose change should repaint only the ant's small area",
  );
  assert.deepEqual(
    calls.find((call) => call[0] === "rect").slice(1),
    clear.slice(1),
    "the repaint clip must match the cleared pixel bounds so shadows cannot accumulate",
  );
  assert.equal(
    calls.some((call) => call[0] === "clip"),
    true,
  );

  calls.length = 0;
  fixture.ant.angle = Math.PI / 2;
  fixture.render();
  assert.equal(
    calls.some((call) => call[0] === "transform"),
    true,
    "turning in place must invalidate the previous ant silhouette",
  );
}

testKitchenAntPoseRedrawsWithinItsDirtyBounds();

function testKitchenAntRemainsSettleThenStayStill() {
  const fixture = antRenderingFixture();
  fixture.render();
  const liveAbdomen = fixture.canvas.context.calls.find(
    (call) => call[0] === "ellipse" && call[1] < 0 && call[2] === 0,
  );
  fixture.canvas.context.calls.length = 0;
  Object.assign(fixture.ant, {
    alive: false,
    squished: true,
    squishAge: 0,
    squishAngle: 0.6,
    squishStrength: 0.8,
  });
  fixture.render();
  const firstAbdomen = fixture.canvas.context.calls.find(
    (call) => call[0] === "ellipse" && call[1] < 0 && call[2] === 0,
  );
  fixture.canvas.context.calls.length = 0;
  fixture.ant.squishAge = 24;
  fixture.ant.revision += 1;
  fixture.render();
  const calls = fixture.canvas.context.calls;
  const segments = calls.filter(
    (call) => call[0] === "ellipse" && call[2] === 0,
  );
  assert.equal(
    segments.length,
    3,
    "remains should preserve recognizable ant anatomy",
  );
  assert.equal(
    segments[0][4] < firstAbdomen[4] && firstAbdomen[4] < liveAbdomen[4],
    true,
    "the crushed body should visibly compress and settle against the floor",
  );
  assert.equal(
    canvasPolylines(calls).filter((path) => path.length === 3).length,
    8,
    "flattened remains should retain six bent legs and two crumpled feelers",
  );
  const imprint = calls.find((call) => call[0] === "ellipse");
  assert.equal(
    imprint[5],
    fixture.ant.squishAngle - fixture.ant.angle,
    "the contact imprint should follow the marble's travel direction",
  );

  calls.length = 0;
  const before = globalThis.structuredClone(fixture.ant);
  fixture.render();
  assert.equal(
    calls.length,
    0,
    "settled remains should persist without per-frame painting",
  );
  assert.deepEqual(fixture.ant, before);
}

testKitchenAntRemainsSettleThenStayStill();

function testKitchenDynamicsContinueOutsideCameraView() {
  const antCanvas = new FakeCanvasElement();
  const dynamics = kitchenDynamicsWith({
    cheerios: [
      {
        originX: 1010,
        originY: 1000,
        pushX: 0,
        pushY: 0,
        radius: 23,
        eaten: 0,
        active: true,
        sweptClosestX: 0,
        sweptClosestY: 0,
        sweptDistance: 0,
        revision: 0,
      },
    ],
    ants: [
      {
        x: 1000,
        y: 1000,
        angle: 0,
        alive: true,
        squished: false,
        targetIndex: -1,
        wobble: 0,
        revision: 0,
      },
    ],
  });
  const themeState = {
    kitchenDynamicCanvas: antCanvas,
    kitchenDynamicContext: antCanvas.context,
    kitchenDynamicWorld: { width: 2000, height: 2000 },
    kitchenDynamicRenderScale: 0.35,
    kitchenDynamicNeedsFullRedraw: true,
  };

  updateAndRenderMapThemeDynamics({
    dynamics,
    mapConfig: { theme: "kitchenFloor", elements: [] },
    marble: { x: 1000, y: 1000, vx: 3, vy: 0, r: 29 },
    frameDelta: 20,
    themeState,
  });

  assert.equal(
    dynamics.state.ants[0].squished,
    true,
    "camera position must not suppress ant collisions",
  );
  assert.notEqual(
    dynamics.state.cheerios[0].pushX,
    0,
    "camera position must not suppress cereal collisions",
  );
}

testKitchenDynamicsContinueOutsideCameraView();

function testMarbleSquishesKitchenAnts() {
  const antCanvas = new FakeCanvasElement();
  const dynamics = kitchenDynamicsWith({
    ants: [
      {
        x: 100,
        y: 100,
        angle: 0,
        alive: true,
        squished: false,
        targetIndex: -1,
        wobble: 0,
        revision: 0,
      },
    ],
  });
  const themeState = {
    kitchenDynamicCanvas: antCanvas,
    kitchenDynamicContext: antCanvas.context,
    kitchenDynamicWorld: { width: 200, height: 200 },
    kitchenDynamicRenderScale: 0.35,
    kitchenDynamicNeedsFullRedraw: true,
  };
  antCanvas.context.calls.length = 0;

  const events = updateAndRenderMapThemeDynamics({
    dynamics,
    mapConfig: { theme: "kitchenFloor", elements: [] },
    marble: { x: 100, y: 100, vx: 3, vy: 0, r: 29 },
    themeState,
  });

  assert.equal(events.squishedAnts, 1, "marble should squish ants on contact");
  assert.equal(
    dynamics.state.ants[0].squished,
    true,
    "squished ants should stay as splats",
  );
  assert.equal(
    antCanvas.context.calls.some((call) => call[0] === "ellipse"),
    true,
    "squishing an ant should redraw the goo splat immediately",
  );
}

testMarbleSquishesKitchenAnts();

function testMarbleGetsFeedbackOnSquishedKitchenAnts() {
  const antCanvas = new FakeCanvasElement();
  const dynamics = kitchenDynamicsWith({
    frameIndex: 30,
    ants: [
      {
        x: 100,
        y: 100,
        angle: 0,
        alive: false,
        squished: true,
        lastSplatFeedbackFrame: 0,
        targetIndex: -1,
        wobble: 0,
        revision: 0,
      },
    ],
  });
  const themeState = {
    kitchenDynamicCanvas: antCanvas,
    kitchenDynamicContext: antCanvas.context,
    kitchenDynamicWorld: { width: 200, height: 200 },
    kitchenDynamicRenderScale: 0.35,
    kitchenDynamicNeedsFullRedraw: true,
  };

  const events = updateAndRenderMapThemeDynamics({
    dynamics,
    mapConfig: { theme: "kitchenFloor", elements: [] },
    marble: { x: 100, y: 100, vx: 1, vy: 0, r: 29 },
    themeState,
  });

  assert.equal(
    events.splatHits,
    1,
    "rolling over a squished ant should produce splat feedback",
  );
  assert.equal(
    events.squishedAnts,
    0,
    "dead-ant feedback should not count as a fresh squish",
  );
}

testMarbleGetsFeedbackOnSquishedKitchenAnts();

function firstKitchenCheerio({ container, overlayContainer }) {
  const themeState = {};
  const mapConfig = { theme: "kitchenFloor" };
  const world = { width: 4400, height: 4400 };
  const dynamics = kitchenDynamicsWith();
  dynamics.reset({ mapConfig, world });

  withFakeDocument(() => {
    renderMapTheme({
      container,
      dynamicsState: dynamics.state,
      overlayContainer,
      mapConfig,
      themeState,
      world,
    });
  });

  const state = dynamics.state.cheerios[0];

  return { dynamics, state, themeState };
}

function shovedDistance({ state }) {
  return Math.hypot(state.pushX, state.pushY);
}

function testKitchenCheerioShoveRespondsToTerrainPatch() {
  const waterContainer = new FakeElement();
  const waterOverlay = new FakeElement();
  const waterCheerio = firstKitchenCheerio({
    container: waterContainer,
    overlayContainer: waterOverlay,
  });
  const gooContainer = new FakeElement();
  const gooOverlay = new FakeElement();
  const gooCheerio = firstKitchenCheerio({
    container: gooContainer,
    overlayContainer: gooOverlay,
  });
  const origin = {
    x: waterCheerio.state.originX,
    y: waterCheerio.state.originY,
  };
  const patch = {
    x: origin.x - 10,
    y: origin.y - 10,
    w: 20,
    h: 20,
  };
  const marble = { ...origin, vx: 24, vy: 0, r: 29 };
  const distantMarble = { x: 4000, y: 4000, vx: 0, vy: 0, r: 29 };
  const waterMapConfig = {
    theme: "kitchenFloor",
    elements: [{ ...patch, type: "waterPatch" }],
  };
  const gooMapConfig = {
    theme: "kitchenFloor",
    elements: [{ ...patch, type: "gooPatch" }],
  };

  updateAndRenderMapThemeDynamics({
    container: waterContainer,
    dynamics: waterCheerio.dynamics,
    overlayContainer: waterOverlay,
    mapConfig: waterMapConfig,
    marble,
    themeState: waterCheerio.themeState,
  });
  updateAndRenderMapThemeDynamics({
    container: gooContainer,
    dynamics: gooCheerio.dynamics,
    overlayContainer: gooOverlay,
    mapConfig: gooMapConfig,
    marble,
    themeState: gooCheerio.themeState,
  });
  updateAndRenderMapThemeDynamics({
    container: waterContainer,
    dynamics: waterCheerio.dynamics,
    overlayContainer: waterOverlay,
    mapConfig: waterMapConfig,
    marble: distantMarble,
    themeState: waterCheerio.themeState,
  });
  updateAndRenderMapThemeDynamics({
    container: gooContainer,
    dynamics: gooCheerio.dynamics,
    overlayContainer: gooOverlay,
    mapConfig: gooMapConfig,
    marble: distantMarble,
    themeState: gooCheerio.themeState,
  });

  assert.equal(
    shovedDistance(waterCheerio) > shovedDistance(gooCheerio),
    true,
    "Cheerios should shove farther on water than sticky goo",
  );
}

testKitchenCheerioShoveRespondsToTerrainPatch();

function testWaterloggedCheerioVisiblyCloudsThePuddle() {
  const container = new FakeElement();
  const overlayContainer = new FakeElement();
  const { state, themeState } = firstKitchenCheerio({
    container,
    overlayContainer,
  });
  const canvas = themeState.kitchenDynamicCanvas;
  state.waterSoak = 0.75;
  state.waterStainX = state.originX;
  state.waterStainY = state.originY;
  state.revision += 1;
  canvas.context.calls.length = 0;

  renderMapThemeDynamics({
    dynamicsState: { ants: [], cheerios: [state] },
    mapConfig: { theme: "kitchenFloor" },
    themeState,
  });

  assert.equal(
    canvas.context.calls.some(
      (call) =>
        call[0] === "ellipse" &&
        call[1] === state.waterStainX &&
        call[2] === state.waterStainY &&
        call[3] > state.radius * 1.5,
    ),
    true,
    "a soaking Cheerio should draw a visible cereal cloud in the water",
  );
}

testWaterloggedCheerioVisiblyCloudsThePuddle();

function testKitchenCheerioUsesActualPreviousMarblePosition() {
  const container = new FakeElement();
  const overlayContainer = new FakeElement();
  const { dynamics, state, themeState } = firstKitchenCheerio({
    container,
    overlayContainer,
  });
  const previousMarble = {
    x: state.originX - 80,
    y: state.originY,
  };
  const marble = {
    x: state.originX + 80,
    y: state.originY,
    vx: 0,
    vy: 0,
    r: 29,
  };

  updateAndRenderMapThemeDynamics({
    container,
    dynamics,
    overlayContainer,
    mapConfig: { theme: "kitchenFloor" },
    marble,
    previousMarble,
    themeState,
  });

  assert.notEqual(
    state.pushX,
    0,
    "Cheerio sweep should use the real previous marble position, not velocity",
  );
}

testKitchenCheerioUsesActualPreviousMarblePosition();

function testKitchenObstaclesRenderAsFixtures() {
  const container = new FakeElement();

  withFakeDocument(() => {
    renderObstacleWalls(
      container,
      [
        { x: 100, y: 80, w: 620, h: 70 },
        {
          fixture: "fork",
          x: 1920,
          y: 2900,
          w: 880,
          h: 420,
          hitboxW: 760,
          hitboxH: 62,
          angle: -0.42,
        },
        {
          fixture: "sponge",
          x: 520,
          y: 2340,
          w: 600,
          h: 140,
          hitboxW: 520,
          hitboxH: 120,
          angle: 0.16,
          saturation: 0.75,
        },
        {
          fixture: "spoon",
          x: 2480,
          y: 2180,
          w: 720,
          h: 90,
          hitboxW: 620,
          hitboxH: 54,
          angle: 0.34,
        },
        { x: 1040, y: 2760, w: 440, h: 440 },
        { x: 2920, y: 2640, w: 520, h: 520 },
      ],
      { mapConfig: { theme: "kitchenFloor" } },
    );
  });

  const layer = container.children[0];

  assert.equal(
    layer.className.includes("kitchenObstacleLayer"),
    true,
    "kitchen obstacles should render to a fixture layer",
  );
  assert.equal(
    layer.children.some((child) =>
      child.className.includes("kitchenForkSprite"),
    ),
    true,
    "fork collision pieces should render as one dropped silverware sprite",
  );
  const forkSprite = layer.children.find((child) =>
    child.className.includes("kitchenForkSprite"),
  );
  assert.equal(
    forkSprite.style.width,
    "760px",
    "fork sprite should be large enough to read visually",
  );
  assert.equal(
    forkSprite.style.properties["--fixture-angle"],
    "-0.42rad",
    "fork sprite should rotate with the oriented hitbox",
  );
  const spongeSprite = layer.children.find((child) =>
    child.className.includes("kitchenSpongeSprite"),
  );
  assert.equal(
    spongeSprite.style.width,
    "520px",
    "sponge sprite should match its readable blocker scale",
  );
  assert.equal(
    spongeSprite.style.properties["--fixture-angle"],
    "0.16rad",
    "sponge sprite should rotate with the oriented hitbox",
  );
  assert.equal(
    spongeSprite.style.properties["--sponge-brightness"],
    "0.850",
    "a wet sponge should render darker",
  );
  assert.equal(
    spongeSprite.style.properties["--sponge-scale"],
    "1.030",
    "a wet sponge should swell slightly",
  );
  const spoonSprite = layer.children.find((child) =>
    child.className.includes("kitchenSpoonSprite"),
  );
  assert.equal(
    spoonSprite.style.width,
    "620px",
    "spoon sprite should be large enough to read visually",
  );
  assert.equal(
    spoonSprite.style.properties["--fixture-angle"],
    "0.34rad",
    "spoon sprite should rotate with the oriented hitbox",
  );
  assert.equal(
    layer.children.length,
    3,
    "anonymous kitchen obstacles should not render as generic brown blocks",
  );

  const originalLayer = layer;
  const originalSpongeSprite = spongeSprite;
  withFakeDocument(() => {
    renderObstacleWalls(
      container,
      [
        {
          fixture: "fork",
          x: 1920,
          y: 2900,
          w: 880,
          h: 420,
          hitboxW: 760,
          hitboxH: 62,
          angle: -0.42,
        },
        {
          fixture: "sponge",
          x: 560,
          y: 2380,
          w: 600,
          h: 140,
          hitboxW: 520,
          hitboxH: 120,
          angle: 0.2,
          saturation: 1,
        },
        {
          fixture: "spoon",
          x: 2480,
          y: 2180,
          w: 720,
          h: 90,
          hitboxW: 620,
          hitboxH: 54,
          angle: 0.34,
        },
      ],
      { mapConfig: { theme: "kitchenFloor" } },
    );
  });
  assert.equal(container.children[0], originalLayer);
  assert.equal(
    originalLayer.children.find((child) =>
      child.className.includes("kitchenSpongeSprite"),
    ),
    originalSpongeSprite,
    "moving the sponge should update its existing sprite",
  );
  assert.equal(originalSpongeSprite.style.left, "600px");
}

testKitchenObstaclesRenderAsFixtures();

function testForkCollisionPartsPreserveSpritePlacement() {
  withFakeDocument(() => {
    for (const angle of [0, -0.42, 0.52]) {
      // The second kitchen uses hitboxW 720, but the image still displays at 760.
      // Also check contain sizing when height, rather than width, limits scale.
      for (const hitboxW of [720, 760, 1500]) {
        const fork = {
          type: "obstacle",
          fixture: "fork",
          x: 680,
          y: 1520,
          w: 840,
          h: 360,
          hitboxW,
          hitboxH: 60,
          angle,
        };
        const original = new FakeElement();
        const split = new FakeElement();
        const parts = createForkCollisionRects(fork);
        renderObstacleWalls(original, [fork], {
          mapConfig: { theme: "kitchenFloor" },
        });
        renderObstacleWalls(split, parts, {
          mapConfig: { theme: "kitchenFloor" },
        });
        assert.equal(
          split.firstChild.children.length,
          1,
          "collision parts must produce one sprite",
        );
        const oldStyle = original.firstChild.firstChild.style;
        const newStyle = split.firstChild.firstChild.style;
        for (const key of ["left", "top", "width", "height"]) {
          assert.equal(
            newStyle[key],
            oldStyle[key],
            `fork sprite ${key} must not change`,
          );
        }
        assert.equal(
          newStyle.properties["--fixture-angle"],
          oldStyle.properties["--fixture-angle"],
        );
        const debug = new FakeElement();
        renderObstacleHitboxes(debug, parts);
        assert.equal(
          debug.firstChild.context.calls.filter(
            ([name]) => name === "roundRect",
          ).length,
          parts.length,
          "opt-in hitbox overlay must show the actual rounded primitives",
        );
      }
    }
  });
}

testForkCollisionPartsPreserveSpritePlacement();

function testObstacleHitboxesRenderDebugCanvas() {
  const container = new FakeElement();

  withFakeDocument(() => {
    renderObstacleHitboxes(container, [
      {
        x: 100,
        y: 80,
        w: 200,
        h: 80,
        hitboxW: 160,
        hitboxH: 42,
        angle: 0.4,
      },
    ]);
  });

  const canvas = container.children[0];
  assert.equal(
    canvas.classList.contains("hitboxCanvas"),
    true,
    "debug hitboxes should render to their own canvas layer",
  );
  assert.equal(canvas.attributes["data-hitboxes"], "1");
  assert.equal(
    canvas.context.calls.some((call) => call[0] === "lineTo"),
    true,
    "debug hitboxes should draw oriented outlines",
  );
}

testObstacleHitboxesRenderDebugCanvas();

function testTerrainViewRedrawsWhenTerrainIsSet() {
  let hitboxRenderCount = 0;
  let obstacleRenderCount = 0;
  let terrainRenderCount = 0;
  const goal = { x: 100, y: 120, r: 50 };
  const obstacles = [{ x: 10, y: 10, w: 20, h: 20 }];
  const obstacleBounds = {
    left: 10,
    top: 10,
    right: 30,
    bottom: 30,
    width: 20,
    height: 20,
  };
  const terrainByType = {
    roughPatch: {
      bounds: {
        left: 40,
        top: 40,
        right: 60,
        bottom: 60,
        width: 20,
        height: 20,
      },
      elements: [{ x: 40, y: 40, w: 20, h: 20 }],
    },
  };
  const terrainView = createTerrainView({
    terrainContainers: { roughPatch: new FakeElement() },
    obstaclesEl: new FakeElement(),
    hitboxesEl: new FakeElement(),
    hitboxOverlayEnabled: true,
    goalEl: new FakeElement(),
    mapState: createMapState({
      goal,
      terrainByType,
      obstacles,
      obstacleBounds,
    }),
    renderObstacleWalls() {
      obstacleRenderCount++;
    },
    renderObstacleHitboxes() {
      hitboxRenderCount++;
    },
    renderTerrainPatches() {
      terrainRenderCount++;
    },
  });

  terrainView.renderTerrain();
  terrainView.renderTerrain();
  terrainView.renderTerrainType("roughPatch");
  terrainView.renderMovedObstacles();

  assert.equal(obstacleRenderCount, 3);
  assert.equal(hitboxRenderCount, 3);
  assert.equal(terrainRenderCount, 3);
}

testTerrainViewRedrawsWhenTerrainIsSet();

function testTerrainViewAllocatesHitboxesOnlyWhenEnabled() {
  let hitboxRenderCount = 0;
  const hitboxesEl = new FakeElement();
  const terrainView = createTerrainView({
    terrainContainers: {},
    obstaclesEl: new FakeElement(),
    hitboxesEl,
    hitboxOverlayEnabled: false,
    goalEl: new FakeElement(),
    mapState: createMapState({
      obstacles: [{ x: 10, y: 10, w: 20, h: 20 }],
      obstacleBounds: {
        left: 10,
        top: 10,
        right: 30,
        bottom: 30,
        width: 20,
        height: 20,
      },
    }),
    renderObstacleWalls() {},
    renderObstacleHitboxes(container) {
      hitboxRenderCount++;
      container.replaceChildren(new FakeElement());
    },
  });

  terrainView.renderTerrain();
  assert.equal(hitboxRenderCount, 0);
  assert.equal(hitboxesEl.children.length, 0);

  terrainView.setHitboxOverlayEnabled(true);
  assert.equal(hitboxRenderCount, 1);
  assert.equal(hitboxesEl.children.length, 1);
  assert.equal(hitboxesEl.classList.contains("show"), true);

  terrainView.setHitboxOverlayEnabled(false);
  assert.equal(hitboxesEl.children.length, 0);
  assert.equal(hitboxesEl.classList.contains("show"), false);
}

testTerrainViewAllocatesHitboxesOnlyWhenEnabled();

function testTerrainViewUsesUpdatedWorld() {
  const renderedWorlds = [];
  const goal = { x: 100, y: 120, r: 50 };
  const mapState = createMapState({
    goal,
    world: { width: 100, height: 100 },
  });
  const terrainView = createTerrainView({
    mapThemeEl: new FakeElement(),
    mapThemeOverlayEl: new FakeElement(),
    terrainContainers: {},
    obstaclesEl: new FakeElement(),
    goalEl: new FakeElement(),
    mapState,
    renderMapTheme({ world }) {
      renderedWorlds.push(world);
    },
    renderObstacleWalls() {},
  });
  const nextWorld = { width: 220, height: 330 };

  terrainView.renderTerrain();
  mapState.activeMap.world = nextWorld;
  terrainView.renderTerrain();

  assert.deepEqual(renderedWorlds, [{ width: 100, height: 100 }, nextWorld]);
}

testTerrainViewUsesUpdatedWorld();

function testMapRendererUsesUpdatedWorld() {
  const worldEl = new FakeElement();
  const trailEl = new FakeElement();
  const releasedWorlds = [];
  const edgeWorlds = [];
  const mapState = createMapState({ world: { width: 100, height: 120 } });
  const renderer = createMapRenderer({
    worldEl,
    introWallsEl: new FakeElement(),
    mapWallsEl: new FakeElement(),
    trailEl,
    bounds: {},
    intro: {},
    marble: {},
    mapState,
    viewport: { width: () => 50, height: () => 60 },
    terrainView: { renderTerrain() {} },
    renderOuterWalls() {},
    introPenWalls: () => [],
    mapEdgeWalls: (world) => {
      edgeWorlds.push(world);
      return [];
    },
    setReleasedMapBounds: (bounds, world) => {
      releasedWorlds.push(world);
    },
    updateIntroMapBounds() {},
  });
  const nextWorld = { width: 240, height: 360 };

  renderer.setup();
  mapState.activeMap.world = nextWorld;
  renderer.syncWorld();

  assert.equal(worldEl.style.width, "240px");
  assert.equal(worldEl.style.height, "360px");
  assert.equal(trailEl.attributes.viewBox, "0 0 240 360");
  assert.deepEqual(releasedWorlds.at(-1), nextWorld);
  assert.deepEqual(edgeWorlds.at(-1), nextWorld);
}

testMapRendererUsesUpdatedWorld();

const originalDocument = globalThis.document;

globalThis.document = {
  createElement(tagName) {
    return tagName === "canvas" ? new FakeCanvasElement() : new FakeElement();
  },
  createElementNS() {
    return new FakeElement();
  },
};

try {
  const wallsContainer = new FakeElement();
  renderOuterWalls(wallsContainer, [{ x: 0, y: 0, w: 100, h: 10 }]);
  assert.deepEqual(
    wallsContainer.children,
    [],
    "invalid wall frame should clear container",
  );

  renderOuterWalls(wallsContainer, [
    { x: -10, y: -10, w: 120, h: 10 },
    { x: -10, y: 100, w: 120, h: 10 },
    { x: -10, y: 0, w: 10, h: 100 },
    { x: 100, y: 0, w: 10, h: 100 },
  ]);
  const wallFrame = wallsContainer.children[0];
  assert.equal(
    wallFrame.className,
    "wallFrame",
    "wall frame should render as one border element",
  );
  assert.equal(wallFrame.style.properties["--wall-thickness"], "10px");

  const container = new FakeElement();
  const gooPatchContainer = new FakeElement();
  const hazardPatchContainer = new FakeElement();
  const roughPatchContainer = new FakeElement();
  const icePatchContainer = new FakeElement();
  const waterPatchContainer = new FakeElement();

  renderGooPatches(gooPatchContainer, [{ x: 18, y: 28, w: 92, h: 68 }], {
    padding: 24,
  });
  const gooPatchCanvas = gooPatchContainer.children[0];
  assert.equal(
    gooPatchCanvas.classList.contains("gooPatchCanvas"),
    true,
    "goo patches should render to canvas",
  );
  assert.equal(gooPatchCanvas.attributes["data-goo-patches"], "1");
  assert.equal(gooPatchCanvas.style.left, "-6px");
  assert.equal(gooPatchCanvas.style.top, "4px");
  assert.equal(gooPatchCanvas.style.width, "140px");
  assert.equal(gooPatchCanvas.style.height, "116px");
  assert.equal(
    gooPatchCanvas.context.calls.some((call) => call[0] === "closePath"),
    true,
    "small goo drops should have a closed wet contour",
  );
  assert.equal(
    gooPatchCanvas.context.calls.some(
      (call) =>
        call[0] === "addColorStop" && call[2] === "rgba(125,163,57,.88)",
    ),
    true,
    "goo should have a dense pooled body",
  );

  renderHazardPatches(hazardPatchContainer, [{ x: 30, y: 40, w: 100, h: 70 }], {
    padding: 18,
  });
  const hazardPatchCanvas = hazardPatchContainer.children[0];
  assert.equal(
    hazardPatchCanvas.classList.contains("hazardPatchCanvas"),
    true,
    "hazard patches should render to canvas",
  );
  assert.equal(hazardPatchCanvas.attributes["data-hazard-patches"], "1");
  assert.equal(
    hazardPatchCanvas.context.calls.some((call) => call[0] === "lineTo"),
    true,
    "hazard patch canvas should draw stripes",
  );

  renderIcePatches(icePatchContainer, [{ x: 25, y: 35, w: 90, h: 70 }], {
    padding: 18,
  });
  const icePatchCanvas = icePatchContainer.children[0];
  assert.equal(
    icePatchCanvas.classList.contains("icePatchCanvas"),
    true,
    "ice patches should render to canvas",
  );
  assert.equal(icePatchCanvas.attributes["data-ice-patches"], "1");
  assert.equal(
    icePatchCanvas.context.calls.some((call) => call[0] === "lineTo"),
    true,
    "ice patch canvas should draw cracks",
  );
  assert.equal(
    icePatchCanvas.context.calls.some((call) => call[0] === "ellipse"),
    true,
    "ice patch canvas should draw cloudy frost",
  );

  renderRoughPatches(roughPatchContainer, [{ x: 20, y: 30, w: 80, h: 60 }], {
    padding: 18,
  });
  const roughPatchCanvas = roughPatchContainer.children[0];
  assert.equal(
    roughPatchCanvas.classList.contains("roughPatchCanvas"),
    true,
    "rough patches should render to canvas",
  );
  assert.equal(roughPatchCanvas.attributes["data-rough-patches"], "1");
  assert.equal(roughPatchCanvas.style.left, "2px");
  assert.equal(roughPatchCanvas.style.top, "12px");
  assert.equal(roughPatchCanvas.style.width, "116px");
  assert.equal(roughPatchCanvas.style.height, "96px");
  assert.equal(
    roughPatchCanvas.context.calls.some((call) => call[0] === "fillRect"),
    true,
    "rough patch canvas should draw grit",
  );
  assert.equal(
    roughPatchCanvas.context.calls.filter((call) => call[0] === "fillRect")
      .length >= 40,
    true,
    "rough patch canvas should draw layered grit",
  );

  renderWaterPatches(waterPatchContainer, [{ x: 24, y: 34, w: 96, h: 72 }], {
    padding: 24,
  });
  const waterPatchCanvas = waterPatchContainer.children[0];
  assert.equal(
    waterPatchCanvas.classList.contains("waterPatchCanvas"),
    true,
    "water patches should render to canvas",
  );
  assert.equal(waterPatchCanvas.attributes["data-water-patches"], "1");
  assert.equal(waterPatchCanvas.style.left, "0px");
  assert.equal(waterPatchCanvas.style.top, "10px");
  assert.equal(waterPatchCanvas.style.width, "144px");
  assert.equal(waterPatchCanvas.style.height, "120px");
  assert.equal(
    waterPatchCanvas.context.calls.some((call) => call[0] === "stroke"),
    true,
    "small water drops should retain a reflected edge glint",
  );
  assert.equal(
    waterPatchCanvas.context.calls.some((call) => call[0] === "lineTo"),
    true,
    "water patch canvas should draw an irregular puddle edge",
  );
  renderWaterPatches(waterPatchContainer, [{ x: 30, y: 40, w: 84, h: 60 }], {
    bounds: { left: 24, top: 34, width: 96, height: 72 },
    padding: 24,
  });
  assert.equal(
    waterPatchContainer.children[0],
    waterPatchCanvas,
    "puddle changes should reuse the existing terrain canvas",
  );
  assert.equal(
    waterPatchCanvas.context.calls.some(
      (call) =>
        call[0] === "clearRect" &&
        call[3] === waterPatchCanvas.width &&
        call[4] === waterPatchCanvas.height,
    ),
    true,
  );

  renderObstacleWalls(
    container,
    [
      { x: 0, y: 0, w: 10, h: 20 },
      { x: 10, y: 0, w: 10, h: 10 },
    ],
    { padding: 32 },
  );

  const canvas = container.children[0];

  assert.equal(
    canvas.classList.contains("obstacleCanvas"),
    true,
    "obstacle walls should render to canvas",
  );
  assert.equal(canvas.style.left, "-32px");
  assert.equal(canvas.style.top, "-32px");
  assert.equal(canvas.style.width, "84px");
  assert.equal(canvas.style.height, "84px");
  assert.equal(canvas.attributes["data-wall-groups"], "1");
  assert.equal(
    canvas.context.calls.some((call) => call[0] === "fill"),
    true,
    "obstacle canvas should draw fills",
  );
  assert.equal(
    canvas.context.calls.some((call) => call[0] === "stroke"),
    true,
    "obstacle canvas should draw outline",
  );
} finally {
  if (originalDocument === undefined) {
    delete globalThis.document;
  } else {
    globalThis.document = originalDocument;
  }
}

function testMarbleViewRendersWithTransform() {
  const marbleEl = new FakeElement("marble");
  const marble = {
    x: 120,
    y: 80,
    vx: 2,
    vy: -1,
    r: 0,
    roll: 0.4,
    impactSquash: 0.5,
  };
  const view = createMarbleView({
    marbleEl,
    marble,
    world: { width: 400, height: 300 },
    mapConfig: {
      light: {
        x: 0,
        y: 0,
        shadowMinDistance: 5,
        shadowMaxDistance: 10,
        shadowMinBlur: 6,
        shadowMaxBlur: 12,
        contactShadowY: 3,
        contactShadowBlur: 5,
      },
    },
    visualConfig: {
      marble: {
        glintCenter: 20,
        glintLightOffset: 5,
        glintVelocityScale: 0.1,
        glintVelocityLimit: 4,
        impactScaleX: 0.18,
        impactScaleY: 0.12,
      },
    },
    clamp(value, min, max) {
      return Math.min(Math.max(value, min), max);
    },
  });

  view.syncRadius();
  view.render();

  assert.equal(marble.r, 29);
  assert.equal(
    marbleEl.style.transform,
    "translate(120px, 80px) translate(-50%, -50%) scale(1.090, 0.940)",
  );
  assert.equal(marbleEl.style.left, undefined);
  assert.equal(marbleEl.style.properties["--marble-contact-shadow-y"], "3.0px");
}

testMarbleViewRendersWithTransform();

console.log("Rendering tests passed.");
