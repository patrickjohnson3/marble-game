# Repository Guidelines

## Project Structure & Module Organization

This is a static vanilla JavaScript game with no runtime build step. `index.html` loads `boot.js`, then `app.js` composes the application. Game systems live in `core/`; browser integration in `input/` and `platform/`; preferences in `settings/`; and visual output in `rendering/`. Map definitions live under `maps/`; `maps/map-data.js` assembles the catalog and contains legacy layouts. Follow [docs/map-authoring.md](docs/map-authoring.md) for map composition, validation, and visual inspection. Assets live in `assets/`, and tests in `tests/`.

## Build, Test, and Development Commands

- `npm install`: installs the pinned development tools.
- `npm run install-hooks`: enables the tracked pre-push gate.
- `npm test`: runs the full Node-based test suite through `test-all.js`.
- `npm run test:browser`: runs startup and input/UI checks plus service-worker offline and upgrade regression tests in local Chrome. Requires an existing Chrome or Chromium installation; set `CHROME_PATH` if needed.
- `npm run lint`: runs ESLint across the repo.
- `npm run format:check`: verifies Prettier formatting.
- `npm run format`: applies Prettier formatting.
- `npm run sync-cache`: synchronizes generated cache versions and the import-map module list.
- `python3 -m http.server 8000 --bind 127.0.0.1`: serves desktop and same-device localhost testing. Verify motion sensors and PWA behavior from an HTTPS deployment or secure local endpoint; phone access over LAN HTTP is insufficient.

`runtime-assets.js` is the source of truth for browser modules and precached assets. Update it when adding or removing a runtime file. After changing `index.html` or a listed runtime asset, run `npm run sync-cache` before final tests. Do not hand-edit the generated `assetVersion` or `runtimeModuleScripts` values in `index.html`, or `cacheVersion` in `sw.js`.

## Architecture Boundaries

Keep gameplay rules in `core/`, platform capability integration (permissions, sensors, fullscreen, wake lock, and service workers) in `platform/` or input controllers, and `rendering/` limited to output and disposable caches. Existing DOM lookup and injected frame scheduling helpers may remain in `core/`. Follow `docs/state-ownership.md`; controllers and renderers must not duplicate state owned by `state`, `mapRuntime.state`, or `settings`.

## Coding Style & Naming Conventions

Use plain JavaScript ES modules and let Prettier plus `.editorconfig` control formatting. Keep shared gameplay tuning in `core/game-config.js`; local implementation constants may stay beside the behavior they govern. Extract helpers when they isolate reusable or independently testable logic; avoid one-use wrappers.

## Testing Guidelines

`npm test` runs Node `assert` tests and cache validation. Place focused tests in `tests/`; extend existing suites when practical, and register each new standalone Node suite in `test-all.js`. Rendering tests inspect the fake canvas call log rather than pixel snapshots.

## Commit & Pull Request Guidelines

Use short imperative commit summaries and keep each commit to one behavior, refactor, or visual change. Before pushing, run `npm run format:check`, `npm run lint`, and `npm test`. For changes to startup, browser input/UI, or PWA behavior, also run `npm run test:browser`; the pre-push hook does not run it. Visual pull requests require screenshots or mobile verification notes.

## Agent-Specific Notes

Changes to motion sensors, haptics, fullscreen, wake lock, or PWA behavior must preserve desktop keyboard fallback and add focused tests. Verify affected platform behavior over HTTPS in Android Chrome, Android Brave, iPhone Safari, and iPhone Chrome. Report actual device/browser coverage and explicitly identify checks blocked by unavailable hardware; desktop emulation does not establish physical-device behavior. Add engine abstractions only when they remove current complexity.
