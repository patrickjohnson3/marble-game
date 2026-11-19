# Sideways cup: opening, cutaway, and pursuit

The kitchen's ceramic cup lies on its side. Its source sprite opens toward local
+X; the authored `Math.PI / 2` rotation points the mouth down the screen beside the
existing water spill. The camera only pans/scales this 2D world; there is no 3D
mesh, perspective camera, shader, or depth buffer. Other furniture retains its
established solid footprint.

## Reproduced problems

The earlier center-triggered translucency was replaced with clipped occupant
outlines and opening guides. Navigation through the mouth worked, but the flat
photograph still painted its pale mouth over real actors. An entering marble
could disappear behind this apparently solid ellipse, then appear as a dashed
circle on the blue ceramic. The roach received a similar drawing rather than a
view of its actual body. Its enlarged antenna envelope could even trigger that
cue with its center outside the cavity: local position `(-140, -88)`, radius 24,
is clear of solids but overlapped the old reveal mask.
The [previous outline view](screenshots/container-occupants.png) is retained for
comparison.

These were rendering defects. The existing hollow compound collision geometry,
rotation, roach routing, and nearby spill already supported the intended scene.
They have been preserved. There is no new fluid behavior or camera tuning.

## One opening, real actors

`KITCHEN_CUP_SPRITE` holds source-image bounds for the interior, visible opening,
and exterior navigation guides. The opening lies between the existing solid rim
pieces. Those pieces now refer to the opening's edges without changing their
sizes or positions. `core/containers.js` derives the world pose and local bounds
once on map load. Both actors still use `mapRuntime.state.obstacles` as the one
physical obstacle collection.

Rendering uses two ordinary DOM layers:

- A shaded interior below both the insect overlay and marble.
- The original opaque photographic cup above them, with a clipped mouth.

At rest the aperture is a narrow ellipse inside the rim. When an actor actually
enters the cavity, the same aperture extends back toward its leading body extent
as a curved, tapered cutaway. Its rear contour fits the occupants rather than
stretching the full mouth height into a long slot. It is connected to the mouth, leaving the back, side strips,
handle, and outer rim opaque. Both actors use the same rule. Outside antennae do
not open a window through ceramic. If both are inside, one cutaway exposes them
both; after they leave, only the ordinary mouth remains open.

The actual marble and roach render in their normal layers, at normal opacity and
size, with their normal shading. There is no duplicate sphere, insect glyph,
silhouette canvas, global opacity switch, or retained occupancy flag. The opening
advances continuously with body extent along the legal entry/exit path. Its local
coordinates rotate and scale with the cup, independently of follow and zoom.
Retry and room changes remove the disposable interior with the fixture.

This cutaway is an illustrative view into a solid object, not transparent ceramic
or a physically rendered 3D interior. The flat source image cannot supply parallax
or a true curved inner floor. The explicit opening and visible interior make the
tradeoff clearer than an unexplained x-ray outline. No second rendering engine,
new bitmap, or actor render pass is needed. Unchanged cutaway geometry skips style
updates; the interior is static and no additional canvas backing storage is used.

## Curved-window follow-up

The first cutaway reused the mouth's narrow ellipse radius at both ends and
joined them with long straight edges. Live keyboard entry at 0.55× and 1× reproduced
its rectangular appearance. A 90-frame trace at each zoom showed positional
expansion rather than an opacity or draw-order toggle at the legitimate mouth
threshold. Rapid movement made that tall slot open in only a few frames; no
camera or collision change was needed.

`cupCutawayShape()` now derives a rounded rear window from the live bodies and
joins it to the fixed mouth with curved shoulders. Control points stay inside
the existing cavity bounds. Each actor contributes with a smoothstep weight over
one mouth width of leading-body penetration. That spatial blend also prevents a
second entrant from abruptly resizing an occupied window. A quarter-radius visual
margin leaves interior visible around the body, clamped at the physical walls.
There is no elapsed-time animation, opacity fade, or delayed mask following the
marble. Hovering or reversing at the same positions produces the same geometry.
The existing interior backdrop covers the physical cavity behind the foreground
mask so an off-center curved reveal cannot expose floor tiles underneath. Its
front edge uses the same mouth ellipse, preventing rectangular backdrop corners
from leaking through the sprite's transparent rim padding.

[Before / after at both zooms](screenshots/cup-curved-comparison.png) uses real
keyboard-entry screenshots. [Both occupants](screenshots/cup-curved-both.png) and
[boundary views](screenshots/cup-curved-boundary.png) show the shared rule.
The boundary views are positioned hover/side-wall scenarios, distinct from the
live keyboard reversal checks. The source image still limits this to an
illustrative cutaway; it does not provide a physically curved 3D inner surface.

New deterministic coverage checks rounded body-sized rear bounds, physical limits,
threshold continuity, actor handoff, and exact reversal without retained state.
The real-browser test queries its actual CSS path with `Path2D`: the mouth stays
open, walls stay masked, occupants' centers stay visible, and ceramic above a
single occupant no longer becomes a full-height slot. This last assertion was
verified to fail against the unchanged starting commit `4e40629` in a disposable
copy, and pass with the fix. These are geometric checks, not pixel goldens.

On 2026-11-19, the final Node suite, lint, formatting, map/cache validation,
and diff checks passed. Final focused Chrome checks passed the live entry,
pursuit, exit and 24-view matrix. Additional captures covered 30 positioned hover
views, six actual keyboard reversals at the two zooms, and four off-center wall
views, with no browser errors. These remain desktop evidence, not phone tests.

