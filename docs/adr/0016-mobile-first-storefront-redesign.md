# Mobile-First Storefront Redesign: Image Roles and Motion Budget

The customer-facing storefront (homepage, a new collection page, product pages, cart drawer, navbar/footer) is redesigned mobile-first; checkout, tracking, account and admin keep their current look. The Good Luck dark identity (ADR 0009/0013) is kept and tightened through layout discipline rather than a new palette.

## Decisions

1. **Two image roles.** Every grid and card shows a **Catalog Shot** (product alone, shared studio backdrop, 4:5, consistent scale). **Lifestyle Shots** appear only on product pages and editorial sections. Caps (cut-outs) and tees (night street photos) were visually incompatible side by side; this rule fixes that.
2. **Photography now vs later.** Existing assets are reprocessed by script into Catalog Shots (tees composited onto the blank garment templates). The written shot spec is the target any future photo shoot must meet.
3. **No WebGL.** The `Cap3DViewer` / GLB pipeline added on `feat/cap-360-3d-viewer` is dropped; the real-photo turntable (ADR 0013) stays. Reaffirms ADR 0013 and keeps three.js off mobile.
4. **Homepage order.** Hero (turntable + Caps / Tees entry tiles) → Featured Products → Anatomy (non-pinned panels on touch) → Drop Radar → Tee Lookbook strip → Brand Story. Colorway Marquee removed.
5. **Feature pruning.** The Model Lookbook Studio's design/colorway switching moves into the tee product page and the global studio modal is removed; `/try-on` stays, linked from cap product pages only; the Sneaker Fit Matcher is removed.
6. **Shop page.** `/products` with category tabs, filter chips (Colorway family, Silhouette, Graphic Design, in stock), sort (Featured, Newest, Price), state in URL query, bottom-sheet filters on mobile, no text search at the current catalog size.
7. **Catalog Shot backdrop.** Warm light grey card (~`#ECEAE6`) with soft ground shadow inside the dark site. Every Graphic Design × Apparel Colorway gets a composited Catalog Shot from `public/shirts/templates/`, so the matrix is always complete; missing Lifestyle Shots fall back to it.
8. **Motion budget (hard limits).** Lighthouse mobile performance ≥ 90; LCP < 2.5 s on a mid-range Android device; parallax animates transform/opacity only; no scroll-pinned scenes on touch devices; every effect off under `prefers-reduced-motion`; no animation libraries beyond framer-motion and lenis.
