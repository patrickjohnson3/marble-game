# Repository Guidelines

## Project Structure & Module Organization

This is a vanilla JavaScript browser game with a small custom 2D engine. Entry points live at `index.html`, `boot.js`, and `app.js`. Core game systems are in `core/`: physics, camera, game loop, map runtime, haptics, and startup flow. Input adapters are in `input/`; platform/PWA helpers are in `platform/`; settings UI and persistence are in `settings/`. Rendering code is split by concern in `rendering/`, including terrain patches, map themes, effects, marble view, and UI. Map definitions live in `maps/map-data.js`. Static art and PWA assets are in `assets/`. Tests are in `tests/`, with shared fakes in `tests/test-dom.js`.

## Build, Test, and Development Commands

- `npm test`: runs the full Node-based test suite through `test-all.js`.
- `npm run lint`: runs ESLint across the repo.
- `npm run format:check`: verifies Prettier formatting.
- `npm run format`: applies Prettier formatting.
- `npm run sync-cache`: synchronizes generated cache versions and the import-map module list.
- `python3 -m http.server`: serves desktop and same-device localhost testing. Verify motion sensors and PWA behavior from an HTTPS deployment or secure local endpoint; phone access over LAN HTTP is insufficient.

`runtime-assets.js` is the source of truth for browser modules and precached assets. Update it when adding or removing a runtime file. After changing `index.html` or a listed runtime asset, run `npm run sync-cache` before final tests. Do not hand-edit the generated `assetVersion` or `runtimeModuleScripts` values in `index.html`, or `cacheVersion` in `sw.js`.

## Architecture Boundaries

Keep `app.js` as the composition root and gameplay rules in `core/`. Keep browser APIs in `platform/` or input controllers, and keep `rendering/` limited to visual output and disposable caches. Follow `docs/state-ownership.md`; controllers and renderers must not duplicate gameplay state owned by `state`, `mapRuntime.state`, or `settings`.

## Coding Style & Naming Conventions

Use ES modules and keep code plain JavaScript. Follow Prettier defaults from `.prettierrc`; do not hand-format around it. Prefer small pure helpers for geometry, physics, map validation, and settings migration. Use descriptive camelCase names for functions and state fields. Keep gameplay tuning values named in `core/game-config.js` rather than scattering magic numbers.

## Testing Guidelines

Tests use Node’s built-in `assert` and are executed by `npm test`. Add tests near the system being changed, using existing patterns such as `physics-test.js`, `rendering-test.js`, `map-runtime-test.js`, and `settings-store-test.js`. Prefer deterministic pure-function tests. For rendering changes, assert drawing behavior through the fake canvas call log rather than pixel snapshots.

## Commit & Pull Request Guidelines

Commit messages are short imperative summaries, for example `Improve kitchen water spill` or `Add project TODO`. Keep commits focused: one behavior, refactor, or visual change per commit. Before pushing, run `npm run format:check`, `npm run lint`, and `npm test`. Pull requests should describe gameplay/user-visible impact, list verification commands, and include screenshots or mobile notes for visual changes.

## Agent-Specific Notes

This is mobile-first. Be careful with motion sensors, haptics, fullscreen, wake lock, and PWA caching. Avoid adding engine abstractions unless they clearly simplify current gameplay work. Favor readable real-world map content over generic systems.
