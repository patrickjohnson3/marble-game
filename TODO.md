# TODO

## Now

1. Validate the kitchen map on mobile after each visual-heavy change.
2. Tune water, goo, ice, and rough-patch feel against the marble speed.
3. Improve real-world map readability so objects look like what they represent.
4. Playtest the kitchen sponge's visible height versus collision, movement against other fixtures, and absorption. Sprite transparency already accounts for its apparent width; do not scale its CSS box directly to the hitbox width.
5. Verify sensor handoffs and anchored pinch on all four mobile browser targets over HTTPS; see [the improvement pass notes](docs/improvement-pass.md). Check rotation after calibration, live sensor dropout, and returning from an app switch or screen lock; the game should remain paused until Resume without changing neutral.
6. Investigate and fix the reported failure to switch the installed PWA to landscape after removing the manifest's portrait lock. Reproduce on a physical device, record OS/browser and rotation-lock state, and compare fresh versus updated installations; verify portrait/landscape play after the fix.
7. Add service-worker recovery tests for cached responses, failed-navigation fallback, bypassed requests, and cache-write failures.
8. Compare movement at 30/60/120 Hz before changing acceleration/drag integration; the combined simulation still varies with cadence.

## Later

1. Add another real-world map with matching obstacles and terrain.
2. Profile mobile performance after canvas or particle changes.
3. Add a few mobile-DPR visual regression baselines after the real-world-map visuals stabilize.
4. Split kitchen simulation tests from rendering tests only if the rendering suite becomes difficult to maintain; retain rendering integration coverage.
5. Add a live steering-dot and neutral-zone preview beside Set neutral in Settings, using the existing input and calibration state. Show steering relative to the player's holding angle, not physical level; preserve keyboard fallback and indicate unavailable sensor input.
6. Give metal utensils, wooden furniture, and the sponge distinct impact feedback using existing visual and optional haptic effects, scaled by impact strength. Carry material identity through collision feedback, preserve physics and throttling, and keep responses readable without vibration.
7. Teach existing interactions through small, naturally placed encounters: pushing cereal changes ant gathering, wood versus shag changes approach speed, and direct mouse hits outperform glancing bumps. Make cause and effect easy to observe without compulsory tutorials, new mechanics, or a separate progression system.
8. Extend the existing map preview and browser-test workflow with named, repeatable encounter scenarios, such as a cockroach attack beside a utensil or a mouse hit from wood versus shag. Reuse the real simulation and renderer with controlled starting state, input, and cadence; avoid a separate editor or configuration system, and retain hands-on playtesting for feel.
9. Add an optional whole-game tempo setting that slows marble motion, creatures, and gameplay timers together while keeping input and interface feedback responsive. Unlike lowering marble top speed, retain impact effectiveness through simulation velocity; follow the cadence checks in Now and verify timing consistency across systems.

## Parking Lot

1. Height-map experiments.
2. Photorealistic asset pipeline.
3. More advanced camera modes.
4. Expand settings behavior coverage when justified, including speed, sensitivity, haptics, trail, retry, neutral, application, and persistence.
5. Consider enforcing the browser integration test in GitHub Actions without adding it to the portable pre-push hook.
6. Experiment with nearby hazard recovery instead of returning to map spawn, starting with one safe approach-side recovery point at the parking-lot drain. Clear velocity and preserve room state; validate clearance and contact resets, prevent repeated falls or shortcuts, and playtest before building a general checkpoint system.
