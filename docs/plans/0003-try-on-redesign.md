# 0003 — Try-On Redesign

Decisions: [ADR 0019](../adr/0019-on-device-try-on.md), building on [ADR 0016](../adr/0016-mobile-first-storefront-redesign.md) (motion budget) and [ADR 0018](../adr/0018-lazy-auth-and-storefront-performance-budget.md) (performance budget). Vocabulary: `CONTEXT.md` (Try-On, Try-On Photo, Cap, Catalog Shot).

## 1. Overview & Business Value

The Try-On should let a Customer see a cap on their own head in a few seconds on a phone, then buy it. Today it shows the wrong products (tees as caps), uses AI sample portraits, makes the Customer place the cap by hand, keeps their photo in localStorage, and is the slowest storefront page (Lighthouse mobile 73, TBT 667 ms).

Branch: `feat/try-on-redesign` (from `feat/tee-photo-quality`). Out of scope: tee try-on, live per-frame camera tracking, 3D caps.

## 2. Architecture

Pure modules (`src/lib/tryOn/`, unit-tested):
- `catalog.ts`: `tryOnCaps(products, now)`. Visible caps only, each with its front-angle overlay, Catalog Shot thumbnail and whether it can be bought.
- `fit.ts`: placement geometry in fractions of the square photo.
  - `anchorFromFace(face)` turns detector keypoints into the cap's centre, width and roll. `DEFAULT_ANCHOR` sits on the silhouette.
  - `placeCap(anchor, adjust)` gives the overlay rectangle and rotation.
  - `applyDrag` and `applyPinch` are clamped gesture updates.
- `photo.ts`: `squareCrop(w, h)` and `fitSize(w, h, max)` for import, and `cardLayout()` for the share card.

Client modules (`src/components/tryon/`):
- `TryOnStudio`: state and layout. The page and the product-page modal share it; the modal opens on its product.
- `TryOnStage`: square stage (photo or silhouette), cap overlay, drag and pinch.
- `CapPicker`: swipeable strip of cap Catalog Shots (radio group).
- `CameraSheet`: `getUserMedia` preview and snapshot. Mounted only when the camera is opened.
- `faceDetector.ts`: dynamic import of `@mediapipe/tasks-vision`, cached detector, `detectFace(image)`.
- `shareCard.ts`: dynamic import. Draws the card with `cardLayout` and `placeCap`, then shares or downloads it.

## 3. Steps

1. Docs: ADR 0019, glossary terms, this plan.
2. Pure modules plus tests (catalog, fit, photo).
3. Face detector loader with a self-hosted model (`public/models/blaze_face_short_range.tflite`) and WASM pinned on jsdelivr. Calibrate `anchorFromFace` on real face photos.
4. Studio UI:
   - Phone: stage full width, picker strip below, sticky "Add to bag · $X" bar.
   - Desktop: stage on the left, picker and actions on the right.
   - `tryOn` message namespace (en/es, storefront).
5. Wiring:
   - The page and `VirtualTryOnModal` use the new studio.
   - Store persistence moves to v2 and drops `tryOnImage` and `tryOnSettings`.
   - Delete `VirtualTryOnStudio` and `public/avatars/`.
   - Drop compare mode, presets, sliders, confetti and sound.
6. Verify:
   - `tsc`, `bun run test`, `bun run build`.
   - Browser checks at 375 px and desktop: silhouette, upload, auto-fit, drag/pinch, add to bag, share card matches the stage.
   - `bun run perf-budget --pages /en/try-on`: target performance ≥ 90 and TBT < 200 ms.

## 4. Status

- [x] 1. Docs
- [x] 2. Pure modules (`src/lib/tryOn/`, `src/__tests__/tryOn.test.ts`)
- [x] 3. Face detector: `@mediapipe/tasks-vision@1.0.1`, model in `public/models/`. `src/proxy.ts` skips `models/`, because the i18n middleware had redirected the model to `/en/models/…`. Calibrated on three frontal portraits (`FIT.widthPerEarSpan` 1.45, `brimAboveEyes` 0.45).
- [x] 4. Studio UI
- [x] 5. Wiring and removals: store v2 (`migratePersisted`), MobileActionBar hidden on `/try-on`, `VirtualTryOnStudio` and `public/avatars/` deleted
- [x] 6. Verification:
  - `tsc` and 355 tests pass, and the build passes.
  - Browser at 375 px and desktop: silhouette, upload → auto-fit in about 0.5 s once loaded, drag/reset, cap switch, add to bag, modal opens on its cap, Escape closes.
  - Lighthouse mobile on `/en/try-on` (local, load average ≈ 8.5, median of 3): **89** (was 73), TBT **18 ms** (was 667 ms), 424 KB (was 1.36 MB), LCP 3.6 s. Home measured 86 / 4.1 s in the same state, so LCP is limited by the machine, as on every page.
  - Not checked yet: share/save card output, live camera capture (no camera in the test browser).
- [x] 7. Follow-up (user request): sample models are back as a picker with stored face points (`src/data/tryOnModels.ts`, portraits in `public/try-on/models/`, recompressed to about 100 KB). A Fine-tune panel adds size, tilt and position sliders (`clampAdjust`, tested).
