# Living-room rug and mouse art

The two assets below were generated with the built-in `image_gen` tool and
packaged as lossless WebP, with decoded pixel equality checked against the PNG
originals. No new runtime dependency is required.

- `assets/sprites/shag.webp`: 1254 × 1254, 2,188,606 bytes. Tiled at 560 world
  pixels, blended over the existing sage backing, clipped exactly to the rough
  terrain rectangle and baked into its existing static canvas. It adds no
  per-frame drawing. Late image loading repaints only the current map contents.
- `assets/sprites/mouse.webp`: 1254 × 1254 with alpha, 843,698 bytes. A shared
  body/head sprite drawn into the existing 240 × 240 mouse canvas. Draw bounds
  account for transparent padding to keep the fur near the unchanged circular
  contact footprint. Tail, feet and sniffing whiskers animate in Canvas; the
  thin tail/whiskers remain cosmetic. Health feedback stays horizontal and the
  defeated pose stays still. A simple shaded fallback works before loading or
  when the asset is unavailable.

The images add about 2.89 MiB of transfer/cache data and up to 12 MiB of decoded
RGBA storage. Canvas backing storage is unchanged. The texture is deliberately
subdued to preserve marble/mouse readability. Real-phone judgment is still
needed for texture density, perceived gait, hunting difficulty and smoothness.
Mouse movement speeds, damage, collision radius, carpet drag and map geometry
are unchanged. The short startle/pivot pause makes fast approaches more catchable.

## Generation prompts

### Rug

> Use case: photorealistic-natural. Asset type: seamless square material texture
> for a top-down Canvas marble game, not a scene or mockup. Create a realistic
> close-up of dense, slightly worn sage-gray shag carpet pile seen exactly
> perpendicular from above. Thousands of overlapping soft twisted wool/polyester
> yarn strands and tiny tufts, naturally clumped and leaning in subtly different
> directions, gentle fiber-to-fiber occlusion and matte highlights. Low contrast,
> desaturated gray-green coloration. It must look like soft thick domestic
> carpet, not grass, sparse hairs, noodles, or drawn strokes. Even diffuse neutral
> indoor lighting, no large cast shadows, no perspective, no border/backing/room/
> furniture, no text. Fill the entire image edge to edge with one homogeneous
> material; no obvious patches or memorable marks, suitable for repeating in both
> directions without visible seams. Aim for roughly 100-150 small tufts across
> the width. This image will be used at small scale behind a blue marble and a
> mouse; keep it quiet, natural, and tactile.

### Mouse

> Create a realistic game sprite asset: a small brown-gray house mouse seen
> exactly from above, pointing toward the RIGHT edge of the image (+X), isolated
> on a fully transparent background. This is the BODY/HEAD layer of an animated
> mouse: tail and feet will be animated separately in the game, so omit the tail
> and keep paws tucked underneath the fur, invisible. Natural dense fine agouti
> fur, subtly mottled warm brown-gray, softly lit rounded haunches, narrow
> shoulders tapering to a pointed little muzzle, small glossy black eyes on
> either side, delicate modest translucent brown-pink ears with fur around their
> bases, tiny muted pink nose, fine short whiskers. Animal proportions and
> photorealistic tactile fur, absolutely not a cartoon, mascot, teddy bear, vector
> graphic or outlined shape. A slightly plump compact mouse in a natural crouched
> top-down posture; body-and-head silhouette about 1.2 times as long as wide,
> softly rounded haunches at the left, small tapered head at the right. Symmetric
> neutral running pose ready for rotation in a top-down game. Body fills roughly
> 88% of the square image width and 75% of height, with transparent padding evenly
> around it. Subtle diffuse indoor overhead illumination, no scenery, no floor,
> no props, no cast shadow, no text or UI, no dramatic directional lighting. This
> will render only about 90 pixels long; prioritize natural silhouette and fur
> mass with eyes/nose/ears legible at small scale.
