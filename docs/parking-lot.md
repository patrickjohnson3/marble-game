# Level three: parking lot

The previous level placed decorative cars and cones independently of its solid
maze bars. Lines crossed the cars, the rendered cars and contacts disagreed,
and brightly colored terrain rectangles had no clear physical meaning.

`maps/parking-lot.js` now authors two banks of three parking bays, four parked
cars, an open central aisle, and clear west-entry/east-exit lanes. A compact
maintenance area groups an uncovered drain, three cones, and a gravel repair.
Puddles sit farther east; restrained oil traces, cracks, and litter dress the
empty bays and edges. The world, spawn, circular held goal, progression order,
and marble tuning are unchanged. This is still a traversal level.

## What affects play

- Cars use five fitted rounded rectangles through the existing utensil collision
  helper. The complete sprite and its collision pieces share scale, center, and
  rotation; the small silhouette approximation is described in
  [asset notes](parking-assets.md).
- Concrete wheel stops, the curb, and rubber cone bases are solid. Their rendered
  dimensions, rotation, and corner radius come from the collision fixture.
- The dark drain opening is a reset hazard; its visible rectangular opening uses
  the hazard's exact bounds. Its surrounding rim and cones provide warning.
- Gravel uses existing rough terrain. Puddles use existing water terrain and
  liquid rendering. They replace the old abstract ice/hazard arrangement without
  changing terrain constants or physics.
- Bay paint, arrows, EXIT lettering, oil traces, cracks, and small litter are
  cosmetic. They have no collision or hidden movement effects.

The separate `parking-lot-puddles` variant retains its previous content. The
specialized renderer selects only level three. No enemies, objective types,
controls, or generic scene/physics framework were added.

## Authoring and inspection

This map retains the direct `elements`/held-goal representation. Edit its layout,
scenery, route, and capture views in `maps/parking-lot.js`. Its concrete fixture
names are `parkedCar`, `wheelStop`, `curb`, and `trafficCone`; terrain material
names are `drain` and `gravel`. The parking renderer handles its flat scenery.
These are local parking concepts, not additions to the kitchen/living-room
`expandMap()` schema.

```sh
npm run sync-cache
npm run map:validate -- parking-lot
node tests/parking-lot-test.js
npm run map:render -- parking-lot --out /tmp/parking
npm run map:render -- parking-lot --phone --out /tmp/parking-phone
```

Use the explicit map id: the no-argument validation command selects the existing
`expandMap()` definitions. Full `npm test` validates the complete map catalog.
The authored route is a development clearance certificate: samples reserve two
marble radii around solids and reset hazards and end inside the held goal. It is
not an invisible rail or runtime autopilot.

Evidence: [overview](screenshots/parking-overview.jpg),
[phone car/bay](screenshots/parking-car-phone.jpg), and
[phone maintenance area](screenshots/parking-maintenance-phone.jpg).

## Validation and tradeoffs

New tests cover independent car-silhouette contact measurements on both sides,
ends and shoulders at multiple rotations; rounded cone/concrete contacts;
clearance and invalid route cases; hazard alignment; deterministic static art;
one visual per composite car; and preservation of the other parking variant.
The existing physics and fork/spoon regression suites remain unchanged.

A headless Chrome playtest used keyboard events to drive continuously from spawn
through all six route waypoints and hold the goal until progression reached
`sand-lot` (1,032 rendered frames). It did not write marble coordinates during
that traversal. Separate contact checks positioned the marble before each test,
then drove it into a car, wheel stop, rotated cone, curb, drain, gravel, and water.
Solid tests observed contact without penetration; the drain reset to spawn with
zero velocity, and Retry restored spawn and cleared goal progress. No browser
errors were reported.

Static paint and wear share one 0.35-scale canvas, built on map load. Gravel is
also baked once. There is no per-frame scenery generation or random placement.
Canvas backing storage fell from 42,126,112 to 12,629,680 bytes (about 70%). The
two new WebP files total 956,532 bytes; their decoded pixels require roughly
12.6 MB in addition to canvas storage. That is not a total-memory measurement.
Headless JavaScript frame samples remained below a millisecond during ordinary
active frames, but these samples do not measure phone GPU/compositor cost.

Cars intentionally reuse one asset; their silhouettes use a small primitive
approximation rather than pixel geometry. Paint is rasterized below world
resolution. Judge asphalt contrast, paint readability, car scale, drain warning,
and steering space on a real phone, especially while zooming. Sensors, haptics,
installed-app behavior, and physical-phone smoothness were not tested here.
