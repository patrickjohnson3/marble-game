# Ants and liquids improvement pass

Comparison baseline: `e3b2cd9` (the committed fractional physics correction).

## What changed

Previously, ten ants homed toward cereal with a small sine wobble, three small
body lobes, rigid stick legs, and no threat response. A crush depended on overlap at the end of the marble's
frame and left a green splat. Water had heavy repeated outlines; goo was a
translucent oval with regular dots.

Ants now have distinct head, thorax, abdomen, waist, six jointed legs, and two
probing antennae. Feet advance with actual distance, stop during probing, and
alternate in tripods. Small deterministic differences in size, speed, reaction
delay, turn preference, and probe timing keep the ten ants from synchronizing.
Two existing spawn points moved closer to the opening route; population is
unchanged.

Foraging ants spread between food targets, make local course corrections, and
steer around other ants, utensil hitboxes, and water/goo. Wet or sticky food is
ineligible. An ant already inside a spill keeps moving, at 75% walking speed in
water or 50% in goo, and can escape. There is no pathfinder or colony simulation.

An approaching marble triggers a short hesitation, a bounded escape attempt,
then recovery and foraging. Escape is intentionally slower than a committed
marble pursuit. Near misses can be remembered even after the marble has passed.
Crushing tests the frame's swept marble segment before ants move, so an ant
cannot walk out of an impact that already happened. Actual travel also counts
when a later utensil collision has reduced the marble's endpoint velocity.
Hazard/map teleport handling remains unchanged.

A fresh crush produces five small brown flecks, the existing impact haptic, and
a brief visual compression of the marble. Its body flattens and legs curl over
24 frame units; the dry remains then persist without animation until Retry or
map reset. Rolling over remains retains the existing subdued feedback and does
not emit another fresh crush. Kitchen events reuse one small list consumed in
the same frame, before progression can replace the map.

Water is a translucent wet film with a fine uneven meniscus, restrained depth,
and broken reflections. Moving through it leaves expanding curved ripples that
open in the direction of travel. Goo has a denser shaded body, thicker edges,
soft folds and trapped bubbles. Its directional wake relaxes slowly instead of
expanding like water. Wakes clip to the actual drawn contour and follow live
puddle shrinkage.

## Ownership and tradeoffs

- `core/kitchen-dynamics.js` owns all ant simulation and remains. Main ant tuning
  lives in `antConfig` in `core/game-config.js`, in existing 60 Hz frame units.
- `rendering/map-theme-rendering.js` reads simulation state and reuses the
  existing half-resolution dynamic canvas. Dirty redraws now clip to the cleared
  pixels so overlapping translucent artwork cannot accumulate opacity.
- `rendering/liquid-patch-shape.js` shares liquid contours between static drawing
  and wake clipping. Static liquid canvases still redraw only when requested,
  including the existing quantized sponge shrink updates.
- `rendering/effects.js` keeps the existing bounded particle count and canvas
  lifecycle. No audio system, dependencies, new canvas layers, or fluid
  simulation were added.
- `ELLIPTICAL_SURFACE_SHAPES` moved unchanged from physics into
  `core/map-elements.js`. Ant queries and presentation use the same footprint
  constants. The integrator, marble tuning, controls, and terrain mechanics did
  not change. Organic edges deviate only a few world pixels from contact bounds.

The default reaction delay (about 5–9 frames) and escape speed (about twice normal
walking speed) are conservative design choices, not a proven optimum. Local
steering may take an indirect route around obstacles. The retained canvas scale
favors memory and frame time over sharp microscopic detail when zoomed in.
Remains persist; particles fade. Population does not replenish during a run.

## Validation and measurements

Baseline unit, browser, lint, formatting, and cache checks passed before edits.
New coverage in kitchen, rendering, effects, game-loop, and liquid-rendering
tests protects delayed threats, catchability, near-miss recovery, moving feet
versus probing, individual deterministic motion, obstacle/liquid routes,
escaping a spill, swept crushes after braking, one-time events, corpse settling,
reset, clipped redraws, liquid boundary agreement, canvas reuse, wake direction,
live shrink clipping, and effect expiry/caps.

Final `npm test`, `npm run test:browser`, `npm run lint`,
`npm run format:check`, `npm run check-cache`, and `git diff --check` passed.
Runtime files and generated cache versions were synchronized with `npm run sync-cache`.

Desktop headless Chrome measurements used `performance.now()` around individual
calls. Simulation used ten ants and the normal kitchen's 46 food objects. The
isolated drawing sheet contained five live ants and five corpses, without food:

| Work                                                       | Baseline mean | After mean |
| ---------------------------------------------------------- | ------------: | ---------: |
| Kitchen update, 2,000 frame units                          |    0.00535 ms | 0.02465 ms |
| Dynamic drawing, 500 updates on a 960×720 comparison sheet |     0.0298 ms |  0.0402 ms |

After-change p95 was 0.1 ms for both probes; browser timer granularity limits
precision. The actual 4400×4400 world's dynamic canvas is still 2200×2200
(19.36 MB of RGBA pixels). Drawing still uses small dirty regions and corpse
settling stops issuing revisions. These measurements cover JavaScript and
canvas submission, not complete GPU compositing or physical-phone frame time.

Chrome at a 390×844 viewport and DPR 2 exercised a real keyboard charge, a slower
oblique approach, Retry, water, and goo. The charge produced forage → probe →
squished, five flecks and marble compression; the slower pass produced probe →
flee → forage with the ant alive. Retry restored ten living ants and zero
particles. Water/goo runs had four ripples/three wakes and about 0.44/0.47 ms of
reported game-loop work. A subsequent 4× CPU-throttle budget probe reported
about 1.06 ms. No browser page errors occurred. This is desktop emulation,
not a phone performance guarantee.

## Physical-phone playtest

Use HTTPS on Android Chrome/Brave and iPhone Safari/Chrome. In both kitchen maps:

1. Watch ants at normal and closer zoom: recognizable anatomy, organic walking,
   still feet during probing, readable feelers, and sufficient contrast.
2. Approach slowly, narrowly miss, then deliberately chase quickly. Check that
   escapes are entertaining and readable without making ants frustrating to hunt.
3. Crush several ants, expose their remains, roll back over them, and Retry.
   Judge immediate squash, haptic strength, understated flecks, and dry remains.
4. Cross water and goo at different speeds and zooms. Water should read wet and
   transparent; goo thick and sticky. Wakes should follow travel and remain in
   the spill, including after the sponge shrinks water.
5. Watch ants route around spills/utensils and continue toward food. Check smooth
   frame pacing during a crowded encounter, liquid traversal, and sustained play.

Anatomical readability and the hunt/escape balance still require human judgment;
the automated checks establish behavior and lifecycle, not beauty or fun.
