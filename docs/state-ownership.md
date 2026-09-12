# State Ownership

Keep runtime state ownership simple and local.

- `state` owns live gameplay state: marble movement, game phase, input state, camera state, physics tuning, haptic cooldowns, and intro release state.
- `state.input` owns input-derived state: keyboard direction, tilt readings, sensor status, and calibration.
- `mapRuntime.state.activeMap` owns a fresh mutable copy of the current map, including world dimensions, spawn, objective, named regions, clusters, scenery, legacy goal, and elements. Terrain collections reference runtime elements; prepared collision shapes derive from them. Authored map definitions remain unchanged across activations. The surrounding map runtime state owns goal hold progress and the completion latch.
- `kitchenDynamics.state` owns pushable cereal, ants, kitchen collision scratch, and kitchen interaction events. Renderers may cache references to these objects but must not advance them.
- Eliminate progress reads `kitchenDynamics.state.ants` and each ant's `alive` flag directly. There is no separate objective kill counter. Reach completion reads the named region in the active map; Retry restores actors and clears the map runtime completion latch.
- `settings` owns user preferences. Applying settings projects those preferences into runtime state or renderers.
- Renderers own disposable render caches only: DOM pools, sampled FPS values, kitchen dirty rectangles, trail points, particles, and visual cooldowns. They read active-map facts from `mapRuntime.state` instead of copying them into renderer-local state.
- Controllers should mutate the owner they are responsible for and avoid keeping gameplay facts in controller-local variables.

Avoid adding global stores, reducers, event buses, or broad state-machine libraries unless the game grows past direct object ownership.
