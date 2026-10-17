# Mobile-First Storefront Redesign: Image Roles and Motion Budget

The customer-facing storefront (homepage, a new collection page, product pages, cart drawer, navbar/footer) is redesigned mobile-first; checkout, tracking, account and admin keep their current look. The Good Luck dark identity (ADR 0009/0013) is kept and tightened through layout discipline rather than a new palette.

## Decisions

1. **Two image roles.** Every grid and card shows a **Catalog Shot** (product alone, shared studio backdrop, 4:5, consistent scale). **Lifestyle Shots** appear only on product pages and editorial sections. Caps (cut-outs) and tees (night street photos) were visually incompatible side by side; this rule fixes that.
2. **Photography now vs later.** Existing assets are reprocessed by script into Catalog Shots. The `public/shirts/templates/` blanks are on-model photos, not flat garments, so tees are illustrated flat-lays for now. `docs/photography-spec.md` is the target any future shoot must meet; its 8 blank flat-lays replace the illustration.
3. **No WebGL.** The `Cap3DViewer` / GLB pipeline added on `feat/cap-360-3d-viewer` is dropped; the real-photo turntable (ADR 0013) stays. Reaffirms ADR 0013 and keeps three.js off mobile.
4. **Homepage order.** Hero (turntable + Caps / Tees entry tiles) → Featured Products → Anatomy (non-pinned panels on touch) → Drop Radar → Tee Lookbook strip → Brand Story. Colorway Marquee removed.
5. **Feature pruning.** The Model Lookbook Studio's design/colorway switching moves into the tee product page and the global studio modal is removed; `/try-on` stays, linked from cap product pages only; the Sneaker Fit Matcher is removed.
6. **Shop page.** `/products` with category tabs, filter chips (Colorway family, Silhouette, Graphic Design, in stock), sort (Featured, Newest, Price), state in URL query, bottom-sheet filters on mobile, no text search at the current catalog size.
7. **Catalog Shot backdrop.** Warm light grey card (~`#ECEAE6`) with soft ground shadow inside the dark site. Every Graphic Design × Apparel Colorway gets a Catalog Shot: an illustrated flat-lay tee with the real artwork printed on it, until the 8 blank flat-lay photos in `docs/photography-spec.md` exist and replace the drawing automatically. Missing Lifestyle Shots fall back to the Catalog Shot.
8. **Motion budget (hard limits).** Lighthouse mobile performance ≥ 90 (default simulated throttling); LCP < 2.5 s on a mid-range Android device, measured with Lighthouse's applied DevTools throttling (slow 4G + 4× CPU; see ADR 0019, checked by `bun run perf-budget`); parallax animates transform/opacity only; no scroll-pinned scenes on touch devices; every effect off under `prefers-reduced-motion`; no animation libraries beyond framer-motion and lenis.

## Amendment (2026-10-17): tee Catalog Shots are on-model photos

The illustrated flat-lay tees read as fake next to photographed caps. Until the blank flat-lay photos in `docs/photography-spec.md` exist, a tee's Catalog Shot is a 4:5 crop of its on-model Lifestyle Shot, so every tee image is a real photograph. Those on-model shots are printed from the blank templates by `scripts/lib/printOnModel.ts` into a print box measured per template (`bun run calibrate-tee-templates` → `scripts/data/teeTemplates.json`): centred on the torso, sized like the real shoot photos, warped and shaded by the fabric. Caps keep the studio backdrop, so the grid mixes studio caps with street-shot tees; real flat-lays, when shot, take priority automatically and restore one backdrop.

