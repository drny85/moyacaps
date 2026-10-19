# Product Images in Convex Storage

Product photos lived in `public/` and in string fields on `variants` (`catalogShot`, `images`, `colorways[].catalogShot/lifestyleImage`) plus the angle list in `catalogShots.json`. Adding or replacing a photo meant a code change and a deploy, so the Administrator could not manage images. The admin catalog foundation (plan 0004) moves them into Convex storage, managed from the admin.

## Decisions

1. **`productImages` rows.** Each row holds `variantId`, `colorway?`, `role` (`catalog | lifestyle | angle`), `angle?` (`front | left | back | right`), `order`, `storageId`, `sha256`, `width`, `height` and `createdAt`.
2. **Upload rules.** Administrator only. JPEG, PNG or WebP, at most 10 MB. Catalog and lifestyle images need a short side of at least 1600 px. Angle images must be PNG or WebP with alpha. The client checks the rules and the server checks them again by reading the file header.
3. **Deferred deletion.** Replacing or removing an image deletes the old file 15 minutes later, after the 5-minute ISR window (ADR 0020). A daily cron deletes unreferenced storage files older than 24 h.
4. **Reads prefer rows, then legacy fields.** Reads use `productImages` first and fall back to the legacy string fields and `catalogShots.json` angles, so the migration can run incrementally.
5. **Angles gate Try-On.** A cap without angle images is left out of Try-On and the turntable.
6. **Idempotent migration.** `scripts/migrate-product-images.ts --dev|--prod` skips files already stored, matched by sha256. Run dev first, then prod. Delete the `public/` product images only after prod is verified, and never rewrite git history. `variants.storageId` is dropped in a last, separately gated task.
7. **Owner crop guide, no background removal.** Owner uploads get an in-browser 4:5 crop guide. There is no background removal.
8. **Server-rendered catalog.** The catalog renders on the server and `STATIC_CATALOG` is removed.

## Consequences

- Photos are added or replaced without a deploy. Changes reach the static HTML within 5 minutes (ISR).
- `public/` shrinks once the migration is verified on prod.
- Until then both sources exist, and reads must keep the legacy fallback.
- Old files linger up to 15 minutes after a replace, and orphaned uploads up to 24 h.
