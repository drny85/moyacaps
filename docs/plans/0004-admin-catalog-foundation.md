# Admin Catalog Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the Administrator control of everything a Customer sees or buys (every product field, every product image, shipping rules), with server-side validation, safe archiving and an audit trail.

**Architecture:** Convex stays the single catalog source (ADR 0015). Pure rule modules (`convex/catalog/rules.ts`, `convex/catalog/audit.ts`, `convex/catalog/images/*.ts`, `convex/settings/model.ts`) hold every decision and are unit-tested; Convex functions are thin wrappers. Product images move to a `productImages` table backed by Convex storage (decisions agreed 2026-10-17, recorded in ADR 0021). The 1379-line admin products page is split into focused components driven by a pure form model shared with the backend rules.

**Tech Stack:** Convex 1.46 (convex-test, Vitest edge-runtime), Next.js 16 App Router, next-intl, React 19, Tailwind.

**Spec:** the gap analysis in this session (gaps 1–11) plus the product-images decisions in the memory note `product-images-to-convex-plan`. Both are summarised under *Decisions* below; this file is the spec of record.

## Decisions (settled — do not re-ask)

1. **Archive replaces delete.** `variants.archivedAt` (epoch ms). Archiving also sets `isAvailable: false`. Archived products are excluded from every storefront read and from checkout, hidden from the admin list by default ("Show archived" toggle), and their slug stays reserved. `restoreVariant` clears `archivedAt` and leaves the product hidden. A permanent purge exists only as an internal mutation (`npx convex run`), never in the UI.
2. **Create and update are separate mutations.** `createVariant` rejects an existing slug; `updateVariant` requires `expectedUpdatedAt` and rejects a stale edit (optimistic concurrency). `saveVariant` is removed.
3. **Every catalog write is audited** in a `catalog_events` table: who (admin email), what (event type), field-level before/after diff, when.
4. **Validation lives in one pure module** (`convex/catalog/rules.ts`), imported by the mutations and by the admin form (`@convex/catalog/rules`).
   - slug: `^[a-z0-9]+(?:-[a-z0-9]+)*$`, 3–60 chars
   - names EN/ES: trimmed, 1–80 chars
   - `priceUsd`: finite, `> 0`, `≤ 10000`, at most 2 decimals
   - stock: integer `0–100000`
   - hex: `^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$`
   - category: `"headwear" | "apparel"`
   - silhouette: `"snapback" | "trucker"` for headwear, `"tee"` for apparel
   - taxCode: `^txcd_\d{8}$`; defaults `headwear → "txcd_30060006"`, `apparel → "txcd_30011000"`
   - descriptions EN/ES: ≤ 1000 chars; badge text EN/ES: ≤ 24 chars
5. **Store settings** live in a single `store_settings` row (`key: "default"`): `flatShippingFeeUsd` (default 8) and `freeShippingThresholdUnits` (default 2). Server is authoritative; the cart and checkout pages read the same values through a public query. The hardcoded `2` and `8` in `CartDrawer.tsx` and `checkout/page.tsx` are deleted.
6. **Badges are per product.** New optional `badgeTextEn/Es` on `variants`; `toCapVariant` uses them instead of the hardcoded "Signature Edition" / "Heavyweight Drop". A migration copies today's strings onto currently featured products so nothing changes visually.
7. **Product images (ADR 0021):**
   - `productImages` rows: `variantId`, `colorway?`, `role` (`catalog | lifestyle | angle`), `angle?` (`front | left | back | right`), `order`, `storageId`, `sha256`, `width`, `height`, `createdAt`.
   - Upload rules: admin only. JPEG, PNG or WebP, ≤ 10 MB. Catalog and lifestyle images need a short side of at least 1600 px. Angle images must be PNG or WebP with alpha. Rules are checked in the client and again on the server, by reading the file header.
   - Replacing or removing an image deletes the old file 15 minutes later, after the 5-minute ISR window. A daily cron deletes unreferenced storage files older than 24 h.
   - Reads prefer `productImages` rows and fall back to the legacy string fields (`catalogShot`, `images`, `colorways[].catalogShot/lifestyleImage`, `catalogShots.json` angles). Migration can then run incrementally.
   - A cap without angle images is left out of Try-On and the turntable.
   - `scripts/migrate-product-images.ts --dev|--prod` is idempotent by sha256. Run dev first, then prod. Delete `public/` product images only after prod is verified, never rewriting git history. `variants.storageId` is dropped in a last, separately gated task.
   - Owner uploads get an in-browser 4:5 crop guide. There is no background removal.
   - The catalog renders on the server and `STATIC_CATALOG` is removed.
8. **Out of scope:** MXN pricing (`priceMxn`, `basePriceMxn` stay unused), homepage/lookbook/Anatomy content editing (separate CMS plan), the legacy `products` table.

## Delivery

Four PRs, each off `origin/main`, each green on `bun run test` and `bunx tsc --noEmit` before review:

| PR | Branch | Tasks |
|---|---|---|
| 1 | `feat/catalog-rules-audit-archive` | 1–5 |
| 2 | `feat/store-settings` | 6 |
| 3 | `feat/product-images-convex` | 7–13 (Task 14 later, after prod verify) |
| 4 | `feat/admin-product-editor` | 15–18 |

