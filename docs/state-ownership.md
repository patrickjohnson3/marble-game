# State Ownership

Keep runtime state ownership simple and local.

- `state` owns live gameplay state: marble movement, game phase, input state, camera state, physics tuning, haptic cooldowns, and intro release state.
- `state.input` owns input-derived state: keyboard direction, tilt readings, sensor status, and calibration.
- `mapRuntime.state` owns active map state: current map, world dimensions, spawn, goal, goal progress, terrain collections, obstacle collections, and their bounds.
- `kitchenDynamics.state` owns pushable cereal, ants, kitchen collision scratch, and kitchen interaction events. Renderers may cache references to these objects but must not advance them.
- `settings` owns user preferences. Applying settings projects those preferences into runtime state or renderers.
- Renderers own disposable render caches only: DOM pools, sampled FPS values, active-map render references, kitchen dirty rectangles, trail points, particles, and visual cooldowns.
- Controllers should mutate the owner they are responsible for and avoid keeping gameplay facts in controller-local variables.

Avoid adding global stores, reducers, event buses, or broad state-machine libraries unless the game grows past direct object ownership.
