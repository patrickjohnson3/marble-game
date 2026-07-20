# Marble Game

A browser marble game controlled by tilting your phone.

Live version: [https://patrickjohnson3.github.io/marble-game/](https://patrickjohnson3.github.io/marble-game/)

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

## Checks

```sh
npm test
npm run lint
npm run format:check
```

The pre-push hook runs the same test, lint, and format checks.

## Runtime Cache

Runtime files are listed in `runtime-assets.js`. After changing runtime JavaScript, CSS, or HTML, run:

```sh
npm run sync-cache
```

This updates the `index.html` asset version and keeps the import-map cache manifest synchronized.
