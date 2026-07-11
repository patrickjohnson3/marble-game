import { domIds } from "../core/dom-ids.js";

export class FakeClassList {
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

export class FakeStyle {
  constructor() {
    this.properties = {};
  }

  setProperty(name, value) {
    this.properties[name] = value;
  }
}

export class FakeElement {
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

  append(...children) {
    this.children.push(...children);
    this.childNodes = this.children;
  }

  replaceChildren(...children) {
    this.children = children;
    this.childNodes = this.children;
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }

  querySelector() {
    return null;
  }
}

class FakeSelectElement extends FakeElement {
  constructor(id, optionValues) {
    super(id);
    this.options = Object.fromEntries(
      optionValues.map((value) => [value, new FakeElement()])
    );
  }

  querySelector(selector) {
    const match = selector.match(/^option\[value="([^"]+)"\]$/);
    return match ? this.options[match[1]] || null : null;
  }
}

export function createFakeDocument() {
  const elements = Object.fromEntries(
    Object.values(domIds).map((id) => [id, new FakeElement(id)])
  );
  elements.cameraModeSetting = new FakeSelectElement("cameraModeSetting", [
    "follow",
    "lockedCenter",
    "predictiveLookAhead"
  ]);
  const labelSpans = new Map(
    [
      "speedSetting",
      "sensitivitySetting",
      "rotationSetting",
      "hapticsSetting",
      "trailSetting",
      "fullscreenSetting",
      "fpsSetting",
      "cameraModeSetting"
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
    createElementNS() {
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
