# Marble Game

A browser marble game controlled by tilting your phone.

Live version: [https://patrickjohnson3.github.io/marble-game/](https://patrickjohnson3.github.io/marble-game/)

## Features

- Phone tilt controls with desktop keyboard fallback.
- Fullscreen mobile play with wake-lock support.
- Large scrollable maps with real-world themes and obstacle layouts.
- Terrain surfaces including ice, rough ground, water, and sticky goo.
- Kitchen-floor objects including a fork obstacle and pushable Cheerios.
- Goal zones that advance to the next map after a hold timer.
- Haptic feedback for impacts, terrain, and goals where supported.
- Settings modal for calibration, fullscreen, haptics, FPS, and stats.

## Local Setup

```sh
npm install
npm run install-hooks
```

## Run Locally

```sh
python3 -m http.server 8000
```

Then open `http://localhost:8000/`.

## Controls

- Phone: tap start, hold the phone normally, then tilt.
- Desktop fallback: use arrow keys or WASD.
- Settings: use the gear button.

## Mobile Browser Targets

The supported mobile targets are Android Chrome, Android Brave, iPhone Safari,
and iPhone Chrome. Motion sensors and installed-app behavior require manual
testing from the HTTPS deployment; the desktop browser smoke test does not
cover these platform APIs.

## Checks

```sh
npm test
npm run test:browser
npm run lint
npm run format:check
```

The pre-push hook runs the same test, lint, and format checks.
The browser smoke test uses local Chrome; set `CHROME_PATH` if Chrome is installed elsewhere.

## Developer Docs

- [Architecture](docs/architecture.md)

## Runtime Cache

`runtime-assets.js` is the source of truth for browser modules and precached
assets. Update it when adding or removing a runtime file. After changing
`index.html` or a listed runtime asset, run:

```sh
npm run sync-cache
```

This synchronizes the generated asset version and module cache manifest in
`index.html` with the service-worker cache version in `sw.js`.