Run `npx convex codegen` after every schema or function change before type-checking.

## Global Constraints

- Read `convex/_generated/ai/guidelines.md` before touching `convex/`. Object-form functions with `args` and `returns` validators everywhere, `.take(n)` never `.collect()`, no `Date.now()` in queries, `ctx.db.patch("table", id, …)` form.
- Throw `ConvexError` (not `Error`) for every user-facing rejection so the admin UI can show `err.data`.
- Every new public mutation/query/action calls `requireAdmin` / `requireAdminInAction` unless it is a storefront read.
- Domain words from `CONTEXT.md`: Product, Catalog Shot, Lifestyle Shot, SKU, Apparel Colorway, Administrator. UI copy goes in `src/messages/en.json` and `es.json` under `admin.products.*`.
- No `any` in new or touched admin code.
- Each pure module gets a colocated `*.test.ts`; each Convex function gets at least one convex-test case (pattern: `convex/orders/returnContracts.test.ts`, `asAdmin = t.withIdentity({ subject: "user_admin", email: PRIMARY_ADMIN_EMAIL })`).
- Commits: conventional (`feat(catalog): …`), ending with the `Co-Authored-By` line.

## Review Focus

1. **Archive while a Customer is mid-checkout:** a cart holding an archived product must fail pricing with the existing "unavailable" message and reserve or deduct nothing. Test in Task 4.
2. **Removing a tee colorway or size that still holds stock:** must be rejected with a message naming the SKU, so no stock is silently orphaned. Test in Task 16.
3. **Image replaced while ISR HTML still points at the old URL:** the old file must survive at least 15 minutes. Test in Task 9: deletion is scheduled, not immediate.
4. **Two Administrators editing the same product:** the second save must be rejected as stale, not overwrite. Test in Task 3.
5. **Shipping settings changed while a cart is open:** the charged fee must come from the server settings, never the client. Test in Task 6 (`priceCart` uses settings) and the WhatsApp path.

---

## PR 1 — Rules, audit, archive

### Task 1: Pure catalog rules

**Files:**
- Create: `convex/catalog/rules.ts`, `convex/catalog/rules.test.ts`

**Interfaces:**
- Produces:
  - `type Category = "headwear" | "apparel"`
  - `const CATEGORIES`, `const SILHOUETTES_BY_CATEGORY: Record<Category, readonly string[]>`, `const DEFAULT_TAX_CODE: Record<Category, string>`
  - `type FieldError = { field: string; code: "required" | "format" | "range" | "too_long" | "mismatch" | "taken" }`
  - `validateProductFields(input: ProductFieldsInput): FieldError[]` (empty means valid)
  - `ProductFieldsInput = { variantId?: string; nameEn: string; nameEs: string; category: Category; silhouette: string; primaryHex: string; secondaryHex: string; priceUsd: number; stock?: number; taxCode?: string; descriptionEn?: string; descriptionEs?: string; badgeTextEn?: string; badgeTextEs?: string }`
  - `normalizeSlug(raw: string): string`: trims, lowercases, turns spaces and underscores into `-`, collapses repeated `-`
  - `resolveTaxCode(category: Category, taxCode?: string): string`
  - `throwIfInvalid(errors: FieldError[]): void`: throws `ConvexError({ kind: "validation", errors })`

- [ ] **Step 1: Write failing tests** covering:
  - valid cap and valid tee return `[]`
  - `priceUsd` values `0`, `-1`, `NaN`, `10000.01` and `12.345` each give a `range` error on `priceUsd`
  - `stock` `1.5` and `-1` give `range`
  - `primaryHex: "red"` gives `format`
  - `silhouette: "tee"` with `category: "headwear"` gives `mismatch`
  - a slug `"Black Gold"` gives `format`, and `normalizeSlug("  Black  Gold_ ")` returns `"black-gold"`
  - a 25-char badge gives `too_long`
  - `resolveTaxCode("apparel")` returns `"txcd_30011000"`
- [ ] **Step 2:** `bunx vitest run convex/catalog/rules.test.ts` and confirm it fails (module missing).
- [ ] **Step 3:** Implement with the limits from Decision 4.
- [ ] **Step 4:** Re-run; PASS.
- [ ] **Step 5:** Commit `feat(catalog): pure product field rules`.

### Task 2: Audit log

**Files:**
- Modify: `convex/schema.ts`
  - add `catalog_events` table
  - add `variants.archivedAt`, `variants.updatedAt`, `variants.descriptionEn/Es`, `variants.badgeTextEn/Es` (all `v.optional`)
- Create: `convex/catalog/audit.ts`, `convex/catalog/audit.test.ts`, `convex/catalog/history.ts`

**Interfaces:**
- Schema: `catalog_events: { variantId: v.optional(v.string()), type: v.string(), actor: v.string(), changes: v.optional(v.string()) /* JSON of FieldChange[] */, createdAt: v.number() }` with indexes `by_variantId_and_createdAt` and `by_createdAt`.
- Event types (string union exported as `CatalogEventType`): `created | updated | archived | restored | stock_adjusted | sku_stock_set | price_set | featured_toggled | visibility_set | drop_changed | image_added | image_replaced | image_removed | images_reordered | settings_updated | purged`.
- Produces:
  - `diffFields(before: Record<string, unknown>, after: Record<string, unknown>): FieldChange[]`: pure, deep-compares by JSON, skips keys starting with `_`
  - `type FieldChange = { field: string; from: unknown; to: unknown }`
  - `recordCatalogEvent(ctx: MutationCtx, e: { variantId?: string; type: CatalogEventType; actor: string; changes?: FieldChange[] }): Promise<void>`
  - `actorEmail(identity: UserIdentity): string`: email, else subject
  - `getVariantHistory` (public query, admin): args `{ variantId: string }`, returns the latest 50 events, newest first
