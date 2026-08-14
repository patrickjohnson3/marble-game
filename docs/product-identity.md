# Product Identity

## Bottom Line

No single mechanic is demonstrably unique. Tilt steering, marble physics, terrain friction, camera following, level progression, and procedural maps all exist elsewhere.

The project does have a distinctive product direction:

> **A marble exploring oversized real-world spaces where ordinary objects and materials behave recognizably.**

That combination is meaningfully different from the conventional wooden labyrinth and competitive marble-platformer alternatives. However, it is currently realized most convincingly in the kitchen maps.

I inspected `real-world-maps` at `2a1b8f9`, launched it at a mobile viewport, and reviewed its runtime behavior and map implementation.

## Differentiators

1. **Ordinary environments viewed at marble scale**

   The game uses kitchen floors, living rooms, parking lots, a sand lot, and a hockey rink rather than presenting every level as a wooden maze or abstract platform course. See [`map-data.js`](../maps/map-data.js).

   **Who benefits:** Players interested in playful exploration and recognizable environments.

   **Why it matters:** A fork, puddle, rug, parked car, or Cheerio can communicate behavior through prior real-world knowledge. The environment becomes more than decoration.

   **Defensibility:** Low currently. Themes are easy to copy, and several non-kitchen maps still rely heavily on generic rectangles and conventional terrain patches.

   **Lean into it:** Yes. Give every map bespoke objects and interactions before adding more themes. The kitchen should establish the minimum standard.

2. **The reactive kitchen ecosystem**

   The kitchen contains 34 pushable Cheerios, crumbs, 10 independently moving ants, utensils, water, and goo. Ants locate and consume Cheerios; the marble pushes cereal; cereal collides with fixtures and responds differently on water, goo, ice, and rough ground. Ants can be squished and subsequently produce splat feedback. See [`kitchen-dynamics.js`](../core/kitchen-dynamics.js) and [`game-loop.js`](../core/game-loop.js).

   The surveyed alternatives advertise elaborate obstacles, but not this kind of interacting miniature ecosystem. That is not proof that no obscure game has it, but it is the strongest difference found.

   **Who benefits:** Players who enjoy experimentation, environmental reactions, and unscripted moments.

   **Why it matters:** The player can make something happen rather than merely follow a prescribed route.

   **Defensibility:** Medium. Ants or pushable cereal are individually reproducible; a polished network of object-material interactions is substantially harder to duplicate.

   **Lean into it:** Strongly. This is the best candidate for the project’s core. Expand relationships between existing objects instead of adding isolated obstacle types.

3. **Exploration-first rather than score-first play**

   The product has no score, best-time system, leaderboard, or level timer. The goal advances the environment after a controlled hold, while the goal arrow is disabled by default. See [`goal-controller.js`](../core/goal-controller.js) and [`settings-config.js`](../settings/settings-config.js).

   This contrasts with alternatives centered on beating times, clearing short rounds, earning scores, or competing. [Marble Maze](https://apps.apple.com/us/app/marble-maze-tilt-labyrinth/id6762085754) explicitly races against a time limit; [MarbleTilt](https://play.google.com/store/apps/details?hl=en&id=com.mitosgames.marbletilt) emphasizes personal best times; [Marbloid](https://www.marbloid.com/) uses points, ranks, missions, and multipliers.

   **Who benefits:** Players wanting calm physical play rather than performance pressure.

   **Why it matters:** It leaves attention available for discovering environments and experimenting with interactions.

   **Defensibility:** Low technically, but potentially strong as positioning.

   **Lean into it:** Yes. Favor discoveries, environmental events, and playful objectives over timers, stars, and ranking systems.

4. **Material behavior expressed through multiple senses**

   Water, goo, rough ground, ice, and impacts alter velocity while also producing distinct visual effects and haptic patterns. Kitchen objects inherit surface-specific movement behavior. See [`game-config.js`](../core/game-config.js), [`game-loop.js`](../core/game-loop.js), and [`haptics.js`](../core/haptics.js).

   Materials themselves are not unique: [Marbletron](https://11000ad.itch.io/marbletron) advertises traction-specific zones, while [Marble It Up! Ultra](https://marbleitup.com/) has bouncy floors, shifting gravity, and power-ups. The difference is the coupling between material physics, visual reaction, haptics, and movable kitchen objects.

   **Who benefits:** Mobile players relying on feel and immediate feedback.

   **Why it matters:** Materials become understandable through experience instead of labels.

   **Defensibility:** Medium-low. The effects are reproducible, but consistency across many interacting objects can become a meaningful content advantage.

   **Lean into it:** Yes, as a design rule: every visible material should look, feel, and affect nearby objects like the thing it represents.

## Not Genuine Differentiators

- **Tilt controls:** Fundamental category behavior. [Labyrinth 2](https://apps.apple.com/us/app/labyrinth-2/id307758884), [Classic Labyrinth 3D](https://play.google.com/store/apps/details?id=de.pictofun.labyrinthone), and many others already provide it.
- **Large level count or obstacle variety:** Labyrinth 2 offers many mechanics, community levels, an editor, multiplayer, and ghost runs.
- **Pinch, pan, and following camera:** Useful support for large maps, but readily reproducible.
- **PWA, offline caching, fullscreen, wake lock, keyboard fallback, calibration, and settings:** Valuable accessibility and distribution work, not product identity.
- **Procedural generation:** The shipped sequence contains frozen generated variants, not a visible endless-generation experience.
- **Marble glint, shadows, trails, particles, and debug overlays:** Polish or development tooling.
- **The five-second intro pen:** An onboarding device, not a reason to choose the game.

## Recommendation

Position and develop this as **“a marble loose in real places”**, not as another labyrinth game. Concentrate on fewer environments with recognizable objects, believable material interactions, and small emergent systems. The kitchen currently demonstrates that product far better than the classic and generated maze content.
