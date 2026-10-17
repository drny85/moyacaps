# 0002 — Mobile-First Storefront Redesign

Decisions: [ADR 0015](../adr/0015-unified-product-catalog-in-convex.md), [ADR 0016](../adr/0016-mobile-first-storefront-redesign.md). Vocabulary: `CONTEXT.md` (Product, Shop, SKU, Catalog Shot, Lifestyle Shot).

## 1. Overview & Business Value

Caps and Heavyweight Tees are sold side by side but look like two different stores: caps are transparent cut-outs, tees are night-street model photos, the only product route is `/caps/[id]`, and there is no Shop page. This plan delivers a clean, mobile-first storefront where every Product is found from one Shop page, shown with a consistent Catalog Shot, and presented on one product page template, with motion that stays inside a hard mobile performance budget.

Out of scope: checkout, tracking, account, admin visual design (admin only gains the fields needed to edit tee SKUs).

## 2. Architecture & Decisions

- **One catalog** (ADR 0015): Convex is the source for caps and tees. New `skus` table for tee Graphic Design × Apparel Colorway × size stock. `/products/[slug]`, slug = `variantId`; `/caps/[id]` → 308 redirect.
- **Image roles** (ADR 0016): Catalog Shot in all grids/cards (4:5, `#ECEAE6` backdrop, soft ground shadow, consistent scale). Lifestyle Shot on product pages and editorial only.
- **Motion budget** (ADR 0016): Lighthouse mobile ≥ 90, LCP < 2.5 s mid Android, transform/opacity only, no pinned scenes on touch, everything off under `prefers-reduced-motion`, framer-motion + lenis only. All tokens via `src/lib/motion.ts` and `<Reveal>`.
- **No WebGL**: remove `Cap3DViewer`, GLB pipeline, three.js deps.

## 3. Implementation Breakdown

Each phase is its own branch and PR, merged in order. Each must pass `bun run test`, `bunx tsc --noEmit`, `bun run lint`, `bun run build`.

### Phase 1 — Image pipeline & Catalog Shots (`feat/catalog-shots`)

Status: done on `feat/catalog-shots`. `next.config.mjs` already serves avif/webp.

- Removed `Cap3DViewer`, `src/lib/cap3dMaterials.ts`, `scripts/generate-3d-glb.ts`, GLB fields in the caps manifest, and `three` / `@react-three/*`. Hero and product page turn between the real per-colorway angle photos instead (`src/lib/capAngles.ts`). `src/data/capsManifest.ts` stays as the angle-photo index.
- `scripts/build-catalog-shots.ts` (`bun run build-catalog-shots`) writes `src/data/catalogShots.json`:
  - **Caps**: trim, scale into a fixed box, center on 1600×2000 `#ECEAE6` with a contact shadow → `public/catalog/caps/{id}.webp`. The four angles are normalized to one crown height → `public/catalog/caps/{id}/{angle}.webp`.
  - **Tees**: `public/shirts/templates/` turned out to be on-model photos, and background removal keeps the car, so neither gives a flat garment. Interim: an illustrated flat-lay tee (`scripts/lib/flatTee.ts`) with the real artwork printed in the print box. On dark fabric, black ink prints off-white. Output → `public/catalog/tees/{id}/{colorway}.webp` for all 11 × 4.
  - Real blanks drop in automatically from `public/shirts/flatlay/{side}-{colorway}.png` once shot to `docs/photography-spec.md` (8 photos, framing guides in `docs/photography/`).
- The Lifestyle Shot matrix is already complete (Angel Clover white is `gothic-angel-white.jpg`, and the Eagle Clover black/grey are `.png` shoot photos). Renaming is **deferred to Phase 2**, because live Convex variant rows and order snapshots store these paths (ADR 0008). Upscaling is skipped: the sources are about 900–1264 px, and upscaling adds no real detail.

### Phase 2 — Unified catalog in Convex (`feat/unified-product-catalog`)

Read `convex/_generated/ai/guidelines.md` first.

Status: done on `feat/unified-product-catalog`. Migration run on the dev deployment (16 caps, 11 tees, 220 SKUs; re-run is a no-op). **Production still needs `npx convex run --prod catalogMigrations:migrateUnifiedCatalog` right after the deploy that ships this schema**: until it runs, prod tees have no colorways, so they keep selling against the aggregate as before.