Full browser validation is not green: a combined run reached the smoke-test pass
then timed out in the PWA `max-age=600` upgrade case (`pwa-browser-test.js:802`).
The final standalone PWA run reproduced that timeout; another combined attempt
ended with SIGTERM. A disposable unchanged `4e40629` copy also failed waiting for
an update, but in the later in-app case (`:695`, called from `:806`). That baseline
failure does not isolate the exact current timeout. Service-worker logic was not
changed; only generated release metadata was synchronized. No PWA fix is included.

## Shared traversability

The marble radius is 29; the roach radius is 24. Existing route probes use radius
27, including a 3-unit safety margin covering intervals between 6-unit probes.
Map validation checks this footprint against the checked marble spawn radius.
Both bodies therefore fit the same physical passages in the current maps.

The existing bounded five-guide exterior route sends a blocked pursuer through
the mouth, checking the live obstacle collection including a moved sponge. Inside
it pursues the current target rather than an intercept through a closed wall.
A blocked mouth is not bypassed; ordinary collision-safe avoidance continues
until access returns. Entry does not clear harassment. Attack, escape, goo,
recovery, and speed tuning are unchanged. This remains local single-opening
routing, not general room pathfinding.

## Automated and visual checks

`tests/containers-test.js` exercises rotated/scaled geometry, entry/exit from four
approaches, three interior targets, swept roach paths, fixed/irregular update
partitions, blocked/reopened access, narrow and world-edge clearance, and reset.
Visibility tests cover extent-driven opening, exterior false reveals, identical
rules for both actors, layer reuse, removal, and rendering leaving solids intact.
`tests/kitchen-fixtures-test.js` checks marble entry, closed walls, and grazing rim
and back-wall impacts at overspeed and a 2.2-frame update, including rotations.
Touching a wall is allowed; penetration beyond numerical roundoff is not.

The real Chrome test in `tests/kitchen-fixtures-browser-test.js` drives keyboard
entry and exit while changing zoom through the existing camera controller. A
controlled pursuit starts the roach behind the closed back, lets real physics
bring it inside to contact the marble, then checks that it exits after the target
moves outside. It also checks Retry while occupied and changing rooms.

Its reproducible visual matrix covers marble-only, roach-only, and both interacting,
each outside / at the rim / inside / exiting at 0.55× and 1× zoom: 24 real-renderer
captures at 390×844. "Only" means the other actor remains outside the cup, not that
its renderer is removed. Matrix poses are deliberately positioned and paused to
compare rendering; live entry/pursuit above are separate evidence. Layer/clip
assertions do not establish visual quality and are not pixel goldens.

Initial slot evidence, before the curved follow-up: [near matrix](screenshots/cup-cutaway-near.png),
[far matrix](screenshots/cup-cutaway-far.png),
[both inside](screenshots/cup-cutaway-both.png), and
[landscape](screenshots/cup-cutaway-landscape.png).
The sheets crop and arrange actual viewport captures; the command below saves
the full screenshots and poses.
Additional desktop captures exercise cup rotations 0 and −0.4 radians and the
existing maximum zoom of 2.5×. These are fixture rotations/viewport changes,
not a new camera angle or physical-device verification.

Generate the full matrix using existing test/browser helpers from the repo root:

```sh
node --input-type=module <<'JS'
import { createStaticServer, listen, launchBrowser, closeServer } from './tools/browser-support.js';
import { testCupEntry } from './tests/kitchen-fixtures-browser-test.js';
const server = createStaticServer(process.cwd());
await listen(server);
let browser;
try {
  browser = await launchBrowser();
  await testCupEntry(browser, `http://127.0.0.1:${server.address().port}/`, {
    screenshotDirectory: '/tmp/cup-views',
  });
} finally {
  await browser?.close();
  await closeServer(server);
}
JS
```

The directory contains 24 PNGs and `matrix.json` with camera/actor poses and
computed layering. The normal browser suite runs the same scenarios without
saving screenshots. Also run `npm test`, `npm run lint`, `npm run format:check`,
`npm run map:validate`, and `npm run check-cache` after `npm run sync-cache`.

On 2026-11-18, the Node suite, lint, formatting, map validation, cache validation,
and `git diff --check` passed. The focused cup test and 24 captures passed, with
no browser errors. The full `npm run test:browser` command passed on rerun,
including PWA offline/upgrade regressions; an initial process had ended with
SIGTERM before reporting a result. These were desktop Chrome checks on Node
24.18.0, not physical-phone measurements.

## Manual judgment

Open the first kitchen and enable Camera buttons in Settings. At the cup beside
the upper water spill (world center 2590,1260), approach its down-facing mouth
around (2545,1500), roll up through the lip to (2545,1260), then roll down to exit.
Repeat near either rim edge and at a faster approach. The mouth should stay hollow,
the exposed body should remain opaque, and the cutaway should close as it leaves.
Approaching the closed back must stop at the ceramic without a reveal. Let a
chasing roach follow this route; it should enter, remain visible on the same
interior, and follow back out. Try one inside while the other stays outside.

Use zoom in/out during movement and while resting against each wall, then rotate
the device. Follow/zoom should retain their existing behavior; clipping must stay
attached to the cup. The scene has no camera viewing-angle control. Rotated cup
fixtures are exercised by deterministic geometry/physics tests instead.
For threshold hovering/reversal, alternate short up/down inputs around world
position (2545,1405). Small movements should change only a small part of the
opening, and backing out should retrace the same contour without a delayed fade.

Physical Android Chrome/Brave and iPhone Safari/Chrome remain necessary for judging
cutaway readability, touch/tilt feel, CSS clipping on those browsers, and sustained
compositor performance. Desktop captures cannot establish those results.
