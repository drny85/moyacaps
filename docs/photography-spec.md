# Photography Spec

The standard every new product photo must meet. It implements the two image roles from ADR 0016 (**Catalog Shot** and **Lifestyle Shot**, see `CONTEXT.md`). Photos that miss the spec make the grid look inconsistent, so they are re-shot rather than used.

## 1. Model shoot: real printed tees (priority)

Real photos of models wearing the **printed** tees replace the composited on-model shots. Real photos always win: the build never overwrites them.

### Casting and styling
- **Models:** several different men, so each Graphic Design is worn by a different model. Tall, deep dark skin, heavily tattooed (forearms, hands, neck). Get a signed model release from each.
- **Fit:** size 2XL in every shot. It should read oversized and boxy, with dropped shoulders and the hem just below the hips (not dress-length).
- **Look:** urban street style, Bronx NY, such as elevated subway tracks, bodega corners, brownstone stoops, courts behind chain-link, and graffiti walls. Use cargo pants, baggy denim and sneakers. Show no other brands' logos.

### Shots per Graphic Design
- **Colours:** every design is a front print. Shoot it in each colourway sold (washed black, crisp white, heather grey, butter cream), or at least the default colourway first.
- **Front view (required):** facing the camera, arms relaxed and away from the chest. Nothing covers the print: no chains, straps or hands.
- **Detail (optional):** a close-up of the print on the fabric, for the product gallery.

### Technical
- **Format:** vertical 4:5, minimum 2000 px wide, sharp on the print.
- **Framing:** head to mid-shin, model centred. The site crops chin-to-knees for the grid, so leave room around the shirt.
- **Retouching:** consistent colour grading across the set. Keep tattoos and skin texture natural.

### Delivery and going live
1. Export as sRGB JPEG and name each file `{design}-{colour}.jpg`, e.g. `boxing-gloves-black.jpg`. Colour names are `black`, `white`, `grey` and `cream`; design names match `public/shirts/graphics/`.
2. Put the files in `public/shirts/`, replacing the composited ones.
3. Add each file's path to `SHOOT_PHOTOS` in `scripts/build-catalog-shots.ts`, so the build treats it as a real photo and never reprints it.
4. Run:

   ```bash
   bun run build-catalog-shots
   ```

   This rebuilds the 4:5 grid crops from the new photos.

## 2. Heavyweight Tee blank flat-lays (8 photos)

Tee Catalog Shots are currently **illustrated** (`scripts/lib/flatTee.ts`). They are replaced automatically by real photos once these 8 blanks exist. The artwork is printed digitally by `scripts/build-catalog-shots.ts`. Only blank garments are photographed, so one shoot covers all 11 Graphic Designs.

| File | Garment | Side |
| :--- | :--- | :--- |
| `front-washed-black.png` | Vintage Washed Black | front |
| `back-washed-black.png` | Vintage Washed Black | back |
| `front-crisp-white.png` | Crisp Optical White | front |
| `back-crisp-white.png` | Crisp Optical White | back |
| `front-heather-grey.png` | Athletic Heather Grey | front |
| `back-heather-grey.png` | Athletic Heather Grey | back |
| `front-butter-cream.png` | Butter Cream Vintage | front |
| `back-butter-cream.png` | Butter Cream Vintage | back |

Final files go in `public/shirts/flatlay/`.

### Garment prep
- Use a blank production tee from the same 280 GSM stock as the sold tees, size L, with no print.
- Steam it until it has no creases or fold lines.
- Lay it flat and symmetrical: sleeves straight out at the same angle on both sides, hem straight and square.
- Front shots show the front neckline. Back shots show the back neckline, so turn the tee over and do not move the sleeves.
- Do not use pins or clips where they would show. Fold nothing under except the side seams, and only enough to keep the body boxy.

### Framing (use the guides)
- Shoot a **square** frame from directly overhead, with the lens parallel to the floor and no perspective.
- Match the garment to `docs/photography/flatlay-guide-front.png` and `flatlay-guide-back.png`. Set the guide as a tethered overlay or a reference in the camera app:
  - Top of the collar at 11.8% of frame height.
  - Hem at 95%.
  - Sleeve tips at 3% and 97% of frame width.
- The red dashed box is the print area. Keep it smooth and free of folds, because the artwork is placed there.
- Keep the same camera height and lens for all 8 shots. Lock the zoom.

