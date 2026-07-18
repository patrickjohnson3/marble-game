export function obstacle(overrides = {}) {
  return {
    type: "obstacle",
    x: 10,
    y: 10,
    w: 10,
    h: 10,
    ...overrides,
  };
}

export function roughPatch(overrides = {}) {
  return {
    type: "roughPatch",
    x: 10,
    y: 10,
    w: 20,
    h: 20,
    ...overrides,
  };
}

export function goal(overrides = {}) {
  return {
    x: 80,
    y: 80,
    r: 10,
    holdMs: 5000,
    ...overrides,
  };
}

export function spawn(overrides = {}) {
  return {
    x: 20,
    y: 20,
    r: 5,
    ...overrides,
  };
}

export function mapConfig(overrides = {}) {
  return {
    world: { width: 100, height: 100 },
    elements: [],
    spawn: spawn(),
    goal: goal(),
    ...overrides,
  };
}
