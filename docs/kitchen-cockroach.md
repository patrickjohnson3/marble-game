# Kitchen cockroach

The main `maps/kitchen-floor.js` map has one invulnerable nuisance. It is not an
ant, cannot be injured or killed, and does not participate in completion. The
breakfast kitchen variant and other rooms are unchanged.

`core/cockroach.js` owns its direct behavior; `mapRuntime.state.cockroach` owns
its live state. No combat framework or additional objective counter is involved.
The small `rendering/cockroach-rendering.js` Canvas follows position, heading,
travelled distance and stun state. There is no health bar or death animation.

## Behavior and tuning

All gameplay parameters live in `cockroachConfig` in `core/game-config.js`.
Speeds use the same world-units-per-60-Hz-frame convention as marble physics.

| Parameter                                    | Initial value                      |
| -------------------------------------------- | ---------------------------------- |
| Body contact radius                          | 24 world units (marble radius: 29) |
| Ordinary scurry / harassment / retreat speed | 3 / 10.5 / 5.5                     |
| Initial quiet interval                       | 3 seconds                          |
| Initial approach timeout                     | 6 seconds                          |
| Escape / failed-approach / repel cooldown    | 6 seconds                          |
| Retreat / strong-hit stun                    | 2 seconds / 0.4 seconds            |
| Ordinary / attacking heading decisions       | 0.3 seconds / 0.1 seconds          |
| Maximum interception lead                    | 1/6 second (shorter up close)      |
| Food roaming radius / goo-edge margin        | 70 / 18 world units                |
| Outward attack kick / resulting speed cap    | 12 / 14                            |
| Strike recovery / escape distance            | 0.3 seconds / 480 world units      |
| Incoming marble speed needed to repel        | 7                                  |
| Maximum knockback / per-frame retention      | 12 / 0.9                           |
| Contact rearm gap                            | 8 world units                      |

Ordinary scurrying during the quiet interval is independent of the marble. It
heads toward the nearest active Cheerio or goo edge, then walks around that
resource. Food positions come directly from `kitchenDynamics.state.cheerios`,
including their current push offsets; inactive/eaten cereal and crumbs
are not attraction targets. Goo edges use the existing shared rotated ellipse
footprint. There is no copied target list or persistent food reference to reset.
If no accessible resource exists, the previous wandering behavior remains.
Foraging neither consumes food nor changes ant behavior or liquid physics.

When its timer is ready, it pursues the marble's projected position wherever the
player has moved in the kitchen. There is no distance gate that can leave a ready
cockroach wandering indefinitely. Attacks now run faster than moderate hunting
motion, but a marble at its normal top speed can still outrun it. More frequent
heading decisions and distance-limited prediction improve close interception.

A successful roach hit starts a sustained encounter. The insect braces for 0.3
seconds, then pursues another contact; it does not flee or start the six-second
cooldown after its own attack. Engagement has no timeout while the marble is
nearby. Putting more than 480 world units (about eight marble diameters) between
the centers ends it and resumes food/goo foraging with six seconds of quiet time.
A distant initial approach still has a six-second limit, so simply being far away
when it acquires a target does not immediately cancel the pursuit.

A strong incoming marble hit retains priority: stun, physical knockback, retreat,
and cooldown interrupt the encounter. Stun lasts 0.4 seconds, followed by a
two-second retreat. This deliberate counter-hit remains an alternative to escape.

Movement uses a local 120 Hz tick and interpolated marble positions. Timers and
obstacle decisions advance by simulation time, not rendered-frame count.
Prepared fork/spoon parts, rotated fixtures and the movable sponge all use the
existing collision queries. Blocked motion tries short side steps or turns back;
a sponge overlap is corrected on the insect. This is local avoidance, not a
promise of pathfinding through arbitrary future mazes.

## Contact rules

The physics hook runs after the marble's wall response and after the hazard-reset
early return. A swept circle catches fast passes, with an obstacle check between
bodies to prevent attacks through utensils. If `n` points from cockroach to
marble, the incoming marble component is `-dot(marbleVelocity, n)`. Contact must
also have positive relative closing speed.

A fresh incoming marble component of at least 7 wins over the cockroach attack:
it produces cockroach knockback of `min(incomingSpeed, 12)` away from the marble,
stun and cooldown, without damage. A weaker contact during harassment cancels
any incoming normal component, then adds an outward kick of 12: `velocity += n * (12 + max(0, incomingSpeed))`, capped
to total speed 14. A medium-speed approach therefore rebounds instead of
continuing into the roach. Tangential motion is retained subject to that cap.
Existing impact particles, marble squash and haptics provide contact feedback.
No contact projects the marble's position or creates a persistent pushing wall.

One latch covers the whole contact. It rearms only after the bodies separate by
more than 8 units, and the 0.3-second strike recovery must also expire before
another attack. While bodies still touch, the pursuing insect stops its own
locomotion instead of walking through the marble. It never blocks the marble's
position, so lateral steering remains possible beside a wall. Neither continuous
overlap nor successive physics substeps can repeat the effect. Strong separated
counter-hits still work during strike recovery. Weak incidental contact while
scurrying does not stun it.

Retry recreates every timer, impulse, contact, engagement and strike-recovery
field. Intro confinement,
hazard teleports and completed maps skip its processing. A map transition
replaces both actor state and canvas. Clearing the last ant leaves the cockroach
active while the player lingers; choosing Next room performs the transition.

## Validation and playtest

`npm test` includes deterministic behavior, collision, irregular-step movement,
objective, reset, authoring and fake-canvas tests. `npm run test:browser` also
exercises the real app's food-directed roaming, a cockroach shove,
repeated attacks, keyboard-driven escape/repel, Retry and actual ant crushes
followed by progression.
New deterministic coverage requires a pursuit starting 400 units behind a
moderately moving marble to make contact before timeout at 30, 60, 120 Hz and
irregular step partitions. Food tests cover staying nearby, pushed/consumed food,
goo-edge residency, unchanged attack/retreat/stun modes and cadence equivalence.
Stationary-target kitchen tests check acquisition at nearby/distant positions,
then sustained engagement without contact spam. Full physics tests let the marble
move under the shove and verify repeated separate impacts. Pressure regressions
cover the old timeout, distance escape, recovery cadence, wall contact and lateral
escape. The browser attack starts outside the former acquisition range. The controlled browser attack
fixtures place actors on clear floor; they do not establish hunting difficulty.

Inspect it through `npm run map:render -- kitchen-floor --phone` or live play.
On a physical phone, judge whether charges are readable, the shove disrupts
without feeling unfair, and a deliberate fast strike reliably creates breathing
room. In particular, judge whether the faster, more accurate encounters remain fair
while hunting ants, and whether the insect visibly belongs around food and goo;
escaping or a strong repel grants six seconds before another pursuit. Judge the
480-unit escape threshold and 0.3-second strike spacing in particular; an insect's
successful hit now deliberately maintains pressure. Test contacts near utensils
and the sponge, and check that antennae/legs remain clear and animation stays
smooth. Desktop Chrome
checks do not establish phone sensor, haptic, GPU or compositor performance.
