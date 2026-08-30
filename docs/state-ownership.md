# State Ownership

Keep runtime state ownership simple and local.

- `state` owns live gameplay state: marble movement, game phase, input state, camera state, physics tuning, haptic cooldowns, and intro release state.
- `state.input` owns input-derived state: keyboard direction, tilt readings, sensor status, and calibration.
- `mapRuntime.state.activeMap` owns a fresh mutable copy of the current map, including world dimensions, spawn, goal, and elements. Derived terrain and obstacle collections reference those same runtime elements; authored map definitions remain unchanged across activations. The surrounding map runtime state owns goal progress.
- `kitchenDynamics.state` owns pushable cereal, ants, kitchen collision scratch, and kitchen interaction events. Renderers may cache references to these objects but must not advance them.
- `settings` owns user preferences. Applying settings projects those preferences into runtime state or renderers.
- Renderers own disposable render caches only: DOM pools, sampled FPS values, kitchen dirty rectangles, trail points, particles, and visual cooldowns. They read active-map facts from `mapRuntime.state` instead of copying them into renderer-local state.
- Controllers should mutate the owner they are responsible for and avoid keeping gameplay facts in controller-local variables.

Avoid adding global stores, reducers, event buses, or broad state-machine libraries unless the game grows past direct object ownership.
