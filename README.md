# Marble Game

A browser marble game controlled by tilting your phone.

Live version: [https://patrickjohnson3.github.io/marble-game/](https://patrickjohnson3.github.io/marble-game/)

## Features

- Phone tilt controls with desktop keyboard fallback.
- Fullscreen mobile play with wake-lock support.
- Large scrollable maps with real-world themes and obstacle layouts.
- Terrain surfaces including ice, rough ground, water, and sticky goo.
- Kitchen-floor objects including a fork obstacle and pushable Cheerios.
- Map-specific objectives: eliminate kitchen ants, cross the living room to its
  exit, or hold in the older maps' goal zones.
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
- If motion is denied or unavailable, Settings explains how to restore access
  and offers **Reload to retry motion**. Reloading starts a fresh run.
- Settings: use the gear button. Switching apps or hiding the page pauses play
  in Settings; press Resume when ready, or Set neutral first if your grip changed.
  The encounter stays in memory; a browser-discarded page starts fresh.
- Camera: pinch to zoom and drag with two fingers to pan.
- Objective: follow the top-left status. Kill all kitchen ants, then choose
  **Next room** when ready. The cleared kitchen stays playable until you leave.
  Defeat the living room mouse and reach its doorway; hold inside the green
  circle on older maps.
- The **Mouse** arrow automatically points from your marble toward a distant
  mouse. It disappears when you get close or defeat it. Optional **exit / goal
  arrow** guidance is available in Settings.
- The main kitchen cockroach occasionally charges and shoves the marble. It is
  invulnerable: roll into it fast to knock it away and buy a quiet interval. Goo
  slows its steps, so circling a spill can help you escape. Only ants count toward
  kitchen completion.
- Retry map in Settings restores the current map and its objects to their
  starting state, while keeping your control settings and neutral position.

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
- [Map authoring, validation, and real-game screenshots](docs/map-authoring.md)
- [Focused improvement pass and remaining playtests](docs/improvement-pass.md)
- [Ants and liquids: behavior, measurements, and phone playtests](docs/ants-and-liquids.md)

## Runtime Cache

`runtime-assets.js` is the source of truth for browser modules and precached
assets. Update it when adding or removing a runtime file. After changing
`index.html` or a listed runtime asset, run:

```sh
npm run sync-cache
```

This synchronizes the generated asset version and module cache manifest in
`index.html` with the service-worker cache version and versioned runtime-asset
import in `sw.js`.

Downloaded updates wait until all game tabs/windows close. Finish your current
game, close them, and reopen to apply the update; an update never forces an
active encounter to restart. Settings reports when an update is ready.