As built:
- `convex/inventory.ts` is the single stock path (`checkStock`, `adjustStock`, `setSkuStock`). A tee variant's `stock` is kept equal to the sum of its SKUs, so analytics and low-stock views are unchanged. Tee lines from pre-SKU orders cannot be attributed to a SKU; releasing them logs a warning for manual reconcile.
- Order items carry `colorway` + `size`; Stripe metadata carries them as `c` / `s`. Fixed on the way: checkout sent the cart line id instead of `variantId`, and the cart sent the colorway display name instead of its id.
- Admin edits tee stock in a colorway × size grid (`TeeSkuStockDialog`); aggregate stock edits are refused for tees.
- Deferred: Colorway-family filtering moves to Phase 3 (client-side over the small catalog). `CAP_VARIANTS` stays only as the offline fallback in `useCapVariants`, the product page and try-on until Phase 4. Client "max in cart" still uses the tee's total; the server enforces per-SKU stock and Phase 4's size picker shows it.

- `convex/schema.ts`: add tee fields to `variants` (`graphicDesign`, `printLocation`, `apparelColorways` with catalog/lifestyle image paths, `sizes`), add `skus` table `{ variantId, colorway, size, stock }` with index `by_variantId_colorway_size`.
- Migration (idempotent mutation + `scripts/` runner): seed `skus` from current tee stock split across colorways/sizes; copy static tee metadata into `variants`.
- `convex/products.ts` (now `convex/catalog.ts`, ADR 0017): `getVariants` gains `category`, `colorwayFamily`, `inStock` args and returns `catalogShot`; new `getProductBySlug` returning variant + SKUs.
- Inventory: `convex/stripe.ts` and `convex/orders.ts` (now split per ADR 0017) reserve, deduct and release tee stock on the matching `skus` row (ADR 0007 idempotency unchanged). Add tests in `convex/orders.test.ts` for tee SKU reservation, oversell rejection and release.
- Admin products page: edit SKU stock per colorway × size.
- Routes: create `src/app/[locale]/products/[slug]/page.tsx` (moves current `caps/[id]` logic); `caps/[id]` → `permanentRedirect`. Update every `/caps/` link: `CapCard`, `DropRadar`, `ProductQuickView`, `ProductJsonLd`, `useProductShare`, `sitemap.ts`, `robots.ts`, admin drops/products, `DropScheduleDialog`, emails.
- Lifestyle Shot names: rename `gothic-angel-white.jpg` → `angel-clover-white.jpg`, `eagle-clover-{black,grey}.png` → `.jpg`, rewriting the variant `image`/`images` paths in the same migration; keep the old files until no order snapshot references them.
- Expose `catalogShots.json` paths as each Product's grid image (`catalogShot`, per colorway for tees).
- Stop importing `CAP_VARIANTS` at runtime (`caps/[id]` page, `VirtualTryOnStudio`, studio); `src/data/caps.ts` becomes seed-only.

### Phase 3 — Shop page (`feat/shop-page`)

Status: done on `feat/shop-page`.

As built:
- `src/lib/shop.ts` holds the pure model: colour families come from each product's hexes (cap crown colour, every tee colorway), cap-only and tee-only facets narrow only their own category, and URL state is parsed leniently and serialized without defaults. Covered by `src/__tests__/shop.test.ts` using the real seeded hexes.
- "Graphic Design" filter replaced by **Tee print (front / back)**: each tee *is* one Graphic Design, so that filter would just pick a single product.
- On phones, sort lives in the "Filter & sort" sheet; from `sm` up it is a dropdown. The navbar publishes `--navbar-h` so the sticky bar sits flush at every breakpoint.
- Tee cards swap colorways in place and open the product on the chosen colorway (`?colorway=`, read by the Phase 4 product page). With a colour filter on, tees open on the matching colorway.
- Nav: Shop / Caps / Tees replace Collection and the studio anchor; the mobile action bar points at Shop. `CapCard` / `CapGrid` remain on the homepage until Phase 5.
- Tee price changed to $80 in the same branch (`catalogMigrations:setApparelPriceUsd`, run on dev). **Production: run `npx convex run --prod catalogMigrations:setApparelPriceUsd '{"priceUsd": 80}'` after deploy.**