- Consumes: `requireAdmin` must return the identity. Check `convex/lib/auth.ts`, and if it returns `void`, change it to return the `UserIdentity` (callers that ignore it are unaffected).

- [ ] **Step 1:** Write failing tests:
  - `diffFields({a:1,b:[1]},{a:2,b:[1]})` returns `[{field:"a",from:1,to:2}]`
  - unchanged input returns `[]`
  - convex-test: `recordCatalogEvent` then `getVariantHistory` returns that event, newest first
  - `getVariantHistory` without an identity throws
- [ ] **Step 2:** Run; FAIL.
- [ ] **Step 3:** Implement. Add the schema fields. Run `npx convex codegen`.
- [ ] **Step 4:** Run; PASS.
- [ ] **Step 5:** Commit `feat(catalog): audit log for catalog writes`.

### Task 3: createVariant / updateVariant with validation, concurrency and audit

**Files:**
- Modify: `convex/catalog/admin.ts`
  - remove `saveVariant`
  - add `createVariant` and `updateVariant`
  - audit every existing mutation (`updateVariantStock`, `adjustVariantStock`, `updateVariantPrice`, `toggleVariantFeatured`, `toggleVariantAvailable`, `setTeeSkuStock`)
  - validate price and stock in them with `rules.ts`
  - `requireVariant` throws `ConvexError`
- Modify: `convex/catalog/model.ts`. Replace `mergeVariantUpdate`/`newVariantDoc` with `buildVariantPatch(existing, input, now)` and `buildNewVariant(input, now)`. Category and taxCode come from `resolveTaxCode`, and every write stamps `updatedAt: now`.
- Modify: `convex/catalog/drops.ts`. Audit drop mutations as `drop_changed`.
- Modify: `src/app/[locale]/admin/products/page.tsx`. Call `createVariant` / `updateVariant`, and pass `expectedUpdatedAt: editingVariant.updatedAt ?? editingVariant._creationTime`. Show `err.data.errors` next to fields. Delete the unused `updatePrice` hook (line 79).
- Test: `convex/catalog/admin.test.ts` (new), `convex/catalog/model.test.ts` (update)

**Interfaces:**
- `createVariant` args: `ProductFieldsInput` fields plus `image: v.optional(v.string())`, `isFeatured`, `isAvailable`. Returns `{ id: Id<"variants">, variantId: string }`.
- `updateVariant` args: `{ variantId, expectedUpdatedAt: v.number(), patch: v.object({...all editable fields optional}) }`. Returns `{ updatedAt: number }`.
- Stale check: `(existing.updatedAt ?? existing._creationTime) !== expectedUpdatedAt` throws `ConvexError({ kind: "stale" })`.
- Tee stock is never written through `updateVariant`. It throws `TEE_STOCK_EDIT_ERROR` when `patch.stock` is set on a variant with SKUs.

- [ ] **Step 1:** Write failing convex-test cases:
  - create a cap, then `history[0].type === "created"`
  - create with an existing slug throws `kind: "validation"`, with `field: "variantId"` and `code: "taken"`
  - create with `category: "apparel"` and no taxCode stores `"txcd_30011000"`
  - update with a fresh `expectedUpdatedAt` succeeds and returns a newer `updatedAt`
  - a second update reusing the old `expectedUpdatedAt` throws `kind: "stale"` (**Review Focus 4**)
  - `updateVariantPrice({priceUsd: 0})` throws `validation`
  - `adjustVariantStock` writes a `stock_adjusted` event whose changes are `[{field:"stock",from:1,to:3}]`
- [ ] **Step 2:** Run; FAIL.
- [ ] **Step 3:** Implement backend. Update the page to the new calls. Run `npx convex codegen && bunx tsc --noEmit`.
- [ ] **Step 4:** `bun run test`; PASS.
- [ ] **Step 5:** Commit `feat(catalog): validated create/update with optimistic concurrency`.

### Task 4: Archive / restore / purge

**Files:**
- Modify: `convex/catalog/admin.ts`
  - remove `deleteVariant`
  - add `archiveVariant`, `restoreVariant` (public, admin) and `purgeVariant` (internal)
  - `getAllProductsAdmin` gains `includeArchived: v.optional(v.boolean())`
- Modify: `convex/catalog/model.ts`. `filterCatalogVariants` always drops `archivedAt !== undefined`, even with `includeUnavailable`.
- Modify: `convex/catalog/inventory.ts`. `checkStock` returns `reason: "unavailable"` for archived products.
- Modify: `convex/catalog/queries.ts`. `getVariantById` and `getProductBySlug` return `null` for archived products, even for admins with `allowUnavailable`. `getAllProductsAdmin` is the admin path.
- Modify: `convex/catalog/drops.ts`. `getUpcomingDrops` skips archived products.
- Modify: admin page. The delete button becomes Archive (confirm dialog reuses the existing one, with new copy). Add a "Show archived" filter and a Restore action on archived rows.
- Test: `convex/catalog/admin.test.ts`, `convex/catalog/model.test.ts`, `convex/payments/checkoutModel.test.ts` (or the existing checkout test file)

