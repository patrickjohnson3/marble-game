# Parking-lot bitmap assets

These project assets were generated with the built-in `image_gen` tool. No CLI/API fallback, external stock photography, or new runtime dependency was used. The selected outputs were encoded as quality-90 WebP for runtime delivery, preserving dimensions and verifying that the car alpha channel remained byte-for-byte identical. These files live in `assets/sprites/`; their original PNG outputs remain under `/home/pjohnson/.codex/generated_images/01a0df63-9709-7b33-b12b-b51f2622cd9c/`.

## Asphalt

`assets/sprites/parking-asphalt.webp` is an opaque RGB, 1254 × 1254 WebP (711,992 bytes). It depicts evenly lit, weathered aggregate with no markings or baked-in object shadows. Use it as a world-anchored background repeat; authored parking lines and objects belong above it. It is a natural-texture repeat, not a guarantee of pixel-identical opposite edges. Inspection found no broad lighting seam: 32-pixel edge-strip luminance averages range from 91.2 to 92.7 on the 0–255 scale.

Original output: `exec-78919f20-8908-417b-a709-2e43a0417939.png`.

Generation prompt:

> Use case: photorealistic-natural. Asset type: seamless repeatable bitmap surface material for a mobile top-down marble game. Generate one square, tileable, quiet medium-charcoal asphalt texture, photographed exactly straight down with orthographic flat perspective. Dry, slightly weathered parking-lot tarmac with finely embedded muted gray and warm brown aggregate, subtle variation in worn bitumen, low contrast and realistic physical detail. Broad even overcast light everywhere, completely uniform illumination to all four edges; no vignette, no directional shading. This image is the ground itself filling the entire square edge to edge, no border, no text, no roads or markings, no vehicles, no leaves, no oil stains, no large cracks, no potholes, no cast shadows, no scene or perspective. Small low-contrast grains only; neither glittering nor black noisy speckle. All four edges should repeat seamlessly. Target 1024x1024 square image.

## Car

`assets/sprites/parking-car.webp` is a true RGBA, 845 × 1860 WebP (244,540 bytes). The car points toward image top. Its lighting is neutral enough to rotate with the authored fixture. It has no baked-in ground plane or external cast shadow.

Alpha bounds at a threshold of 128 are `(21, 9)` through `(824, 1842)`, with the latter coordinates exclusive. That gives an 803 × 1833 visible-body crop; use the same framing when aligning the fixture silhouette and collision footprint. Fainter anti-aliasing reaches `(15, 0)` through `(831, 1848)`. The front and rear corners are rounded, so a plain enclosing rectangle would overstate the corners. Representative opaque horizontal spans in the original image are:

| Image y | Left x | Right x (inclusive) |
| ------- | ------ | ------------------- |
| 37      | 250    | 595                 |
| 93      | 158    | 686                 |
| 186     | 84     | 760                 |
| 372     | 31     | 813                 |
| 930     | 28     | 816                 |
| 1395    | 23     | 821                 |
| 1674    | 57     | 787                 |
| 1767    | 102    | 742                 |
| 1823    | 216    | 628                 |

Original output: `exec-ef4b13de-4559-402b-8d1a-d3446686aa1a.png`.

Generation prompt:

> Use case: product-mockup. Asset type: realistic transparent game sprite for a top-down parking-lot marble game. Generate a single generic compact five-door hatchback car, muted silver-blue paint, slightly dusty everyday used-car finish but intact. Camera exactly vertically overhead, true orthographic plan view centered on the car; front bumper pointing straight to TOP of image, rear bumper to bottom. Bilaterally symmetric correct vehicle proportions about 1:2.2 body width:length. Include realistically shaped windshield/rear glass and dark side windows, roof, subtle hood crease, realistic integrated headlights/taillights, narrow tire edge glimpses. Side mirrors folded in tight so they do not project beyond the widest body silhouette. Car fills the image as tightly as practical, minimal transparent padding. Plain true transparent alpha background, not a checkerboard baked into RGB and not a ground surface. The outline should be a smooth natural rounded rectangle. Subtle soft overcast highlights convey material and shape, no cast shadow outside the body and no hard lighting. Photorealistic grounded everyday car, not a cartoon, icon, toy, diagram or low-poly render. No branding, badges, writing, license plate text, annotations, external objects or people. Image itself should be portrait to match the long axis of the car. Actual transparent background is required.

## Inspection limits

Both original outputs were visually inspected. Dimensions, alpha bounds, and edge luminance were measured from the generated originals. Runtime WebP encoding changes only the delivery format and lossy RGB compression, retaining exact alpha and image dimensions. Their appearance, texture repetition, and scale should also be judged through the real game renderer at overview and phone gameplay zoom. Generated realism does not establish collision correctness; geometry must be checked against the rendered silhouette separately.

## Collision fit

`createParkingCarCollisionRects()` in `core/map-obstacles.js` uses five overlapping rounded rectangles measured in the full sprite's source coordinates. The existing utensil helper converts them with the same uniform `contain` scale, centering, and rotation as the image. The full transparent-padded image is rendered; the alpha crop above is a measurement, not a separate rendering crop.

The pieces follow the rounded bonnet, flanks, rear shoulders/bumper, and slightly wider lower body. Their outline was checked offline against the alpha silhouette expanded by a 29-world-unit marble at the authored 520 × 1140 fixture size. Representative horizontal contact differences were about −3.5 to +1.8 world units on the front and sides, −4.8 to −4.1 at the lower rear shoulder, and up to +3.1 around the rear curve. A near-tip horizontal sample was −5.5 units; because that boundary is nearly horizontal, its normal-distance error is smaller. Negative differences mean the approximation lets the marble slightly closer. These are a small primitive approximation, not pixel-perfect physics.

The real `circleObstacleContact()` path produced the same fixture-local contacts at rotations 0, 0.7, and −1.2 radians (difference below 2e−11 world units). Existing fork and spoon contact tests passed unchanged. Runtime geometry requires no image inspection, per-frame fitting, or new collision representation.
