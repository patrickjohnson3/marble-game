# TODO

## Now

1. Validate the kitchen map on mobile after each visual-heavy change.
2. Tune water, goo, ice, and rough-patch feel against the marble speed.
3. Improve real-world map readability so objects look like what they represent.
4. Playtest the kitchen sponge's visible height versus collision, movement against other fixtures, and absorption. Sprite transparency already accounts for its apparent width; do not scale its CSS box directly to the hitbox width.
5. Finish stabilizing `real-world-maps` before merging.
6. Verify sensor handoffs and anchored pinch on all four mobile browser targets over HTTPS; see [the improvement pass notes](docs/improvement-pass.md). Check rotation after calibration and live sensor dropout next.
7. Add service-worker recovery tests for cached responses, failed-navigation fallback, bypassed requests, and cache-write failures.
8. Fix keyboard held-key bookkeeping and clear held input on focus loss.
9. Compare movement at 30/60/120 Hz before changing acceleration/drag integration; the combined simulation still varies with cadence.

## Later

1. Add another real-world map with matching obstacles and terrain.
2. Profile mobile performance after canvas or particle changes.
3. Add a few mobile-DPR visual regression baselines after the real-world-map visuals stabilize.
4. Split kitchen simulation tests from rendering tests only if the rendering suite becomes difficult to maintain; retain rendering integration coverage.

## Parking Lot

1. Height-map experiments.
2. Photorealistic asset pipeline.
3. More advanced camera modes.
4. Expand settings behavior coverage when justified, including speed, sensitivity, haptics, trail, retry, neutral, application, and persistence.
5. Consider enforcing the browser integration test in GitHub Actions without adding it to the portable pre-push hook.