**Interfaces:**
- `archiveVariant({ variantId })` / `restoreVariant({ variantId })` return `successResult`.
- `purgeVariant({ variantId })` (internal) deletes, in this order:
  1. SKUs (`listSkus`)
  2. drop alerts, in batches (reuse `deleteAlertBatch`, exported from `drops.ts`)
  3. `productImages` rows and their files (added in PR 3; leave a `// PR 3` hook until then)
  4. legacy `storageId`
  5. the row itself
  
  It logs `purged`.

- [ ] **Step 1:** Write failing tests:
  - archive, then `getVariants({includeUnavailable:true})` excludes the product
  - archived products are excluded from `getProductBySlug` for an admin with `allowUnavailable`
  - archived products are excluded from `getAllProductsAdmin({})`, and included with `includeArchived:true`
  - restore makes it reappear in admin with `isAvailable:false`
  - `priceCart`/`createCheckoutSession` with an archived line rejects with the unavailable message and leaves stock unchanged (**Review Focus 1**). Use the existing checkout test harness, or test `validateCartLines` with the `checkStock` result.
  - `purgeVariant` removes the SKU and alert rows
- [ ] **Step 2:** Run; FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** `bun run test && bunx tsc --noEmit`; PASS.
- [ ] **Step 5:** Commit `feat(catalog): archive replaces delete`.

### Task 5: History panel in the admin editor

**Files:**
- Create: `src/components/admin/products/ProductHistory.tsx`
- Modify: admin page edit modal. Add a "History" section listing `getVariantHistory` (time, actor, type, `field: from → to`).
- Modify: `src/messages/en.json`, `es.json` (`admin.products.history.*`, archive copy)

- [ ] **Step 1:** Implement. Start the preview and open `/en/admin/products`. Edit a price. Confirm the History section shows `price_set 120 → 125` and the console has no errors.
- [ ] **Step 2:** Commit `feat(admin): product change history`. Open PR 1.

---

## PR 2 — Store settings

### Task 6: Shipping settings, server-authoritative

**Files:**
- Modify: `convex/schema.ts`. Add `store_settings: { key: v.literal("default"), flatShippingFeeUsd: v.number(), freeShippingThresholdUnits: v.number(), updatedAt: v.number() }` with index `by_key`.
- Create: `convex/settings/model.ts` + `.test.ts`, `convex/settings/functions.ts`
- Modify: `convex/orders/model.ts`. `computeShipping(totalUnits, settings: ShippingSettings)`. Delete `FREE_SHIPPING_THRESHOLD_CAPS` and `FLAT_SHIPPING_FEE_USD`, which move into the defaults.
- Modify: callers `convex/payments/checkout.ts:61,449-450` and `convex/orders/whatsapp.ts:169`. Load settings with `getShippingSettings(ctx)`. Actions use an internal query.
- Create: `src/hooks/useStoreSettings.ts`
- Modify: `src/components/cart/CartDrawer.tsx:99-100,529`, `src/app/[locale]/checkout/page.tsx:55-56`, `src/components/layout/Navbar.tsx` (banner)
- Modify: messages. Replace the literal "2+" and "$8" with ICU params `{threshold}` and `{fee}` in `freeShippingBanner`, `freeShipping` (the `209` key), `freeShippingRemaining`, and the inline `"FREE (2+ caps)"` string in `CartDrawer.tsx:529`.
- Create: `src/components/admin/StoreSettingsCard.tsx`, mounted on `src/app/[locale]/admin/page.tsx`

**Interfaces:**
- `type ShippingSettings = { flatShippingFeeUsd: number; freeShippingThresholdUnits: number }`
- `DEFAULT_SHIPPING_SETTINGS: ShippingSettings = { flatShippingFeeUsd: 8, freeShippingThresholdUnits: 2 }`
- `validateShippingSettings(s): FieldError[]`. Fee: finite, `0–100`, at most 2 decimals. Threshold: integer `1–50`.
- `getShippingSettings(ctx: QueryCtx): Promise<ShippingSettings>`. Returns the row or the defaults.
- `settings/functions.ts`:
  - `getStoreSettings` (public query): returns `ShippingSettings`
  - `getStoreSettingsInternal` (internal query)
  - `updateStoreSettings` (admin mutation): validates, upserts, logs a `settings_updated` event with the diff
- `useStoreSettings(): ShippingSettings`. Returns the live query, or `DEFAULT_SHIPPING_SETTINGS` while loading.

- [ ] **Step 1:** Write failing tests:
  - `computeShipping(1, {flatShippingFeeUsd:5, freeShippingThresholdUnits:3})` returns `{freeShipping:false, shippingFee:5}`
  - `computeShipping(3, …)` returns `0`
  - validation rejects fee `-1` and threshold `0`
  - convex-test: update settings to fee 5, then a WhatsApp order's `verifiedShippingFee` is 5 (**Review Focus 5**)
  - `updateStoreSettings` without admin throws
