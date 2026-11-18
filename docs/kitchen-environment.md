# Kitchen environment pass

This pass builds on `00c2559` (fork collision geometry). It changes kitchen
composition and floor/liquid presentation, preserving the marble integrator,
controls, fixture geometry, progression, camera, and ant behavior rules.

## Composition

Both kitchen variants now have four authored food scenes, with different
positions and orientations to suit their existing utensils and liquids:

- An opened, flattened cereal packet and a short food trail near the spawn.
  A nearby ant and the packet edge are visible at a 390px-wide phone viewport.
- A flattened napkin and breakfast scraps near the fork, adding interest to
  the lower part of the first kitchen.
- Rice, tiny toast flakes, and dull wipe marks near the cleanup area.
- A dried drink ring and food on the dry side of a spill.

In this original pass the lower and eastern travel lanes stayed open and the
upper floor remained quiet. The later [edge composition follow-up](#edge-composition-follow-up)
fills that upper area while preserving wide travel lanes.

`maps/kitchen-layout.js` holds authored anchors and food/ant offsets. Both
`core/kitchen-dynamics.js` and `rendering/kitchen-floor-details.js` use those
anchors. Initialization creates 34 pushable Cheerios, 12 pushable
crumbs, and 12 ants (increased from ten in the later
[liveliness pass](ants-and-liquids.md#liveliness-follow-up-validation)).
Retry reconstructs their original positions and state.
Ants start near food; foraging, avoidance, panic, and crushing rules remain owned
by `core/kitchen-dynamics.js`. Food can consequently be eaten sooner than with the old
distant ant spawns. Flat litter remains after food has been eaten or pushed.

All newly painted packet, napkin, rice, flakes, wear, wipe marks, dried drops,
and rings are cosmetic. They live on the existing static floor canvas, not
in the obstacle collection. The paper is flat, with restrained shading so it
does not imply a new solid obstacle. No new blocking prop was added.

## Floor and spills

The 220-unit yellow checkerboard became 550-unit cream ceramic tiles: 2.5×
the old width, about 9.5 marble diameters. Five close tones, a faint glaze,
4-unit gray-beige grout, and sparse chips/scuffs/hairlines give scale without
competing with ants. This is deterministic map-load painting on the same
1760×1760 floor canvas; there is no new per-frame floor work.

Each existing water/goo body has two detached, genuinely wet drops. They use
the existing elliptical terrain queries and drag, rather than painting wet
ground that behaves like dry floor. Their grid-aligned rectangles fit in the
main patch's existing canvas bounds; no extra canvases or larger backing
stores are needed. Small drops omit large-puddle bubbles, folds, and caustics.
The obsolete imitation 220-unit grout overlay was removed from water, whose
translucency shows the real floor underneath.

Broad, shallow rim variation replaces the previous fine edge noise. This is
a conservative compromise: the main bodies remain broadly oval, and their
visible rims stay close to the original physics ellipses. The edge tests
limit deviation to 7 world units on the tested large/small patches, about
one ant body radius and well below the marble radius. The detached wet drops
and tiny matte dried marks provide the larger irregular splash composition.
Large decorative lobes would require matching terrain geometry; they were
deliberately avoided. Existing ripple/wake clipping uses the same revised rim.

The sponge still absorbs only the first/main water patch in the first
kitchen. Detached drops remain wet independently. Retry restores all patches.

## Validation and performance

The original Node, browser, lint, formatting, and cache checks passed before
edits. Added `tests/kitchen-layout-test.js` covers deterministic reset,
food/ant population, dry and obstacle-free starting positions, clear spawn
and goal aprons, nearby food resources, distinct variant scenery, and
decorations adding no obstacles. Added `tests/kitchen-spills-test.js` covers
real drag at drop centers, dry corners, detached rim clearance, unchanged
canvas bounds, small-drop rendering, and sponge ownership/shrink/reset.
Existing floor tests now check larger tiles, deterministic output, retained
resolution, and no floor repaint during ant movement. Water tests explicitly
place their cereal in water instead of depending on the old scenery layout.

Final validation: `npm test`, `npm run test:browser`, `npm run lint`,
`npm run format:check`, `npm run check-cache`, and `git diff --check`.
Runtime files are registered in `runtime-assets.js`; generated import/cache
state is produced by `npm run sync-cache`.

Desktop Chrome inspection covered both complete maps at 0.2× and the entry,
utensil, cleanup, water, and goal areas at gameplay scale. Phone-size captures
used a 390×844 viewport. Actual keyboard input traversed the first kitchen's
lower lane from x=840 to x≈3654 at y=3640, then its eastern lane to y≈900.
The route and a subsequent aimed ant chase produced three crushed ants and
five disturbed food items, with no added blocking geometry.

The same local Chrome harness measured 11 terrain paints (discarding the
first) and sampled the existing in-game performance counters. Initial
baseline terrain-paint median was 4.6ms; post-change medians ranged from 4.7ms
to 5.6ms. A final sequential comparison against an isolated archive of HEAD
measured 4.7ms before and 5.5ms after: about 0.8ms extra on map painting.
Sampled JavaScript frame work in that pair was 0.28ms before and 0.39ms after.
Canvas count remained 5 and total backing storage remained 37,809,408 bytes
at DPR 1. These timings measure desktop JavaScript/canvas submission, not
compositor work or mobile frame time. The small absolute increases showed no
obvious desktop gameplay slowdown, but do not establish a physical-phone
performance guarantee.

## Visual evidence and playtesting

- [Before, full first kitchen](screenshots/kitchen-environment-before.png)
- [After, full first kitchen](screenshots/kitchen-environment-overview.png)
- [After, first kitchen at gameplay scale](screenshots/kitchen-environment-entry.png)
- [After, napkin and cutlery scene](screenshots/kitchen-environment-cutlery.png)
- [After, breakfast kitchen](screenshots/kitchen-environment-breakfast.png)
- [After, phone-size entry](screenshots/kitchen-environment-phone.png)

On a real phone, judge whether tile scale and grout are quiet enough, the
four scenes feel related to the props, and the remaining open areas feel
intentional. Check ants against rice/food, whether earlier congregations make
hunting fun, and whether flat paper correctly reads as roll-over litter.
Cross the spill rims slowly and at speed, including tiny detached drops;
judge the conservative oval bodies and whether wet water and sticky goo
remain distinct. Check longer play after ants eat the food, zoomed views,
sponge absorption, Retry, and sustained frame smoothness. No physical phone
was available for this pass.

## Resumption record

Before the interruption, inspection/baseline captures, ceramic floor work,
small-drop rendering, and an initial food/litter layout were present in the
working tree. No environment-pass commit existed. Resumption preserved that
work, finished map-variant forwarding, refined authored placement and spill
spacing, completed regression coverage, synchronized cache metadata, and
performed the final browser/visual/performance checks. The implementation was left
uncommitted at completion, pending a separate user instruction to commit.

## Edge composition follow-up

`maps/kitchen-floor.js` now frames the top and left edges with closed cabinet
toe-kicks and a brushed-metal appliance skirt with two protruding round feet.
The closed panels are solid; the gaps between the separate feet remain real.
The existing `drinkSpill` recipe moved as a unit to (1750, 880), placing its
food, ants, and dried ring in the upper third. A tipped blue ceramic cup points
its rim toward the existing water. The breakfast kitchen layout is unchanged.
World dimensions, spawn, objective, liquids, utensils, sponge, 12 ants, and
46 food pieces retain their prior rules and counts.

The authored escape loop runs through the lower/eastern floor, above the cup,
and back down the left side of the central scenes. The normal validator checks
its steering clearance; `kitchen-layout-test.js` additionally samples a
240-unit-wide static corridor, over four marble diameters. This proves static
clearance along that loop, not that every possible live chase is escapable.
The native bases use existing cached fixture DOM nodes, with art and collision
sharing dimensions/rounding. The cup reuses the utensil sprite/composite
collision path. Its handle opening stays empty. No new canvases or per-frame
map expansion were added; DPR-1 backing storage remains 37,879,104 bytes.

Visual evidence from the real renderer at a 390×844 desktop Chrome viewport:
[overview](screenshots/kitchen-edges-overview.png),
[cabinet and relocated food](screenshots/kitchen-edges-cabinet.png),
[appliance feet](screenshots/kitchen-edges-appliance.png), and
[cup beside water](screenshots/kitchen-edges-cup.png).
An [844×390 landscape view](screenshots/kitchen-edges-landscape.png) checks the
relocated cluster and cup at a wider aspect ratio.

Keyboard playtesting traversed the entire loop with the roach active, crushing
two ants along the way. Separate positioned keyboard checks reached the
cabinet edge, round foot, gap between feet, and ceramic body. Retry restored
12 ants and 46 food pieces. Focused tests cover the populated upper third,
clear corridor, invalid base dimensions/facing/bounds, blocked routes,
round-foot corners, and cup contact against independently measured opaque
image boundaries at three rotations. These are desktop checks; physical-device
tilt feel, mobile compositor performance, and whether the composition feels
inhabited enough still need human judgment.

Final checks passed: `npm test`, `npm run map:validate`, `npm run lint`,
`npm run format:check`, `npm run check-cache`, and
`node tests/browser-smoke-test.js`. The service-worker-enabled
`tests/pwa-browser-test.js` timed out waiting for a new worker in the
`max-age=600` upgrade scenario (line 802). The identical timeout reproduced
on an isolated archive of the starting commit `c33192b`; it is a pre-existing
failure, left outside this composition change.

### Cup entry follow-up

The tipped cup now has a hollow interior, solid side walls and a closed back,
with its mouth open toward local +X (downward in the main kitchen). The same
prepared rounded collision pieces serve the marble, food, and creatures.
Normal steering rolls the marble in and back out; no special controls or
inside/outside state are needed. In the initial entry pass the cup's existing
cached sprite occluded the marble beneath the opaque ceramic; the
[translucent reveal follow-up](#translucent-marble-follow-up) makes it visible inside.
Other fixtures retain their original layering, and the debug hitbox overlay
stays above the cup.
The asset, cup placement, water, and room layout are unchanged.

`kitchen-fixtures-test.js` now drives entry/exit and contacts against both sides
and the back at three rotations, using 0.5-, 1-, 2-frame and irregular update
steps. Outer silhouette and handle-opening checks remain. Rendering tests check
reuse and cleanup of the overhead sprite; `kitchen-fixtures-browser-test.js`
exercises actual keyboard entry/exit, CSS stacking, Retry, and room-change
cleanup through the real application.

Portrait desktop Chrome evidence: [entering the mouth](screenshots/kitchen-cup-entering.png)
and [rolling back out](screenshots/kitchen-cup-exited.png). The marble was
positioned once outside the mouth at (2545, 1500), then keyboard input moved it
to y≈1238 inside and back to y≈1507 outside. A separate 844×390 landscape
inspection checked rendering. These checks do not establish physical-phone
tilt feel; judge how naturally the marble steers into and out of the mouth.
Node tests, browser smoke tests, map validation, lint, formatting, and cache
checks passed. The full browser command still encounters the previously
documented `max-age=600` service-worker upgrade timeout.

### Translucent marble follow-up

This initial center-triggered experiment is superseded by
[clipped container silhouettes and shared opening routes](container-interactions.md).
It made the marble appear as a translucent blue silhouette through the cup while
its center is within the cavity. Initial reveal opacity is 45%; the cup stays
opaque. The existing marble element paints above the cup and loses its floor
shadow for this cue. Leaving restores normal opacity, shadow, and layering.
The exterior and transparent handle opening keep their ordinary presentation.
The same marble position, velocity, lighting, and collision rules remain in use.

`KITCHEN_CUP_SPRITE.interior` describes the visible cavity in source-image
coordinates. `createMarbleView()` prepares its rotated/contain-scaled world
bounds once per active map, then reads the live marble position each render.
The cached geometry is disposable; there is no new gameplay inside/outside
state, duplicate marble, DOM layer, asset, or per-frame geometry allocation.
Retry and map changes invalidate the cache. This experiment covers static cups;
furniture and pipes have no new behavior.

Regression checks cover rotated and height-limited display boxes, exterior and
handle positions, entry/exit, and reset while inside. The browser test drives
the real application with keyboard input and checks translucent/opaque styles,
layer order, Retry, and room-change cleanup. Desktop Chrome inspection covered
390×844 portrait and 844×390 landscape views:
[inside the cup](screenshots/kitchen-cup-reveal.png),
[landscape](screenshots/kitchen-cup-reveal-landscape.png).
On physical phones, judge whether the 45% silhouette is clear enough and whether
the entry/exit presentation communicates that the marble is inside the cup.
Node tests, browser smoke tests, lint, formatting, map validation, and cache
checks passed; the documented PWA upgrade timeout remains unchanged.

### Cup asset

`assets/sprites/tipped-cup.webp` is a single 1261×1247 RGBA sprite, 120,106 bytes,
generated using the built-in `image_gen` tool and delivered with the established
quality-90 WebP encoding (`method=6`, `exact=True`). Dimensions and alpha are
preserved; no crop or resize was applied. Original generation output:
`/home/pjohnson/.codex/generated_images/01a0782d-51b7-7352-9502-82f9ba7d39b0/exec-d88e2720-2fba-4816-a176-6a2ce262a07c.png`.
The sprite is registered in `runtime-assets.js` for offline use. Collision
parts measured from it live in `core/map-obstacles.js`, with the same centered
contain transform used by the renderer. Tiny alpha fringe is not solid.

Final generation prompt:

> Use case: product-mockup. Asset type: a single realistic transparent game sprite
> for a top-down household marble game. Generate ONE plain pale blue glazed ceramic
> mug knocked onto its SIDE, seen from exactly vertically overhead, orthographic
> camera. Mouth/open circular rim faces RIGHT (+X), cylinder body extends LEFT;
> thick curved handle projects above the body toward the TOP edge of the image.
> The opening is a narrow foreshortened ellipse, with believable cream interior
> and thick ceramic lip, not a round upright cup seen from above. The straight-sided
> cylindrical body, subtle glazed highlights, slightly worn foot ring at left,
> and curved handle should be immediately readable. Neutral soft indoor overhead
> light, tactile realistic pottery, restrained gloss, no illustrated outlines.
> Center the whole mug including handle in a square image; use about 85% of the
> width and 70% of height, generous even transparent padding. True transparent
> alpha background; no floor, tile, water, liquid, droplets, scenery, cast shadow
> outside the object, additional objects, text, branding, watermark, checkerboard,
> or UI. This will render around 280 world pixels long beside a 58-pixel-diameter
> marble; prioritize a clean simple silhouette so collision can follow the body
> and handle. Photorealistic household prop matching existing photographic spoon
> and sponge assets.
