import assert from "node:assert/strict";
import { domIds } from "./dom-ids.js";

class FakeClassList {
  constructor() {
    this.classes = new Set();
  }

  add(...classes) {
    classes.forEach((className) => this.classes.add(className));
  }

  contains(className) {
    return this.classes.has(className);
  }

  remove(...classes) {
    classes.forEach((className) => this.classes.delete(className));
  }

  toggle(className, force) {
    const enabled = force === undefined ? !this.classes.has(className) : force;
    if (enabled) this.classes.add(className);
    else this.classes.delete(className);
    return enabled;
  }
}

class FakeStyle {
  constructor() {
    this.properties = {};
  }

  setProperty(name, value) {
    this.properties[name] = value;
  }
}

class FakeElement {
  constructor(id = "") {
    this.id = id;
    this.children = [];
    this.childNodes = this.children;
    this.classList = new FakeClassList();
    this.listeners = [];
    this.style = new FakeStyle();
    this.attributes = {};
    this.offsetHeight = id === "marble" ? 58 : 0;
    this.offsetWidth = id === "marble" ? 58 : 0;
    this.textContent = "";
  }

  addEventListener(type, listener, options) {
    this.listeners.push({ type, listener, options });
  }

  appendChild(child) {
    this.children.push(child);
    this.childNodes = this.children;
    return child;
  }

  replaceChildren(...children) {
    this.children = children;
    this.childNodes = this.children;
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }
}

function createDocument() {
  const elements = Object.fromEntries(
    Object.values(domIds).map((id) => [id, new FakeElement(id)])
  );
  const labelSpans = new Map(
    [
      "speedSetting",
      "sensitivitySetting",
      "rotationSetting",
      "hapticsSetting",
      "trailSetting",
      "fullscreenSetting"
    ].map((id) => [id, new FakeElement()])
  );

  return {
    body: new FakeElement("body"),
    documentElement: new FakeElement("html"),
    title: "",
    visibilityState: "visible",
    addEventListener() {},
    createElement() {
      return new FakeElement();
    },
    getElementById(id) {
      return elements[id] || null;
    },
    querySelector(selector) {
      const match = selector.match(/^label\[for="([^"]+)"\] span$/);
      return match ? labelSpans.get(match[1]) || null : null;
    }
  };
}

const originalGlobals = {
  addEventListener: globalThis.addEventListener,
  document: globalThis.document,
  innerHeight: globalThis.innerHeight,
  innerWidth: globalThis.innerWidth,
  localStorage: globalThis.localStorage,
  navigator: globalThis.navigator,
  requestAnimationFrame: globalThis.requestAnimationFrame,
  screen: globalThis.screen,
  window: globalThis.window
};

const document = createDocument();
globalThis.addEventListener = () => {};
globalThis.document = document;
globalThis.innerHeight = 844;
globalThis.innerWidth = 390;
globalThis.localStorage = {
  getItem() {
    return null;
  },
  setItem() {}
};
globalThis.navigator = {};
globalThis.requestAnimationFrame = () => 1;
globalThis.screen = { orientation: { angle: 0 } };
globalThis.window = globalThis;

try {
  await import("./app.js?boot=" + Date.now());
  assert.equal(globalThis.__marbleAppBooted, true);
  assert.equal(document.getElementById("settingsTitle").textContent, "Settings");
  assert.equal(document.getElementById("resumeGame").textContent, "resume");
} finally {
  for (const [key, value] of Object.entries(originalGlobals)) {
    if (value === undefined) {
      delete globalThis[key];
    } else {
      globalThis[key] = value;
    }
  }
}

console.log("App boot tests passed.");