- [ ] **Step 2:** Run; FAIL.
- [ ] **Step 3:** Implement backend. Then update the client. `grep -rnE ">= 2|: 8\b|2\+" src/components/cart src/app/\[locale\]/checkout` must return no shipping hits.
- [ ] **Step 4:** `bun run test && bunx tsc --noEmit`; PASS. In the preview, set the fee to 5 in admin. Confirm the cart drawer shows $5.00 and the banner copy follows.
- [ ] **Step 5:** Commit `feat(settings): admin-controlled shipping rules`. Open PR 2.

---

## PR 3 — Product images in Convex (ADR 0021)

### Task 7: ADR 0021 + schema

**Files:**
- Create: `docs/adr/0021-product-images-in-convex-storage.md`. Use the Decision 7 bullets as decisions; consequences: no deploy to add photos, public/ shrinks after migration, ISR delay ≤ 5 min.
- Modify: `convex/schema.ts`. Add `productImages` (fields from Decision 7) with indexes `by_variantId_and_role_and_order` on `["variantId","role","order"]`, `by_storageId`, `by_sha256`.
- Modify: `docs/plans/README.md`. Add rows 0003 and 0004.

- [ ] **Step 1:** Write files. Run `npx convex codegen`. `bunx tsc --noEmit` passes.
- [ ] **Step 2:** Commit `docs(adr): 0021 product images in Convex storage`.

### Task 8: Pure image rules

**Files:**
- Create: `convex/catalog/images/header.ts` + `.test.ts`, `convex/catalog/images/rules.ts` + `.test.ts`

**Interfaces:**
- `readImageHeader(bytes: Uint8Array): { format: "png" | "jpeg" | "webp"; width: number; height: number; hasAlpha: boolean } | null`
  - PNG: IHDR, alpha when colour type is 4 or 6, or a `tRNS` chunk precedes `IDAT`
  - JPEG: scan to the SOF0/1/2 marker; `hasAlpha: false`
  - WebP: `VP8 ` / `VP8L` (alpha bit) / `VP8X` (alpha flag, canvas size)
  - reads at most the first 64 KB
- `type ImageRole = "catalog" | "lifestyle" | "angle"`, `type CapAngle = "front" | "left" | "back" | "right"`
- `MAX_IMAGE_BYTES = 10 * 1024 * 1024`, `MIN_SHORT_SIDE = 1600`
- `checkImageUpload(input: { role: ImageRole; bytes: number; header: ReturnType<typeof readImageHeader> }): ImageRuleError | null`
  - `ImageRuleError = "unsupported_format" | "too_large" | "too_small" | "needs_transparency"`
  - angle images skip the short-side rule

- [ ] **Step 1:** Write failing tests with hand-built byte fixtures (helper `pngHeader(w,h,colourType)`, `webpVP8X(w,h,alpha)`, `jpegSOF(w,h)` in the test file), plus garbage bytes → `null`. Rules:
  - 9 MB 2000×2500 JPEG catalog → `null`
  - 11 MB → `too_large`
  - 1200×1500 catalog → `too_small`
  - RGB PNG angle → `needs_transparency`
  - GIF bytes → `unsupported_format`
