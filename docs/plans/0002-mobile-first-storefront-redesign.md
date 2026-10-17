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

- Remove `src/components/Cap3DViewer.tsx`, `src/data/capsManifest.ts` (if only used there), `scripts/generate-3d-glb.ts`, its `package.json` script, and `three`, `@react-three/fiber`, `@react-three/drei`, `@types/three`. Remove usages in `HeroInteractive.tsx` and `ProductDetailView.tsx`.
- New `scripts/build-catalog-shots.ts` (sharp):
  - **Caps**: trim alpha bounds of `public/caps/{variantId}.png`, scale to a fixed product width ratio, center on 1600×2000 `#ECEAE6` canvas, add a blurred ellipse ground shadow.
  - **Tees**: composite `public/shirts/graphics/{design}.jpg` (knock out the white background, multiply blend) onto `public/shirts/templates/{front|back}-{color}.jpg` at a per-design print box (front chest vs back print from tee data), then place on the same canvas.
  - Output `public/catalog/{variantId}[--{colorway}].{avif,webp}` at 1600×2000 plus a 800×1000 size; write `src/data/catalogShots.json` manifest.
  - Covers every design × colorway, including the current gaps (Angel Clover white, Gothic Angel non-white).
- Normalize Lifestyle Shots: re-encode `public/shirts/*.{jpg,png}` to consistent jpg/avif, fix Eagle Clover png/jpg mix, cap long edge at 2000px.
- Write `docs/photography-spec.md`: the shot list a future shoot must meet (backdrop, 4:5, lens/angle, lighting, centering, file naming, minimum 2000px long edge).
- `next.config.mjs`: confirm `images.formats` includes avif/webp and `deviceSizes` fit 4:5 cards.

### Phase 2 — Unified catalog in Convex (`feat/unified-product-catalog`)

Read `convex/_generated/ai/guidelines.md` first.

- `convex/schema.ts`: add tee fields to `variants` (`graphicDesign`, `printLocation`, `apparelColorways` with catalog/lifestyle image paths, `sizes`), add `skus` table `{ variantId, colorway, size, stock }` with index `by_variantId_colorway_size`.
- Migration (idempotent mutation + `scripts/` runner): seed `skus` from current tee stock split across colorways/sizes; copy static tee metadata into `variants`.
- `convex/products.ts`: `getVariants` gains `category`, `colorwayFamily`, `inStock` args and returns `catalogShot`; new `getProductBySlug` returning variant + SKUs.
- Inventory: `convex/stripe.ts` and `convex/orders.ts` reserve, deduct and release tee stock on the matching `skus` row (ADR 0007 idempotency unchanged). Add tests in `convex/orders.test.ts` for tee SKU reservation, oversell rejection and release.
- Admin products page: edit SKU stock per colorway × size.
- Routes: create `src/app/[locale]/products/[slug]/page.tsx` (moves current `caps/[id]` logic); `caps/[id]` → `permanentRedirect`. Update every `/caps/` link: `CapCard`, `DropRadar`, `ProductQuickView`, `ProductJsonLd`, `useProductShare`, `sitemap.ts`, `robots.ts`, admin drops/products, `DropScheduleDialog`, emails.
- Stop importing `CAP_VARIANTS` at runtime (`caps/[id]` page, `VirtualTryOnStudio`, studio); `src/data/caps.ts` becomes seed-only.

### Phase 3 — Shop page (`feat/shop-page`)

- `src/app/[locale]/products/page.tsx`: category tabs (All / Caps / Tees), filter chips (Colorway family, Silhouette, Graphic Design, In stock), sort (Featured, Newest, Price). State in URL query (`?category=tees&colorway=black&sort=price-asc`).
- Mobile: sticky tab bar, filters in a bottom sheet, 2-column grid; desktop 3–4 columns with filter sidebar.
- `ProductCard` (replaces `CapCard`): Catalog Shot, name, price, colorway dots, stock/drop badge; hover swap to Lifestyle Shot on pointer devices only.
- Navbar: "Shop", "Caps", "Tees" links to `/products?category=…`; remove `/#apparel-studio` links. Footer mirrors.
- i18n keys in `src/messages/{en,es}.json`. SEO metadata + canonical per category.

### Phase 4 — Product page (`feat/product-page`)

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
