# Cap Variant Media Storage and Dynamic Asset Resolution

## Context
Previously, cap photography was served solely from local static bundles (`/caps/{variantId}.png`) hosted in Next.js `public/`. As administrative variant creation, image updating, and dynamic catalog capabilities expanded in Convex, relying exclusively on static filesystem assets limited independent asset uploads and risked broken links when deploying dynamic inventory changes. Furthermore, the system needed a clear boundary separating static marketing/editorial assets (e.g. 3D interactive angles) from dynamic inventory photography.

## Decision
1. **Convex Binary Storage for Cap Variants**:
   - All 16 primary Cap Variant colorway images are migrated into Convex Binary Storage (`_storage`).
   - Each Cap Variant document in the `variants` table persists an immutable `storageId: v.id("_storage")`.
   - Query resolvers (`getVariants`, `getVariantById`) dynamically resolve `storageId` into high-performance signed Convex CDN URLs on retrieval.
2. **Editorial & Showcase Static Asset Segregation**:
   - Shared multi-angle showcase assets (`/caps/angles/{front,back,left,right}.png`) remain in Next.js `public/` for instantaneous edge CDN caching during 3D hero rendering and scroll parallax animations.
3. **Resilient Local Fallback & Snapshot Integrity**:
   - If `storageId` is absent or unresolvable, queries fall back seamlessly to `/caps/{variantId}.png`.
   - Customer orders persist the resolved image URL upon settlement, protecting historical invoice audits against subsequent asset modifications.
4. **Idempotent CLI Migration Script**:
   - Migration is executed via a repeatable script (`scripts/migrate-storage.ts`) executed via Bun, uploading files to Convex storage endpoints and linking variant records idempotently.
