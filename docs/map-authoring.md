# Authoring maps with Codex

Edit the room definition, validate it, inspect real-game screenshots, then drive
the marble. No editor or runtime build step is needed.

## Definitions and ownership

- `maps/kitchen-floor.js` and `maps/kitchen-breakfast.js`: ceramic kitchens,
  utensil/spill placement, food clusters, ants, and elimination objectives.
- `maps/living-room.js`: furniture, shag, dressing, a named exit, inspection
  views, and a declared traversal corridor. Use this as the primary reach example.
- `maps/map-authoring.js`: the supported vocabulary and small load-time expansion.
- `maps/kitchen-layout.js`: existing reusable food/scenery recipes. Change a
  recipe only when every map using it should change.
- `maps/map-data.js`: register a definition in `mapDefinitions` and place
  `expandMap(definition)` in `authoredMapVariants` at its progression position.
  Older maps retain their direct element arrays and held goals.

Map coordinates are world pixels: the current rooms are 4400 × 4400 and the
marble radius is 29. Rectangle `x,y` is its unrotated top-left; `w,h` are its
dimensions; `angle` is radians about its center. Spawn and views use centers.
Named regions are axis-aligned rectangles, never legacy circles.

Expansion produces existing `elements`, kitchen clusters, and flat scenery.
Map activation copies this content into `mapRuntime.state.activeMap`; Retry
recreates it. Ants/cereal remain owned by `kitchenDynamics.state`. Renderers never
advance objectives or actors. Authoring data is not rebuilt per frame.

## Concrete vocabulary

Run `npm run map:validate -- --list` for available ids and kinds.

| Field       | Supported content                                                                                     | Gameplay effect                                                                 |
| ----------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `objective` | `eliminate` ant/all; `reach` named region                                                             | Completion and HUD                                                              |
| `regions`   | `{id, label?, x, y, w, h}`                                                                            | Reach destination when referenced                                               |
| `surfaces`  | `water`, `goo`, `rough`, `shag`, `ice`, `hazard`                                                      | Existing terrain effects                                                        |
| `fixtures`  | Kitchen: `fork`, `spoon`, `sponge`; living room: `sofa`, `coffeeTable`, `bookcase`, `toyBlock`        | Solid collision; sponge retains its interaction                                 |
| `obstacles` | Plain/rotated rectangles, optional `cornerRadius`                                                     | Solid walls, currently supported by living-room rendering                       |
| `clusters`  | Kitchen: `cerealPacket`, `breakfastNapkin`, `cleanupScraps`, `drinkSpill`; living room: `readingPile` | Kitchen recipes include live ants and pushable cereal; reading pile is cosmetic |
| `scenery`   | Living room: `sock`, `magazine`                                                                       | Flat cosmetic dressing, no collision                                            |
| `views`     | `{id, x, y, scale?}`                                                                                  | Screenshot targets only                                                         |
| `route`     | Array of `{x, y}` waypoints                                                                           | Development clearance check only                                                |

Supported authored themes are `kitchenFloor` and `livingRoom`. A theme must
render its vocabulary: do not place a sofa in a kitchen or assume that naming
a new fixture supplies its art. Flat magazines and flattened socks are visibly
thin; blocks and furniture are solid. The coffee table is a low chest with a
solid footprint, not a table whose open underside the marble should traverse.

Kitchen clusters take world-coordinate centers and radians. Expansion adapts
them to the kitchen's existing normalized layout and 4400-unit recipes. A
cluster places related food, ants, and cosmetic litter together; it does not
automatically create a liquid surface. Author gameplay spills in `surfaces`.
The existing liquid renderer and terrain queries share their irregular shape.
The current recipes were designed at 4400 units; inspect scale and boundary
clearance if changing room dimensions.

Living-room fixture dimensions and rotation feed both rendering and collision.
`cornerRadius` is shared too. Do not use smaller hidden hitboxes for these
fixtures. Kitchen image fixtures retain their existing fitted geometry and
transparent sprite margins, including the fork's composite collision parts.
The existing moving/absorbing sponge belongs to `kitchen-floor` and targets its
first water patch; the breakfast kitchen's sponge remains a static fixture.
That specialized behavior stays in `core/kitchen-dynamics.js`.

Shag expands to `roughPatch` with `material: "shag"`: static pile art, existing
rough-terrain movement. It uses `roughPatchDragRetention` in
`core/game-config.js`; this pass does not retune that constant or the integrator.

## Objectives

The kitchens declare:

```js
objective: { type: "eliminate", target: "ant", count: "all" }
```

The controller counts authoritative ants with `alive === true`. One survivor
blocks completion; crushing the last ant completes once after kitchen contacts
finish. Crumbs, cereal, scenery, and crushed remains never count as targets.
The HUD shows `Kill all ants · N left`. Maps with no authored ants are invalid.

The living room declares:

```js
objective: { type: "reach", region: "exit-door" },
regions: [
  { id: "exit-door", label: "Next room", x: 3500, y: 0, w: 340, h: 480 },
],
```