- [ ] **Step 2:** Run; FAIL. **Step 3:** Implement. **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(images): pure header parsing and upload rules`.

### Task 9: Upload, replace, remove, reorder

**Files:**
- Create: `convex/catalog/images/functions.ts` (queries and mutations), `convex/catalog/images/attach.ts` (action, default runtime), `convex/catalog/images/functions.test.ts`

**Interfaces:**
- `attachImage` (public action):
  - args `{ variantId, storageId: v.id("_storage"), role, colorway?: v.string(), angle?: capAngle, replaceImageId?: v.id("productImages") }`
  - steps: `requireAdminInAction` → `ctx.storage.get(storageId)` → read the first 64 KB → `readImageHeader` → `checkImageUpload` → compute sha256 (`crypto.subtle.digest`) → `runMutation(internal…insertOrReplaceImage)`
  - on a rule failure: delete the uploaded file, then throw `ConvexError({ kind: "image_rule", code })`
- `insertOrReplaceImage` (internal mutation):
  - validates that `colorway` is one of the tee's colorways and that `angle` is given only when `role === "angle"`
  - a `catalog` image per (variant, colorway) and an `angle` image per (variant, angle) are unique: a second upload replaces the first
  - `order` = max + 1 within the role
  - on replace, schedules `deleteStorageFile` at `REPLACED_FILE_GRACE_MS = 15 * 60 * 1000`
  - logs `image_added` / `image_replaced`
  - returns `{ imageId }`
- `removeImage({ imageId })` and `reorderImages({ variantId, role, colorway?, orderedIds: v.array(v.id("productImages")) })` (admin mutations). Both log events. Removal also schedules file deletion with the same grace period.
- `deleteStorageFile({ storageId })` (internal mutation): skips the delete if a `productImages` row still references the file (`by_storageId`).
- `listProductImages({ variantId })` (admin query): rows with resolved `url`, ordered by role, then order.
- `purgeVariant` (Task 4) now deletes image rows and schedules their files.

- [ ] **Step 1:** Write failing convex-test cases. Store a real PNG blob via `t.run(ctx => ctx.storage.store(new Blob([bytes])))`.
  - a valid catalog image attaches and is listed
  - a second catalog upload for the same colorway replaces the first, and exactly one `deleteStorageFile` is scheduled 15 min out. Assert via `t.finishInProgressScheduledFunctions` / `vi.advanceTimersByTime`: the old file still exists before 15 min (**Review Focus 3**) and is gone after.
  - a too-small image throws `image_rule/too_small` and the upload is deleted
  - reorder persists the new order
  - a non-admin `attachImage` throws
- [ ] **Step 2:** Run; FAIL. **Step 3:** Implement. **Step 4:** `bun run test`; PASS.
- [ ] **Step 5:** Commit `feat(images): admin image upload, replace, remove, reorder`.

### Task 10: Read model — storefront resolves images from the table

**Files:**
- Modify: `convex/catalog/shared.ts`. Replace `resolveVariantWithStorageUrl` with `resolveProduct(ctx, variant)`. It reads `productImages` by `by_variantId_and_role_and_order` (`.take(60)`), resolves URLs, and overlays:
  - `catalogShot`: the catalog image without a colorway
  - `images`: lifestyle images without a colorway
  - each `colorways[i].catalogShot` and `lifestyleImage`: from that colorway's images
  - `angles?: { front, left, back, right }`: only when all four exist
  
  Legacy values stay where no row exists. Keep the legacy `storageId → image` swap until Task 14.
- Modify: `convex/catalog/validators.ts`. `resolvedVariant` gains `angles: v.optional(v.object({ front: v.string(), left: v.string(), back: v.string(), right: v.string() }))`.
- Modify: `convex/catalog/queries.ts`, `admin.ts`, `drops.ts`. Use `resolveProduct`.
- Modify: `src/lib/toCapVariant.ts` (map `angles`), `src/data/caps.ts` (`CapVariant.angles?`), `src/lib/capAngles.ts`. `getCapAngleImages(cap: CapVariant)` and `getCapFrontOverlay(cap: CapVariant)` prefer `cap.angles`, then the JSON fallback. Update their callers (`grep -rn "getCapAngleImages\|getCapFrontOverlay" src`).
- Test: `convex/catalog/shared.test.ts` (new), `src/lib/capAngles.test.ts` (new or existing)

- [ ] **Step 1:** Write failing tests:
  - a variant with a catalog row has `catalogShot` = that URL
  - without rows, it keeps its legacy `catalogShot`
  - a tee colorway row overrides only that colorway
  - three of four angles gives `angles` undefined
  - `getCapFrontOverlay({ ...cap, angles: {front:"u", …} })` returns `"u"`
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** `bun run test && bunx tsc --noEmit`; PASS.
- [ ] **Step 5:** Commit `feat(images): storefront reads product images from Convex`.

### Task 11: Orphan cleanup cron

**Files:**
- Create: `convex/catalog/images/cleanup.ts` + test
- Modify: `convex/crons.ts`. Add `crons.interval("product-image-orphan-cleanup", { hours: 24 }, internal.catalog.images.cleanup.sweepOrphans, {})`.

**Interfaces:**
- `sweepOrphans({ cursor?: v.union(v.string(), v.null()), now?: v.number() })` (`now` defaults to `Date.now()`; tests inject it) (internal mutation):
  - pages `ctx.db.system.query("_storage")` 200 at a time
  - deletes a file older than `ORPHAN_AGE_MS = 24h` only when no `productImages.by_storageId` row and no `variants.storageId` references it
  - the variants check is a bounded scan of `listCatalogVariants`, built once into a Set per batch
  - schedules itself with the next cursor until done
  - returns `{ scanned, deleted }`

- [ ] **Step 1:** Write failing test. Insert three files: one referenced, one unreferenced and fresh, one unreferenced and 25 h old (patching `_creationTime` isn't possible, so inject `now` as an arg: `sweepOrphans({ cursor: null, now })`). Only the old orphan is deleted.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** Commit `feat(images): daily orphan storage sweep`.

### Task 12: Migration script

**Files:**
- Create: `scripts/migrate-product-images.ts`, `scripts/lib/productImageSources.ts` + `.test.ts`
- Create: `convex/catalog/images/migration.ts` with:
  - internal mutation `importImage({ variantId, role, colorway?, angle?, storageId, sha256, width, height })`: a no-op returning `{ skipped: true }` when `by_sha256` already has a row for the same variant, role, colorway and angle
  - internal query `hasSha256({ sha256 })`
- Modify: `package.json`. Add script `"migrate:product-images": "bun run scripts/migrate-product-images.ts"`.

**Interfaces:**
- `collectImageSources(catalogShots, capsManifest, variants): ImageSource[]` (pure). `ImageSource = { variantId; role; colorway?; angle?; publicPath }` built from:
  - `catalogShots.caps[id].catalog` → catalog
  - `catalogShots.caps[id].angles` → angle ×4
  - `catalogShots.tees[id].colorways[c]` → catalog + colorway
  - each tee `colorways[].lifestyleImage` → lifestyle + colorway
  - each variant's `images[]` (excluding its `image`) → lifestyle
- The script:
  - takes the flag `--dev|--prod`; `--prod` passes `--prod` to every `bunx convex run`
  - pipeline per file: hash the file → `hasSha256` → skip, or upload via `generateUploadUrlInternal` + `fetch` → `importImage`
  - reads dimensions with `sharp` (dev dependency already present)
  - prints a summary `{ uploaded, skipped, failed }`
  - exits 1 on any failure

- [ ] **Step 1:** Write failing test for `collectImageSources`, using a two-cap, one-tee fixture with exact expected entries.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** Run `bun run migrate:product-images --dev` twice. The second run reports `uploaded: 0`. Check `/en/products` in the preview: images still render, now with Convex URLs (inspect `img.src`).
- [ ] **Step 6:** Commit `feat(images): idempotent product image migration script`.

### Task 13: Admin image manager + server-rendered catalog

**Files:**
- Create: `src/components/admin/products/ProductImagesPanel.tsx`. Sections:
  - Catalog Shot (one per colorway for tees)
  - Lifestyle Shots (ordered, with up/down)
  - Angles (caps only: front/left/back/right)
  
  Each slot can upload, replace or remove.
- Create: `src/components/admin/products/CropGuide.tsx`. A 4:5 overlay on the local preview before upload.
- Create: `src/lib/admin/imageUpload.ts` + `.test.ts`. `preflightImage(file: File): Promise<ImageRuleError | null>` reads the first 64 KB and reuses `readImageHeader` / `checkImageUpload` from `@convex/catalog/images/*`.
- Modify: `src/hooks/useCapVariants.ts`. Remove `STATIC_CATALOG` and add an `initial: CapVariant[]` parameter: `useCapVariants(initial)`.
- Modify: the server pages that render Shop, Home and Try-On (`src/app/[locale]/page.tsx`, `src/app/[locale]/products/**/page.tsx`, the try-on page). Fetch `queryForStaticRender(api.catalog.queries.getVariants, {})`, map with `toCapVariant`, and pass the result down as `initialProducts` to `ShopView`, `FeaturedProducts`, `HeroInteractive` and `TryOnStudio`.

- [ ] **Step 1:** Write failing tests for `preflightImage` (same fixtures as Task 8, wrapped in `File`).
- [ ] **Step 2–3:** FAIL → implement the panel and the server-render change.
- [ ] **Step 4:** Verify:
  - `bunx tsc --noEmit && bun run test` pass
  - `bun run build`, then `grep -o 'convex.cloud/api/storage[^"]*' .next/server/app/en/products.html | head -1` prints a URL, proving images are in the server HTML without client JS
  - in the preview, upload a new catalog image for one cap in admin, reload `/en/products`, and confirm the card shows it
- [ ] **Step 5:** Commit `feat(images): admin image manager and server-rendered catalog`. Open PR 3.

### Task 14 (gated: after prod migration is verified): retire legacy image fields

- [ ] Run `bun run migrate:product-images --prod`, then spot-check 5 products on goodluckcaps.com.
- [ ] Delete the migrated product files from `public/caps`, `public/shirts` and the catalog-shot outputs. Keep site assets per Decision 7.
- [ ] Remove `variants.storageId`, `generateUploadUrl` legacy use, `setVariantStorageId`, `scripts/migrate-storage.ts` and the JSON fallbacks in `capAngles.ts`.
- [ ] `bun run test && bunx tsc --noEmit && bun run build`. Commit `chore(images): retire legacy image fields`. This needs a separate PR and the owner's go-ahead.

---

## PR 4 — Full product editor

### Task 15: Pure admin form model

**Files:**
- Create: `src/lib/admin/productForm.ts` + `.test.ts`

**Interfaces:**
- `type ProductFormState = { variantId; nameEn; nameEs; category: Category; silhouette; primaryHex; secondaryHex; priceUsd: string; stock: string; taxCode; descriptionEn; descriptionEs; badgeTextEn; badgeTextEs; isFeatured; isAvailable; fabricEn; fabricEs; fitEn; fitEs; printPosition?: "front"|"back"; sizes: string[]; defaultColorway?: string; colorways: ColorwayDraft[] }`
- `ColorwayDraft = { id; nameEn; nameEs; hex; borderHex }`. Images come from `productImages`, not the form.
- `emptyForm(category: Category): ProductFormState`, `formFromVariant(v: ResolvedVariant): ProductFormState`
- `formToCreateArgs(f): CreateVariantArgs`, `formToPatch(initial: ProductFormState, f): UpdatePatch` (only changed fields)
- `validateForm(f): FieldError[]`. Delegates to `validateProductFields`. Adds tee rules: ≥1 colorway, ≥1 size, `defaultColorway` must be in colorways, colorway ids unique and slug-formatted.

- [ ] **Step 1:** Write failing tests:
  - round trip: `formToPatch(formFromVariant(v), formFromVariant(v))` returns `{}`
  - changing the price only gives `{ priceUsd: 125 }`
  - switching category to apparel resets silhouette to `"tee"`
  - a tee with zero sizes gives a `required` error on `sizes`
  - the string price `"12.5"` becomes `12.5`
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** Commit `feat(admin): pure product form model`.

### Task 16: Backend tee options with SKU consistency

**Files:**
- Modify: `convex/catalog/admin.ts`. `createVariant` and `updateVariant` accept the tee fields, `descriptionEn/Es` and `badgeTextEn/Es`.
- Create: `convex/catalog/skuPlan.ts` + `.test.ts`
- Modify: `convex/catalog/migrations.ts`. Add internal `backfillBadges`, which sets `badgeTextEn/Es` to `"Signature Edition"/"Edición Insignia"` (caps) or `"Heavyweight Drop"/"Drop Heavyweight"` (tees) on featured rows missing them.
- Modify: `src/lib/toCapVariant.ts`. `tagEn/Es` = `v.badgeTextEn/Es`. Remove the hardcoded strings.

**Interfaces:**
- `planSkuChanges(before: { colorways: string[]; sizes: string[] }, after: same, skus: { colorway; size; stock }[]): { insert: { colorway; size }[]; remove: { colorway; size }[]; blocked: { colorway; size; stock }[] }`. Removal of a cell with `stock > 0` goes to `blocked`.
- `updateVariant` throws `ConvexError({ kind: "sku_in_stock", cells: blocked })` when `blocked` is non-empty. Otherwise it inserts zero-stock SKUs for new cells, deletes removed empty cells, and re-syncs the aggregate.
- `createVariant` with `category: "apparel"` inserts a zero-stock SKU per colorway × size. `stock` is ignored for tees.

- [ ] **Step 1:** Write failing tests:
  - `planSkuChanges` when adding size `"3XL"` inserts one cell per colorway
  - removing colorway `"lime"` where `lime/M` has stock 2 gives `blocked: [{colorway:"lime",size:"M",stock:2}]` (**Review Focus 2**)
  - convex-test: create a tee with 2 colorways × 5 sizes gives 10 SKU rows at 0
  - an update that removes a stocked colorway throws `sku_in_stock` and leaves the rows untouched
  - `backfillBadges` is idempotent
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** Commit `feat(catalog): editable tee options with SKU consistency`.

### Task 17: Split the admin products page

**Files:**
- Create under `src/components/admin/products/`:
  - `ProductList.tsx`: search, category/availability/archived filters, rows
  - `ProductRow.tsx`: quick stock, featured, visibility and archive actions with the existing confirm dialogs
  - `ProductEditor.tsx`: modal shell with sections Details · Pricing & Stock · Tee Options (apparel only) · Images (`ProductImagesPanel`) · Drop · History (`ProductHistory`)
  - `TeeOptionsEditor.tsx`: colorway list (add/edit/remove, hex pickers), sizes chips, default colorway, fabric/fit EN/ES, print position
  - `useProductEditor.ts`: holds `ProductFormState` and calls `validateForm`, `formToCreateArgs`/`formToPatch`, `createVariant`/`updateVariant`. Maps `ConvexError` kinds (`validation`, `stale`, `sku_in_stock`) to field errors or a banner. `stale` offers "Reload latest".
- Modify: `src/app/[locale]/admin/products/page.tsx`. Reduce it to layout plus `ProductList` and `ProductEditor` (target < 150 lines). Remove every `any`.
- Modify: messages (`admin.products.*`). Rename "Colorway" UI copy to "Product" where it means the whole product.
- Remove from the editor the cap-only image URL/upload fields, which `ProductImagesPanel` replaces. Silhouette options come from `SILHOUETTES_BY_CATEGORY[category]`, and category and taxCode are now visible fields.

- [ ] **Step 1:** Implement. Then run `bunx tsc --noEmit`, `bun run lint` and `bun run test`.
- [ ] **Step 2:** Preview walkthrough at `/en/admin/products`:
  - create a cap, check the slug format error, then save
  - create a tee with 2 colorways, upload one catalog image per colorway, and set SKU stock
  - edit a price in two tabs: the second save shows the stale banner
  - archive, toggle "Show archived", restore
  
  The console has no errors. Take a screenshot of the editor.
- [ ] **Step 3:** Commit `refactor(admin): modular product editor`.

### Task 18: Storefront shows the new fields

**Files:**
- Modify: `src/components/product/ProductView.tsx` (or `ProductPurchase.tsx`). Render `descriptionEn/Es` under the title when present.
- Modify: `src/components/seo/ProductJsonLd.tsx`. `description` uses the product description when present.
- Modify: `CapVariant` and `toCapVariant`. Map `descriptionEn/Es`.

- [ ] **Step 1:** Write failing test: `toCapVariant` maps the description and badge fields (`src/lib/toCapVariant.test.ts`).
- [ ] **Step 2–3:** FAIL → implement.
- [ ] **Step 4:** In the preview, add a description in admin. It appears on `/en/products/{slug}` live, and in the JSON-LD after `bun run build`.
- [ ] **Step 5:** Commit `feat(storefront): product description and badges from admin`. Run `npx convex run catalog/migrations:backfillBadges` on dev. Open PR 4. Note in its body that prod needs `backfillBadges --prod` after deploy.

---

## Rollout order (prod)

1. Merge PR 1 → deploy. No data migration needed (all new fields optional).
2. Merge PR 2 → deploy. The settings row is created on first admin save; until then the defaults are identical to today's behaviour.
3. Merge PR 3 → deploy → `bun run migrate:product-images --prod` → verify → Task 14 PR.
4. Merge PR 4 → deploy → `npx convex run catalog/migrations:backfillBadges --prod`.
