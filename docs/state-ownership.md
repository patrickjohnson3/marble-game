# State Ownership

Keep runtime state ownership simple and local.

- `state` owns live gameplay state: marble movement, game phase, input state, camera state, physics tuning, haptic cooldowns, and intro release state.
- `state.input` owns input-derived state: held keyboard keys and derived direction, tilt readings, sensor status, and calibration.
- `mapRuntime.state.activeMap` owns a fresh mutable copy of the current map, including world dimensions, spawn, objective, named regions, clusters, scenery, legacy goal, and elements. Terrain collections reference runtime elements; prepared collision shapes derive from them. Authored map definitions remain unchanged across activations. The surrounding map runtime state owns goal hold progress, departure readiness, and the completion latch.
- `mapRuntime.state.mouse` owns the optional living-room mouse: health, movement, post-hit flight timer, contact latch, and hit reaction. `activeMap.mouse` is only its authored spawn/roaming description. Map activation/Retry recreates the actor; zero health is the sole defeated state.
- `mapRuntime.state.cockroach` owns the optional kitchen antagonist: movement, behavior timers, fixed-tick remainder, knockback, contact latch, close engagement, and strike recovery. `activeMap.cockroach` only specifies its spawn. Retry recreates it; changing maps removes it. It has no health or defeated state and is never an objective target. Quiet-time foraging reads live cereal positions from `kitchenDynamics.state` and goo from the map terrain; it stores no duplicate food or spill targets.
- `kitchenDynamics.state` owns pushable cereal, ants, kitchen collision scratch, and kitchen interaction events. Renderers may cache references to these objects but must not advance them.
- Eliminate progress reads `kitchenDynamics.state.ants` and each ant's `alive` flag directly. There is no separate objective kill counter. Clearing the ants latches `departureReady` for one-time feedback and the Next room action; `goalCompleted` stays false so the room remains playable until departure. A hold/hazard reset does not erase readiness; map activation and Retry do. Reach completion reads the named region in the active map and, when `defeat: "mouse"` is declared, the authoritative mouse health; Retry restores actors and clears the map runtime completion latch.
- `settings` owns user preferences. Applying settings projects those preferences into runtime state or renderers.
- Renderers own disposable render caches only: DOM pools, sampled FPS values, kitchen dirty rectangles, trail points, particles, and visual cooldowns. They read active-map facts from `mapRuntime.state` instead of copying them into renderer-local state.
- Controllers should mutate the owner they are responsible for and avoid keeping gameplay facts in controller-local variables.

Avoid adding global stores, reducers, event buses, or broad state-machine libraries unless the game grows past direct object ownership.