The entire marble must enter the rectangle. The doorway marker uses the same
region, and the optional direction indicator points to its center. There is no
hold timer for reach. Older maps still use their original circular held goals.
All objectives use the existing completion latch, feedback, and progression;
Retry restores the current map's actors and clears the latch while retaining
control settings and calibration.

## Author, validate, inspect, repeat

1. Copy the closest real definition into `maps/<room>.js`. Set a unique id,
   name, supported theme, positive world dimensions, spawn, and objective.
2. Author surfaces, truthful fixtures, clusters, and a few useful views. For a
   traversal map, declare waypoints through a generous corridor to the exit.
3. Register the file in `maps/map-data.js` and `runtime-assets.js`.
4. Run:

```sh
npm run sync-cache
npm run map:validate -- living-room
node tests/map-authoring-test.js
node tests/living-room-test.js
npm run map:render -- living-room --out /tmp/living-room
npm run map:render -- living-room --phone --out /tmp/living-room-phone
npm run map:render -- kitchen-floor --phone --out /tmp/kitchen-phone
```

Replace the id and relevant focused test when creating another room. `map:validate`
with no arguments checks all three new definitions. Full `npm test` also checks
the existing map catalog and generated variants. Malformed definitions fail
clearly during expansion; validation reports invalid references, types, bounds,
spawn/destination clearance, and blocked routes.

The reachability check is a 20-unit sampled grid using real collision shapes.
An authored route additionally samples every 5 units with twice the marble
radius, reserving steering space. Neither proves dynamic playability or checks
every possible hazard/terrain crossing. Drive the route after changing it.

Screenshots use the real app, renderer, camera transform, and runtime actors in
local Chrome. Set `CHROME_PATH` if needed. Output includes `overview.png`,
`spawn.png`, `objective.png` for reach, authored view PNGs, and `report.json`
with browser errors, sampled JS frame work, and canvas backing storage. View ids
must be filename-safe and unique; `overview`, `spawn`, and `objective` are
reserved. Default authored-view scale is 1.

The tool starts normally, then pauses and retries before capturing so actor
placement is fresh. It intercepts boot only in the development browser, exposing
`window.__mapPreview`; normal production boot exposes no debug globals. The
exported `openMapPreview({mapId, phone})` in `tools/render-map.js` returns
`{page, errors, close}` for ad-hoc Playwright keyboard playtests. Always close it
in `finally`. This reuses the same browser/server helpers as the smoke test.

Before finishing:

```sh
npm run sync-cache
npm test
npm run test:browser
npm run lint
npm run format:check
git diff --check
```

## Adding one genuinely new primitive

Add a concrete kind and its load-time expansion in `maps/map-authoring.js`.
Reuse an existing terrain type or rectangle collision whenever its behavior
fits. Put unique art in the relevant theme/terrain renderer; derive solid art
from its runtime collision footprint, as living-room furniture does. Add
validation and focused behavior/geometry tests. Register new runtime files and
sync the cache. Do not add behavior to renderers or create a second actor store.

For another objective, extend `core/map-objectives.js`, the dispatch in
`core/goal-controller.js`, validation, and transition tests. Read an existing
authoritative state owner; add only the objective the new map actually needs.

## Evidence and remaining playtests

The kitchens preserve the ceramic floor, four authored food clusters, utensils,
spill shapes, sponge, cereal, and ant behavior. The living room has an open entry,
toy threshold, slow rug around a solid chest, sofa alcove, wood bypass lanes,
and a clear northeast doorway. Magazines and socks are cosmetic.

Implementation checks exercised a complete keyboard ant hunt (10 to 0), final-ant
transition to the living room, and restart back to 10 ants. A separate continuous
keyboard traversal followed the living route from spawn to the next map in
10.855 seconds without coordinate writes. Separately positioned keyboard contact
checks hit the sofa, chest, and rotated toy at a 29px center-to-edge distance.
One-second keyboard samples traveled 779.907px on wood versus 535.914px on shag
(31.3% less); these browser samples are illustrative, not fixed tuning targets.

Living-room canvas backing storage fell from 56,120,192 to 15,521,200 bytes by
using existing DOM/CSS for static furniture and bounding the shag canvas.
Kitchen storage stayed at 37,809,408 bytes. A standalone desktop capture sampled
0.258ms JavaScript frame work. These numbers exclude GPU/compositor cost and are
not a physical-phone performance claim.

Representative evidence: [living overview](screenshots/map-authoring-living-overview.png),
[phone-size exit](screenshots/map-authoring-living-exit-phone.png), and
[kitchen objective/food cluster](screenshots/map-authoring-kitchen-phone.png).

On real phones, judge whether the rug slowdown rewards using the wood lanes
without making direct crossing tedious, whether furniture and the doorway remain
readable at normal zoom, and whether finding the last kitchen ant is enjoyable.
Check steering clearance, objective HUD legibility, and smoothness in Android
Chrome/Brave and iPhone Safari/Chrome over HTTPS. Desktop keyboard tests do not
validate sensors, haptics, installed-app behavior, or mobile compositor cost.
