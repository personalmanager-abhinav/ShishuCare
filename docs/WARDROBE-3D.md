# Wardrobe 3D rendering

## Current implementation

The experimental `/wardrobe/` route keeps Astro, the shared catalogue, marketplace links and bargaining APIs. Its product rail progressively enhances to a lazy-loaded Three.js scene implemented in `website/src/scripts/wardrobe-3d.ts`.

One transparent renderer covers the showroom. Each visible product receives a scissored view containing a front/back subdivided surface, perspective camera and room-matched lights. Pointer movement drives local folds; dragging adds rotation and twist; damping returns the product to its pinned top edge. Stiffness profiles distinguish knit, soft muslin, structured bib/clothing and quilted products. Images remain in the DOM as accessible and reduced-motion/WebGL fallbacks.

## Asset contract

Current demonstration catalogue images are transparent photographic layers. Production product assets should eventually be delivered as optimized GLB files with separate rigid hanger and flexible garment nodes, UV-mapped front/back textures, normal and roughness maps, and named attachment points. The runtime surface is designed as a fallback for products without a GLB.

Recommended production limits per model:

- Under 80,000 visible triangles at highest detail.
- Meshopt or Draco compression and KTX2 textures.
- A low-detail rail model and one higher-detail focused model.
- Separate `hanger`, `garment` and optional `clips` nodes.
- Pinned vertices or named anchors at garment-to-hanger contacts.
- Neutral pose centered at the origin with dimensions recorded in product metadata.

## Performance and accessibility

- Three.js is dynamically imported only on the wardrobe route.
- A single renderer avoids exhausting browser GPU contexts.
- Device pixel ratio is capped at 1.6.
- Offscreen products are skipped during rendering.
- Reduced-motion visitors keep the static photographic presentation.
- Product buttons and labels remain ordinary DOM elements, so keyboard and assistive-technology behavior does not depend on WebGL.

## Production asset workflow

1. Photograph or scan the real product from front, back and both sides under consistent light.
2. Build and retopologize the garment in Blender, CLO or Marvelous Designer.
3. Keep hanger geometry separate and define garment attachment points.
4. Bake fabric detail to normal/roughness maps and export GLB.
5. Generate rail and focused levels of detail, compress, and validate on mobile hardware.
6. Register the model in product data while retaining the current transparent WebP fallback.

Consistent multi-view source photography is required before the demo surfaces can be replaced by product-accurate volumetric models. AI-generated alternate views should not be presented as exact merchandise because they can invent construction details or patterns.
