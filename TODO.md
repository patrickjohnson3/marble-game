# TODO

## Now

1. Validate the kitchen map on mobile after each visual-heavy change.
2. Tune water, goo, ice, and rough-patch feel against the marble speed.
3. Improve real-world map readability so objects look like what they represent.
4. Rework the kitchen sponge-and-water interaction: correct the sponge's visual scale, align collision with its visible shape, and tune movement and absorption.
5. Finish stabilizing `real-world-maps` before merging.
6. Strengthen camera pinch tests for zoom direction, scale limits, and behavior before and after map release.
7. Add service-worker recovery tests for cached responses, failed-navigation fallback, bypassed requests, and cache-write failures.

## Later

1. Add another real-world map with matching obstacles and terrain.
2. Add focused tests for any new procedural generation helpers.
3. Profile mobile performance after canvas or particle changes.
4. Add a few mobile-DPR visual regression baselines after the real-world-map visuals stabilize.
5. Split kitchen simulation tests from rendering tests only if the rendering suite becomes difficult to maintain; retain rendering integration coverage.

## Parking Lot

1. Height-map experiments.
2. Photorealistic asset pipeline.
3. More advanced camera modes.
4. Expand settings behavior coverage when justified, including speed, sensitivity, haptics, trail, retry, neutral, application, and persistence.
5. Consider enforcing the browser integration test in GitHub Actions without adding it to the portable pre-push hook.
