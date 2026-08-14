# Repository Guidelines

## Project Structure & Module Organization

This is a static vanilla JavaScript game with no runtime build step. `index.html` loads `boot.js`, then `app.js` composes the application. Game systems live in `core/`; browser integration in `input/` and `platform/`; preferences in `settings/`; and visual output in `rendering/`. Maps live in `maps/map-data.js`, assets in `assets/`, and tests in `tests/`.

## Build, Test, and Development Commands

- `npm install`: installs the pinned development tools.
- `npm run install-hooks`: enables the tracked pre-push gate.
- `npm test`: runs the full Node-based test suite through `test-all.js`.
- `npm run test:browser`: runs startup and input smoke tests in local Chrome.
- `npm run lint`: runs ESLint across the repo.
- `npm run format:check`: verifies Prettier formatting.
- `npm run format`: applies Prettier formatting.
- `npm run sync-cache`: synchronizes generated cache versions and the import-map module list.
- `python3 -m http.server`: serves desktop and same-device localhost testing. Verify motion sensors and PWA behavior from an HTTPS deployment or secure local endpoint; phone access over LAN HTTP is insufficient.

`runtime-assets.js` is the source of truth for browser modules and precached assets. Update it when adding or removing a runtime file. After changing `index.html` or a listed runtime asset, run `npm run sync-cache` before final tests. Do not hand-edit the generated `assetVersion` or `runtimeModuleScripts` values in `index.html`, or `cacheVersion` in `sw.js`.

## Architecture Boundaries

Keep gameplay rules in `core/`, browser APIs in `platform/` or input controllers, and `rendering/` limited to output and disposable caches. Follow `docs/state-ownership.md`; controllers and renderers must not duplicate state owned by `state`, `mapRuntime.state`, or `settings`.

## Coding Style & Naming Conventions

Use plain JavaScript ES modules and let Prettier plus `.editorconfig` control formatting. Keep gameplay tuning in `core/game-config.js`. Extract helpers when they isolate reusable or independently testable logic; avoid one-use wrappers.

## Testing Guidelines

`npm test` runs Node `assert` tests and cache validation. Add focused tests beside the affected system. Rendering tests inspect the fake canvas call log rather than pixel snapshots.

## Commit & Pull Request Guidelines

Use short imperative commit summaries and keep each commit to one behavior, refactor, or visual change. Before pushing, run `npm run format:check`, `npm run lint`, and `npm test`. Visual pull requests require screenshots or mobile verification notes.

## Agent-Specific Notes

Changes to motion sensors, haptics, fullscreen, wake lock, or PWA behavior must preserve desktop keyboard fallback, add focused tests, and receive HTTPS mobile verification when platform behavior changes. Add engine abstractions only when they remove current complexity.
