# Design Borrowings

## Assessment

The current vision is explicit: **“a marble loose in real places”**, emphasizing exploration, recognizable materials, and emergent interactions rather than scores or timers. See [`product-identity.md`](product-identity.md).

The most useful adjacent categories are physics sandboxes, field-observation tools, mapping software, digital toys, geocaching, and creative applications.

## Recommended Transplants

1. **Object-interaction matrix**

   **Origin:** Physics sandboxes such as [Teardown](https://teardowngame.com/) and object-driven digital toys such as [Toca Boca World](https://www.tocaboca.com/toca-boca-world). Their environments support combinations of objects rather than isolated scripted obstacles.

   **Problem solved:** Outside the kitchen, many objects are recognizable visually but behave like generic walls. The kitchen already proves the concept with ants, cereal, terrain, and utensils in [`kitchen-dynamics.js`](../core/kitchen-dynamics.js).

   **Analogy:** Players naturally experiment when ordinary objects imply familiar consequences. **Breakdown:** This game cannot afford Teardown-scale general physics on mobile.

   **Cost:** High. **Risk:** Performance and combinatorial bugs. **Fit:** Excellent. Implement a few deliberate relationships per map, such as ants avoiding water or a sponge affecting a puddle, rather than generalized simulation.

2. **Automatic field journal**

   **Origin:** [iNaturalist observations and Life Lists](https://www.inaturalist.org/pages/getting-started-inaturalist-canada-en) and the [New Pokémon Snap Photodex](https://www.nintendo.com/us/whatsnew/explore-lush-scenery-and-take-pictures-of-pokemon-in-new-pokemon-snap/).

   **Problem solved:** Exploration currently leaves no durable record. Players must remember which objects and behaviors they encountered.

   **Analogy:** The interesting unit is an observation: finding a fork, creating a ripple, pushing cereal into goo, or seeing an ant eat. **Breakdown:** Manual photography would fight the tilt controls, and a completion checklist would undermine relaxed exploration.

   **Cost:** Medium. **Risk:** Turning discovery into compulsory collection. **Fit:** Excellent if entries unlock automatically, contain no score, and remain in Settings.

3. **Layered, on-demand hints**

   **Origin:** [Geocaching](https://www.geocaching.com/help/index.php?id=102&pg=kb.chapter&pgid=437), where navigation, descriptions, recent activity, and explicit hints provide progressively stronger assistance.

   **Problem solved:** With the goal arrow off by default, players can become genuinely lost on large maps.

   **Analogy:** Both experiences involve freely searching a physical space for a known destination. **Breakdown:** The goal should not become a GPS waypoint that removes exploration.

   **Cost:** Low. **Risk:** Low. **Fit:** Strong. Offer an environmental clue first, then direction, with the existing arrow as the final explicitly requested aid.

4. **Exploration history map**

   **Origin:** [Strava Personal Heatmaps](https://support.strava.com/en-us/articles/15402028-personal-heatmaps), which visualize territory a user has traversed.

   **Problem solved:** The current optional trail lasts only 2.5 seconds. It cannot show which parts of an arbitrary-size map remain unexplored.

   **Analogy:** Both record movement through space. **Breakdown:** A permanent trail on the gameplay view would add clutter and invite completionist path painting.

   **Cost:** Medium. **Risk:** Canvas cost and visual noise. **Fit:** Strong if shown only in a paused map overview or journal, using a coarse visited-cell grid.

5. **Visited-places library**

   **Origin:** Location lists in Geocaching and the location-oriented structure of Toca Boca World.

   **Problem solved:** Progression immediately advances to the next map, with no player-facing way to revisit a favorite environment.

   **Analogy:** The maps are framed as places rather than disposable puzzle levels. **Breakdown:** A conventional level-select grid would weaken the sense of travel and expose unfinished maps.

   **Cost:** Medium. **Risk:** Persistence migration and invalid runtime restoration. **Fit:** Strong after several maps meet the kitchen’s quality standard. Unlock places through discovery and list them by environment name, not difficulty.

6. **Conditional environmental behaviors**

   **Origin:** New Pokémon Snap rewards observing creatures behaving differently under environmental conditions.

   **Problem solved:** Ants currently seek the nearest cereal deterministically. Once understood, the ecosystem has few surprises.

   **Analogy:** Small behaviors make a place feel inhabited and reward attention. **Breakdown:** Random, time-limited events could become frustrating or encourage waiting.

   **Cost:** Medium to high. **Risk:** Nondeterministic tests and increased simulation work. **Fit:** Strong when behaviors are caused by player actions: ants rerouting around water, grouping around cereal, or abandoning food trapped in goo.

7. **Explicit camera recentering**

   **Origin:** Mapping software such as [Google Maps](https://support.google.com/maps/answer/9770907?hl=en) exposes a familiar “return to my location” command after map exploration.

   **Problem solved:** After a two-finger pan, camera following currently resumes through a hidden cooldown in [`camera-gestures.js`](../input/camera-gestures.js). That transition can feel arbitrary.

   **Analogy:** The marble is the player’s current location. **Breakdown:** Another permanent button would compete with the sparse play surface.

   **Cost:** Low. **Risk:** Low. **Fit:** Strong. Show a temporary recenter icon only after manual camera movement and let the player explicitly return.

8. **Material-specific collision vocabulary**

   **Origin:** Teardown uses different controller feedback for glass, wood, concrete, and metal, according to the developer’s [PlayStation description](https://blog.playstation.com/?p=380039).

   **Problem solved:** A spoon, sponge, outer wall, and tile can currently produce broadly similar impact feedback.

   **Analogy:** The phone is acting like a physical tray, so tactile material identity reinforces the central illusion. **Breakdown:** Mobile vibration APIs are much coarser and less consistently available than console haptics.

   **Cost:** Low to medium. **Risk:** Device inconsistency and annoying patterns. **Fit:** Strong as progressive enhancement, never as required gameplay information.

9. **Short-lived experiment snapshots**

   **Origin:** Creative tools such as [Photoshop History](https://helpx.adobe.com/photoshop/desktop/get-started/set-up-toolbars-panels/manage-image-states.html) let users experiment and return to a known state.

   **Problem solved:** `retry map` resets the entire environment; there is no recovery after an interesting but unwanted interaction.

   **Analogy:** Both support experimentation with mutable state. **Breakdown:** Undoing physical events can feel artificial, and the game currently has too little irreversible state to justify serialization complexity.

   **Cost:** High. **Risk:** State-ownership and restore bugs. **Fit:** Conditional, not recommended now.

10. **Clean postcard capture**

    **Origin:** Photo modes and New Pokémon Snap’s album workflow preserve unusual emergent moments.

    **Problem solved:** Players can encounter memorable ant, cereal, water, or goo arrangements but can only capture them with the browser UI visible.

    **Analogy:** The product creates miniature scenes worth sharing. **Breakdown:** A full photography system would distract from tilt play and duplicate the phone’s screenshot capability.

    **Cost:** Low for a HUD-free paused capture; high for an editor. **Risk:** Feature drift. **Fit:** Moderate later; only the minimal capture state fits.

## Best Sequence

The best product-value sequence is:

1. Object-interaction matrix.
2. Automatic field journal.
3. Layered hints.
4. Explicit camera recentering.
5. Exploration history once several maps have sufficient content.

Avoid snapshots, a full photo editor, user-generated maps, achievements, and collectible counts for now. They add infrastructure or extrinsic goals without strengthening the project’s real-world exploration identity.
