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

The lower and eastern travel lanes stay open. The upper floor remains quiet
on purpose; it gives the goal and the dense scenes some breathing room.

`maps/kitchen-layout.js` holds authored anchors and food/ant offsets. Both
`core/kitchen-dynamics.js` and `rendering/kitchen-floor-details.js` use those
anchors. Initialization still creates 34 pushable Cheerios, 12 pushable
crumbs, and 10 ants. Retry reconstructs their original positions and state.
Ants now start near food; their foraging, avoidance, panic, and crushing rules
are unchanged. Food can consequently be eaten sooner than with the old
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
