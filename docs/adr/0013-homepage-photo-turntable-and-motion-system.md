# Homepage Photo Turntable and Shared Motion System

## Context
The homepage opened on a 125vh scroll-scrub "Anatomy" scene before the hero, so the product, price and purchase CTA sat below a full screen of decorative HUD, and two sections rendered an `<h1>`. The hero "360°" crossfaded four angle photos on a timer, animations were hand-tuned per component, many looped forever, and nothing honored `prefers-reduced-motion`.

A WebGL model of the cap was prototyped and rejected: a generated mesh does not look like the real product, and the real product photos are what customers buy from.

## Decision
1. **Product-first order**: Hero (only `<h1>`) → Anatomy → Drop Radar → Colorway marquee → Catalog → Brand Story.
2. **Real photos, not a 3D model**:
   - `CapTurntable` (`src/components/viewer/`) turns the cap between real angle photos (`public/caps/angles/{front,left,back,right}.png`) by drag, arrow keys or angle dots, with a directional `rotateY` swing so each swap reads as the cap spinning. Pointer tilt, a moving sheen, a floating idle bob and a tilt-reactive ground shadow add depth with CSS 3D transforms only.
   - Colorways without angle shots show their single catalog photo with the same tilt and depth treatment. Adding angle photos for a colorway is the only step needed to make it turnable.
   - The anatomy section pins and scroll-drives the same photos: each angle swings in, pushes in on its embroidery, and the final step fans all four angles out.
   - No WebGL, no extra dependencies; the first photo is a `priority` image and stays the LCP element.
3. **Shared motion system**: easing, durations, springs and stagger live in `src/lib/motion.ts`; `<Reveal>` replaces per-component `whileInView` boilerplate. Reduced motion disables Lenis smooth scrolling, the hero intro, bob and auto-turn, the pinned anatomy scroll (static photo panels instead), marquee drift, card tilt and counters.
4. **Visual system**: Anton (`font-poster`) for homepage headlines; red primary, clover green secondary; violet and gold retired from homepage accents. `moya-*` tokens are unchanged (ADR 0009).
5. **`body { overflow-x: clip }`**: `hidden` made `<body>` a scroll container that never scrolls, which silently broke every `position: sticky` (navbar, pinned anatomy).

## Consequences
- **Photo quality is the ceiling**: angle shots are 418px; higher-resolution, consistently framed photos (same scale and center across angles) directly improve the turntable and the anatomy close-ups.
- **Only the flagship turns** until other colorways get angle photos.
