# Unified Product Catalog in Convex

Heavyweight Tees exist in Convex `variants` as one row per Graphic Design with a single stock number, but their Apparel Colorways, sizes, Lifestyle Shots and artwork live only in static `src/data/caps.ts`, and the only product route is `/caps/[id]`. So tee stock is not real per colorway or size, admin cannot edit tee options, and caps and tees cannot be filtered together from one source. We make Convex the single source for both categories, treat them as one **Product** concept served from `/products/[slug]` (slug = `variantId`), and permanently redirect `/caps/[id]`. Stock for tees is tracked per Graphic Design × Apparel Colorway × size in a dedicated `skus` table keyed by `variantId`; caps keep their single-row stock. We chose one catalog over keeping static tee data merged on the client because the redesign needs one card, one product page and one filter model, and stock must bound real purchases (ADR 0007).

## Consequences

- Old `/caps/[id]` links (shared URLs, emails, order snapshots, sitemap) must keep resolving through the redirect.
- Checkout and WhatsApp reservation (ADR 0007/0010/0014) must reserve and deduct from the `skus` row for tees, not the variant row.
- `src/data/caps.ts` stops being a runtime catalog; it remains seed input only.