### Light and colour
- Use large, soft, even light from both sides at 45°, with no hard shadows or hotspots on the fabric.
- Shoot on plain light grey or white seamless paper.
- Put a grey card in one test frame and set white balance from it. Use the same settings for all 8 shots.
- Expose for the fabric. Washed black must show weave texture, and white must not clip.

### Delivery
- Minimum 4000 × 4000 px.
- Unedited originals (RAW or max-quality JPEG) plus a colour-corrected export.
- **Prep step (before use):** cut out the background to transparency, crop to the guide frame, save as PNG under the filename above, then run:

  ```bash
  bun run build-catalog-shots
  ```

  The build log reports `photo` instead of `illustrated` for each tee that uses a real blank.

### Photographed printed tees
A design that only exists as a finished garment (no separate print file to apply to the blanks), such as the Crash Scene Tee, uses a photo of the printed tee laid flat instead:

1. Shoot it flat, front up, on a dark plain surface. The Crash Scene original is on a black car hood: `shirts/crash-scene-flatlay-original.jpg`.
2. Cut it out with `bun run scripts/prep-tee-photo.ts <photo> <design>-<colorway>`. This writes `public/shirts/flatlay/<design>-<colorway>.png`. Check the edge, since the fabric test in `scripts/lib/teePhoto.ts` is tuned per colorway.
3. Set the colorway's `flatLayPhoto` in `src/data/caps.ts` and run `bun run build-catalog-shots`. The garment is framed to the flat-lay guide above and laid on the backdrop. The log reports `printed flat-lay photo`.

## 3. Cap Catalog Shots

Caps already meet the Catalog Shot standard through `scripts/build-catalog-shots.ts`. New cap colorways need:

- Four angle photos per colorway: `front`, `left`, `back`, `right`.
- Same camera height and distance for all four. The cap sits on a clear stand at eye level with the brim.
- Background removed to transparency (PNG), minimum 2000 px on the long edge.
- Registered in the caps manifest (`scripts/process-cap-assets.ts` writes `src/data/capsManifest.ts`).

The script trims each photo, scales every angle to the same crown height, and places the front angle on the shared backdrop. Framing does not need to be pixel-exact, but the cap must be fully in frame and in sharp focus edge to edge.

## 4. On-model blank templates (interim, until the model shoot)

Every tee Lifestyle Shot, and until flat-lays exist every tee Catalog Shot, is printed onto a real photo of the model wearing a **blank** tee: `public/shirts/templates/{front|back}-{black|white|grey|cream}.jpg`.

- **New template** (new colour or new pose): shoot the blank garment in the same setting and drop it in `public/shirts/templates/` with the same naming. Then run:

  ```bash
  bun run calibrate-tee-templates
  ```

  Check `scripts/data/teeTemplates-review.jpg`: the green tint must cover the shirt and the red box must sit centred on the chest (front) or upper back (back). If lighting breaks the mask, add the template to `MEASURE_FROM` in `scripts/calibrate-tee-templates.ts` to reuse a same-pose template's measurement.
- **Then rebuild the images:**

  ```bash
  bun run build-catalog-shots
  ```

  This regenerates every on-model shot and its 4:5 crop. Photos listed in `SHOOT_PHOTOS` (real printed-garment shots) are never overwritten.
- **Template quality:** at least 1200 px wide; a frontal or back pose with arms away from the chest and back; even light, and no hands or straps across the print area.

## 5. Lifestyle Shots

Used on product pages and in editorial sections only, never in grids.

- **Aspect:** shoot for a 4:5 crop with the garment or cap centred. Keep head and feet clear of the crop edge.
- **Coverage:** every Graphic Design × Apparel Colorway that is sold. Missing combinations fall back to the Catalog Shot.
- **Naming:** `public/shirts/{design}-{colorway-short}.jpg`, where `colorway-short` is `black`, `white`, `grey` or `cream`.
- **Size and format:** minimum 2000 px on the long edge, sRGB JPEG.
- **Look:** keep the current night-street look so the lookbook reads as one series.

## 6. Shared rules

- **Backdrop colour:** `#ECEAE6`. Exported as `BACKDROP` from the build script, and the only grid background.
- **Catalog Shot size:** 1600 × 2000 (4:5) WebP. `next/image` serves the smaller sizes.
- **Colour space:** sRGB throughout.
- **File naming:** lowercase kebab-case. No spaces and no camera names (`PHOTO-2026-…`).
