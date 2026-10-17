# On-Device Try-On with Lazy Face Detection

The Try-On (CONTEXT.md) used to drop a flat cap image at a fixed spot over a photo, which the Customer then dragged and tuned with five sliders. Sample portraits stood in for the Customer, and the Try-On Photo was saved to localStorage as a full-resolution data URL. That broke the store's other persisted state once a phone photo passed the roughly 5 MB quota. The picker also listed tees, and the page scored 73 on Lighthouse mobile (TBT 667 ms) because it shipped 27 full-size product images and a 1,000-line client component.

## Decisions

1. **Caps only, from the live catalog.** The picker lists the visible caps from `useCapVariants`. Caps that cannot be bought are shown but marked, with no add-to-bag. The overlay is the scale-normalised front angle (`/catalog/caps/{id}/front.webp`). Every front angle shares one content box, so the fit math uses one constant.
2. **Automatic placement by on-device face detection.** When a photo is added, MediaPipe Face Detector (BlazeFace short range) finds the eyes and ear points. A pure function turns them into the cap's centre, width and roll. Drag and pinch fine-tune that placement. Detection runs once per photo, never per camera frame, which keeps it light on phones. If no face is found, the cap goes to a default position and the Customer places it by hand.
3. **The detector loads only on intent.** `@mediapipe/tasks-vision` (pinned) is imported dynamically when a photo is added. Its WASM comes from jsdelivr at the same pinned version, about 2.3 MB brotli. The 230 KB model is self-hosted in `public/models/`. Nothing related to detection loads with the page.
4. **The Try-On Photo stays in memory.** On import it is centre-cropped to a square and downscaled to 1080 px on a canvas. It lives in component state as an object URL, is never written to storage and is revoked when replaced or unmounted. The store no longer persists `tryOnImage` or `tryOnSettings`; persisted state moves to version 2 and drops both.
5. **One geometry for screen and card.** Placement is expressed in fractions of the square photo. The stage renders it as percentages and the share card draws it in pixels, so the saved card matches the screen. The card is shared with the Web Share API where files are supported, with a download as fallback.
6. **No sample models.** The AI-generated sample portraits are removed. Before a photo is added, the stage shows the cap on a neutral head silhouette.

## Consequences

- The first photo pays a one-off download of about 2.5 MB, shown as a progress state. Later photos reuse the loaded detector.
- jsdelivr becomes a runtime dependency for the Try-On only. If it is unreachable, placement falls back to manual and the Try-On still works.
- The Try-On Photo cannot be restored after a reload. This is the intended privacy behaviour.
- Face detection quality depends on a roughly frontal, well-lit face. Fine-tuning by hand covers the rest.
