# Living-room materials and mouse art

The assets below were generated with the built-in `image_gen` tool and
delivered as quality-90 WebP (Pillow/libwebp, `method=6`, `exact=True`), matching
our parking-asset convention. Dimensions and the mouse alpha channel are
unchanged; RGB compression is lossy. Re-encode from the original lossless source
in Git history rather than repeatedly compressing the delivery files. No new
runtime dependency is required.

- `assets/sprites/shag.webp`: 1254 × 1254, 488,562 bytes. Tiled at 560 world
  pixels, blended over the existing sage backing, clipped exactly to the rough
  terrain rectangle and baked into its existing static canvas. It adds no
  per-frame drawing. Late image loading repaints only the current map contents.
- `assets/sprites/mouse.webp`: 1254 × 1254 with alpha, 272,526 bytes. A shared
  body/head sprite drawn into a local canvas sized from the actor radius
  (480 × 480 at radius 88). Draw bounds
  account for transparent padding to keep the fur near the
  tapered contact footprint. Tail, feet and sniffing whiskers animate in Canvas; the
  thin tail/whiskers remain cosmetic. Health feedback stays horizontal and the
  defeated pose stays still. A simple shaded fallback works before loading or
  when the asset is unavailable.

- `assets/sprites/oak-floor.webp`: 724 × 2172, 298,210 bytes. A repeating
  hardwood material on the existing world-sized CSS floor element. Four boards
  per 840px-wide strip preserve the previous 210px board width, with natural
  grain and staggered end joints. Each strip spans the room length and repeats
  only horizontally, avoiding abrupt horizontal material seams. No additional
  canvas or per-frame work.

The three images total 1,059,298 bytes (1.01 MiB), down from 4,759,588 bytes:
3,700,290 fewer bytes for offline installation and each release download.
The runtime-asset test allows 2 MiB combined, leaving room for art revisions
while catching accidental lossless re-exports.
Decoded RGBA storage remains up to 18 MiB; encoding does not reduce canvas
allocation. The mouse canvas uses about 0.88 MiB. The texture is deliberately
subdued to preserve marble/mouse readability. Real-phone judgment is still
needed for texture density, perceived gait, hunting difficulty and smoothness.
The mouse body is approximately 175 × 94 world pixels beside a 58px-diameter
marble. The square source image now draws square, correcting the old 102 × 152
stretch that made it look broad. Feet, fallback and shadow follow the narrower
body. Three overlapping circles fit the rump, torso and head; the 88-unit
bounding radius still controls roaming clearance, canvas extent and health-bar
width. Tail and whiskers do not block the marble. Health, damage, carpet drag and
map geometry are unchanged. Movement and timed post-hit flight are described in
[map authoring](map-authoring.md).

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

### Wood floor

> Create a TALL NARROW PORTRAIT game texture asset, aspect ratio 1:3 (for example
> 832 pixels wide by 2496 pixels tall). Exactly orthographic overhead view of
> FOUR parallel vertical oak floorboards across the width of the entire tall
> image. This is a long hardwood flooring strip for a realistic top-down marble
> game, with continuous grain running top to bottom and a few subtle staggered
> board-end joints at different heights. Boards have realistic proportions: each
> roughly 12 times longer than its width. Warm medium-light honey brown natural
> oak, fine organic wood grain with gentle growth-ring curves and restrained
> pores, modest matte/satin wear, slight varied tones between the four planks.
> Restrained material contrast, narrow believable seams, no exaggerated dark
> gaps, no harsh bright seam edges. Tiny understated scratches, no prominent
> repetitive knots. Lighting completely even and diffuse from above. Fill every
> edge of the TALL PORTRAIT image with wood. Horizontal edges should meet as a
> believable board seam when this strip repeats SIDE BY SIDE; it will NOT repeat
> vertically. Preserve natural fine wood grain proportions; do not create a
> square image or stretch short grain vertically. No furniture, rug, objects,
> animals, writing, shadow, gradient illumination, vignette, perspective or
> room view.