- `src/app/[locale]/products/page.tsx`: category tabs (All / Caps / Tees), filter chips (Colorway family, Silhouette, Graphic Design, In stock), sort (Featured, Newest, Price). State in URL query (`?category=tees&colorway=black&sort=price-asc`).
- Mobile: sticky tab bar, filters in a bottom sheet, 2-column grid; desktop 3–4 columns with filter sidebar.
- `ProductCard` (replaces `CapCard`): Catalog Shot, name, price, colorway dots, stock/drop badge; hover swap to Lifestyle Shot on pointer devices only.
- Navbar: "Shop", "Caps", "Tees" links to `/products?category=…`; remove `/#apparel-studio` links. Footer mirrors.
- i18n keys in `src/messages/{en,es}.json`. SEO metadata + canonical per category.

### Phase 4 — Product page (`feat/product-page`)

Status: done on `feat/product-page`.

As built:
- `src/lib/productOptions.ts` is the pure purchase model (selection from the URL, per-SKU stock, one call-to-action state, gallery slides), tested in `src/__tests__/productOptions.test.ts`. Size is never preselected; sold-out sizes are disabled; sizes with 3 or fewer left say so.
- `ProductView` = `ProductGallery` + `ProductPurchase` + details (native `<details>`) + related products. The server renders from Convex only (`getProductBySlug`, cached per request); the live query keeps price and SKU stock current. The `CAP_VARIANTS` fallback and static params are gone from the product route.
- **Deviation:** cap angles are swipe slides on the shared backdrop instead of `CapTurntable`. A drag turntable inside a swipe strip fights the gesture on phones; the hero keeps the turntable.
- **Deviation:** `ProductQuickView` was not moved onto the shared option components, because Phase 5 replaces the homepage cards that open it; only its studio and matcher launchers were removed.
- Removed: old `ProductDetailView`, `EmbroideryLoupe`, `SneakerFitMatcherModal`, `ModelLookbookStudioModal`, their layout mounts and store state. The homepage studio section stays (standalone) until Phase 5 swaps in the lookbook strip. Confetti on add is gone; the button confirms instead.
- The global mobile action bar hides on product pages, which carry their own sticky add bar.
- The static catalog fallback now carries Catalog Shots, which fixed a hydration mismatch on the Shop (review finding 2).

- One `ProductDetailView` for both categories (split the current 1016-line file into gallery, options, purchase panel).
- Gallery: Catalog Shot first (LCP, `priority`), then Lifestyle Shots; swipeable on mobile, thumbnails on desktop. Caps with angle photos use `CapTurntable`.
- Tees: Graphic Design artwork view + Apparel Colorway swatches (from Lookbook Studio), size picker driven by `skus` stock; selected colorway/size in URL query.
- Caps: embroidery loupe stays; "Try it on" link to `/try-on`.
- Sticky add-to-cart bar on mobile (reuse `MobileActionBar`). Related Products row.
- Delete `ModelLookbookStudio.tsx`, `ModelLookbookStudioModal.tsx`, its layout mount and `apparelStudio*` store state; delete `SneakerFitMatcherModal.tsx`.
- `ProductQuickView` uses the same option components.

### Phase 5 — Homepage & motion (`feat/homepage-redesign`)

- Order: Hero (turntable + Caps / Tees entry tiles) → Featured Products → Anatomy → Drop Radar → Tee Lookbook strip → Brand Story. Remove `ColorwayMarquee`.
- `AnatomyScroll`: keep pinned scroll on fine-pointer desktop only; on touch render stacked panels with light parallax (`useScroll` + `useTransform` on `transform` only).
- Tee Lookbook strip: horizontal scroll-snap of Lifestyle Shots linking to products, light parallax on images.
- Parallax depth layers in hero via transform only; gate with `(pointer: fine)` and reduced motion.
- Audit all loops/`whileInView` against `src/lib/motion.ts`; remove anything not routed through it.

## 4. Verification & Testing Checklist

- Per phase: `bun run test`, `bunx tsc --noEmit`, `bun run lint`, `bun run build`.
- Phase 1: every Product and every design × colorway has a Catalog Shot; contact sheet of all shots reviewed side by side for scale and centering.
- Phase 2: Convex tests for SKU reservation/deduct/release; old `/caps/{id}` URLs return 308 to `/products/{id}`; a tee order deducts the right SKU.
- Phase 3: filters round-trip through URL; back button restores state; empty state shows.
- Phase 4: buy a tee (colorway + size) and a cap end-to-end through Stripe test mode and WhatsApp concierge.
- Phase 5 + final: Lighthouse mobile ≥ 90 on `/`, `/products`, `/products/[slug]`; LCP < 2.5 s at 4× CPU throttle; no layout shift from images; `prefers-reduced-motion` disables all motion; check at 375px width, both locales, light/dark.
