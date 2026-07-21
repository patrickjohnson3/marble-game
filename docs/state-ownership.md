# State Ownership

Keep runtime state ownership simple and local.

- `state` owns live gameplay state: marble movement, game phase, input state, camera state, physics tuning, haptic cooldowns, and intro release state.
- `state.input` owns input-derived state: keyboard direction, tilt readings, sensor status, and calibration.
- `mapRuntime.state` owns active map state: current map, spawn, goal, goal progress, terrain arrays, obstacle arrays, and spatial indexes.
- `settings` owns user preferences. Applying settings projects those preferences into runtime state or renderers.
- Renderers own disposable render caches only: DOM pools, sampled FPS values, terrain refs, trail points, particle timers, and cooldowns.
- Controllers should mutate the owner they are responsible for and avoid keeping gameplay facts in controller-local variables.

Avoid adding global stores, reducers, event buses, or broad state-machine libraries unless the game grows past direct object ownership.
