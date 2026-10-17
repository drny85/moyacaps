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
- [ ] 2. Pure modules
- [ ] 3. Face detector
- [ ] 4. Studio UI
- [ ] 5. Wiring and removals
- [ ] 6. Verification
