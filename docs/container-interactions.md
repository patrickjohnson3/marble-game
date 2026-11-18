# Enterable cup: geometry, pursuit, and visibility

The existing coffee cup is the only currently enterable prop. Sofas, chests,
bookcases and appliances keep their established solid footprints.

## What was wrong

The first reveal tested the marble center, then raised the entire shaded sphere
above the cup at 45% opacity. Crossing the boundary switched draw order for all
of the sphere at once. Its highlights appeared on the painted ceramic even when
only part of the marble was covered.

The roach already used the same prepared obstacle pieces as the marble and had
a smaller circular body. It could enter from the front, but its pursuit steering
pointed through the back/side walls; collision rejection and local turns could
oscillate indefinitely. A stationary target inside stayed at least 168 world
units away after 900 frames from behind and from the handle side. When the roach
entered legitimately, its ordinary canvas was occluded by the cup with no
interior indicator. Navigation and visibility were separate failures.

## Shared geometry and pursuit

`KITCHEN_CUP_SPRITE` defines source-image interior, exterior, and roof bounds.
`core/map-obstacles.js` uses the interior edges for the corresponding ceramic
walls and keeps the existing fitted compound collision geometry.
`core/containers.js` transforms the same profile into `mapRuntime.state.containers`
on map load. Each descriptor has its fixture source, local interior/cover,
world pose, five exterior guide points, and an `openingApproach` reference.
Containment is derived from live positions; there is no persistent occupancy
flag or second collision collection.

Both bodies collide with `mapRuntime.state.obstacles`. The marble has radius 29;
the roach has radius 24. Route probes use radius 27, including a 3-unit safety
margin covering the intervals between 6-unit samples. This footprint fits every
marble-clear passage. Validation rejects a roach map whose authored marble radius
is smaller than the navigation footprint. A 60-unit passage and an opening close
to a world edge are exercised by regression tests.

During harassment, a blocked direct route near a container triggers a bounded
shortest-path search on its five-point exterior ring. All connections are checked
against the live obstacle collection, including a moved sponge. Entry/exit
connections go through the opening approach. The roach follows the first safe
waypoint, clamps steps at arrival, and replans on its existing decision clock.
Inside the cavity it pursues the current marble position rather than an intercept
projected through a closed wall. If the opening is blocked, ordinary collision-safe
avoidance continues until a valid route returns. There is no teleport or wall bypass.

Harassment speed, attack strength, recovery, escape distance/time, stun, invulnerability,
and quiet intervals retain their existing tuning. Entering the cup does not clear
pursuit. Retry recreates both descriptors and the actor's optional route target.

This is local routing for a single-opening prop, not room-wide pathfinding. Future
pipes or furniture need truthful solid geometry and an appropriate interior/opening
profile, with their actual placements validated and exercised. Complex arrangements
or multiple openings may need different guides; they are not implemented here.

## Rendering choice

Two approaches were assessed against the flat photographic sprite:

- Selective cup translucency would need extra compositing/masks to fade the body
  while protecting its opaque rim and handle. The image has no separate interior
  floor or depth layers; fading its painted surface would not recover that data.
- A clipped occupant silhouette keeps the existing ceramic art opaque, including
  its silhouette, rim, handle, and shading. It needs one small local overlay.

The second approach is implemented. The original marble and roach stay in their
normal layers below the cup. The sprite's alpha naturally obscures covered portions
while exposing portions outside the opening. A faint flat outline/fill is clipped
to the roof interior and drawn into a child canvas of the cup. It has no sphere
glint or floor shadow painted onto the ceramic. The insect outline includes its
body, legs, and antennae, making the two occupants distinguishable.

Coverage uses entity extent, not a center toggle. As a body crosses the roof edge,
the clipped portion grows or shrinks continuously; neither the original body's
opacity, size, nor draw order changes. The roof mask deliberately stops before the
rim and excludes the handle. Real exterior shading/contact shadows stay intact.
The debug hitboxes remain above the cup and its child overlay.
The static artwork/shadow live on a pseudo-element, so silhouette updates do not
also invalidate a filter group containing the whole cup and its live canvas.

`renderContainerOccupants()` reads authoritative entities after each frame's updates,
including paused/reset renders. The canvas is created on first coverage and reused;
unchanged covered poses do not repaint, and unchanged coverage flags do not rewrite
DOM attributes. Retry/room changes discard it with the fixture DOM. Maximum backing
dimension is 512 pixels; there are no per-frame route arrays or geometry rebuilding.

This remains a 2D cutout view. The image cannot reveal a physically rendered inner
cup floor or parallax. The outline is explicitly a through-object indicator. A real
interior view would require additional artwork or a different rendering model.

## Evidence and checks

Real-game desktop Chrome views at 390×844:
[entering the mouth](screenshots/container-mouth.png),
[partially covered](screenshots/container-partial.png),
[both occupants inside](screenshots/container-occupants.png).
A separate [844×390 landscape view](screenshots/container-landscape.png) checks the
same interaction at a wider aspect ratio.

Keyboard input drove the marble through the opening. A controlled stationary-target
encounter then placed the roach behind the closed cup back; real physics/pursuit
routed it inside to make contact. Moving the target outside made the roach leave
through the opening and continue harassment. This distinguishes real keyboard
movement from the positioned setup used to isolate the pursuit scenario.

`tests/containers-test.js` checks entry and exit from four directions toward three
interior targets at three rotations, entire swept paths remaining outside solids,
fixed and irregular update partitions, blocked/reopened access, narrow clearance,
world-edge access, reset, shared clipping geometry, bounded canvas storage, and cache
reuse. Existing cup/utensil and encounter tests retain ordinary movement/contact checks.
The browser suite drives entry/exit and pursuit through the application, inspects
actual canvas alpha against the roof mask (not color/screenshot goldens), and checks
normal body layering, opaque ceramic, Retry and room cleanup.

Final checks on Node 24.18.0 passed: `npm test`, `npm run lint`,
`npm run format:check`, `npm run map:validate`, `npm run check-cache`, and
`git diff --check`. Runtime modules and generated versions were synchronized with
`npm run sync-cache`. `npm run test:browser` passed the gameplay/browser smoke
checks, but the PWA suite failed waiting for the in-app update release at
`tests/pwa-browser-test.js:695`. Running `node tests/pwa-browser-test.js` in a
disposable copy of the unchanged starting commit, `3aa7bb6`, reproduced the same
assertion. The full browser command therefore remains failing for this pre-existing
update-test issue; these results do not establish that PWA upgrades always succeed.

A 120-frame desktop encounter sampled the game's existing smoothed JavaScript
counters: median total 0.59 ms, physics 0.15 ms, render 0.05 ms; the 95th percentile
of the smoothed total was 0.91 ms. These are not raw frame intervals, compositor/GPU
measurements, or phone results. Canvas backing storage rose from 37,879,104 to
38,456,704 bytes when occupied: one 380×380 overlay, 577,600 extra bytes. The
reproduction used the normal 4400×4400 kitchen, twelve ants, and its existing props.

Physical Android Chrome/Brave and iPhone Safari/Chrome were unavailable. On hardware,
judge the outline's contrast, whether the transition reads as entering a solid cup,
whether a chase inside remains understandable, and sustained compositor cost.
