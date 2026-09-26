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
| Ordinary scurry / harassment / retreat speed | 3 / 6.5 / 5.5                      |
| Initial quiet interval                       | 7 seconds                          |
| Harassment acquisition range                 | 900 world units                    |
| Maximum pursuit                              | 2.5 seconds                        |
| Post-contact or failed-pursuit cooldown      | 6 seconds                          |
| Retreat / strong-hit stun                    | 2 seconds / 0.4 seconds            |
| Heading decisions / interception lead        | 0.3 seconds / 1/6 second           |
| Marble attack impulse / resulting speed cap  | 6 / 14                             |
| Incoming marble speed needed to repel        | 7                                  |
| Maximum knockback / per-frame retention      | 12 / 0.9                           |
| Contact rearm gap                            | 8 world units                      |

Ordinary scurrying is independent of the marble. When its timer is ready and
the marble is in range, it briefly pursues the marble's projected position.
A hit or chase timeout sends it into retreat, then ordinary scurrying. Cooldown
continues during retreat/stun, leaving additional quiet time afterward. A
stunned cockroach first drifts under knockback, then retreats. A distant player
does not attract a continuously homing insect.

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
stun and cooldown, without damage. A weaker contact during harassment instead
adds `6 * n` to marble velocity, capped to speed 14, and immediately retreats.
Existing impact particles, marble squash and haptics provide contact feedback.
No contact projects the marble's position or creates a persistent pushing wall.

One latch covers the whole contact. It rearms only after the bodies separate by
more than 8 units; neither continuous overlap nor successive physics substeps
can repeat the effect. Weak incidental contact while scurrying does not stun it.

Retry recreates every timer, impulse and contact field. Intro confinement,
hazard teleports and completed maps skip its processing. A map transition
replaces both actor state and canvas; final-ant completion needs no cockroach
state change.

## Validation and playtest

`npm test` includes deterministic behavior, collision, irregular-step movement,
objective, reset, authoring and fake-canvas tests. `npm run test:browser` also
exercises a real cockroach shove, keyboard-driven repel, retreat, Retry and
actual ant crushes followed by progression. The controlled browser attack
fixtures place actors on clear floor; they do not establish hunting difficulty.

Inspect it through `npm run map:render -- kitchen-floor --phone` or live play.
On a physical phone, judge whether charges are readable, the shove disrupts
without feeling unfair, and a deliberate fast strike reliably creates breathing
room. In particular, judge encounter frequency: the 900-unit acquisition radius
and independent roaming deliberately permit longer quiet periods when the
cockroach wanders away. Test contacts near utensils and the sponge, and check
that antennae/legs remain clear and animation stays smooth. Desktop Chrome
checks do not establish phone sensor, haptic, GPU or compositor performance.
