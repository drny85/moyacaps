# Admin Products UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the admin product table and modal editor with a searchable 4:5 card grid and a full-page, linkable product editor.

**Architecture:** Every decision the UI makes (search, filters, stock level, attention reasons, card view model, image slots, SKU matrix, crop box, keyboard grid moves, navigation guard) lives in a pure module under `src/lib/admin/` with a colocated Vitest test. Components under `src/components/admin/products/` render those view models and call the existing Convex mutations. One backend change: `getAllProductsAdmin` rows carry their SKUs.

**Tech Stack:** Next.js 16 App Router, React 19, Convex (`convex-test`), next-intl, Tailwind, Vitest.

**Spec:** `docs/plans/0005-admin-products-ui-redesign.md` (decisions D1–D16 are settled).

## Global Constraints

- Scope: `src/app/[locale]/admin/products/**`, `src/components/admin/products/**`, `src/lib/admin/**`, `src/messages/{en,es}.json`; backend only `convex/catalog/admin.ts` + `convex/catalog/validators.ts` for gap 1.
- Pure modules in `src/lib/admin/` use relative imports (Vitest has no `@`/`@convex` alias).
- All copy under `admin.products.*` in both `en.json` and `es.json`. Domain terms: Product, Catalog Shot, Lifestyle Shot, Angle Shot, Apparel Colorway, SKU.
- `LOW_STOCK_THRESHOLD = 5`: low stock means `1..5`.
- Keep the editor protections: `expectedUpdatedAt` on every save; stale banner with **Reload latest**; the session adopts only versions returned by its own saves (`updateVariant` and the drop dialog); no lost edits on Esc/navigation; archived Products read-only; Save disabled while a just-created Product's row is pending; `needs_image` only satisfied by a Catalog Shot with no colorway or on the default colorway (server rule, surfaced as a banner).
- Reused unchanged: `StockConfirmDialog`, `AvailabilityConfirmDialog`, `TeeSkuStockDialog`, `DropScheduleDialog`.
- Gates before every commit: `bun run test`, `bunx tsc --noEmit`, `bunx tsc --noEmit -p convex`. Baseline: 72 files, 752 tests.
- No migrations, no `convex run`, no push.

## Backend gaps: findings

1. **SKUs on admin rows:** missing. Task 1 adds `skus: {colorway,size,stock}[]` to each `getAllProductsAdmin` row (one bounded `listSkus` per row).
2. **Image summary:** not needed. `resolveProduct` already overlays `productImages` rows: `catalogShot` (no-colorway Catalog Shot), `colorways[].catalogShot` per Apparel Colorway, and `angles` only when all four Angle Shots exist. Attention is derived from those fields; no new field.
3. **Search fields:** present. A tee's Graphic Design is its Product name; colorway names are on `colorways[]`.
4. **`/new` and images:** no change (images after first save).

## Review Focus

1. A tee whose stored `colorways[i].catalogShot` is `""` (newly created) must count as missing, and whitespace-only too. → Task 2 `productAttention` test.
2. URL params with junk values (`?status=foo&stock=bar`) must fall back to "no filter", not crash. → Task 2 `productFilters` test.
3. Archived rows must never appear unless Status → Archived, and then only archived rows. → Task 2 test.
4. A search query with accents or mixed case in either direction ("GÓTICO", "gotico") matches. → Task 2 test.
5. Save after Reload latest must send the fresh version, and an own save must not leave the form dirty. → Task 4 `editorSession` test.

---

### Task 1: SKUs on admin rows

**Files:**
- Modify: `convex/catalog/validators.ts` (add `adminProductRow`)
- Modify: `convex/catalog/admin.ts` (`getAllProductsAdmin`)
- Test: `convex/catalog/admin.test.ts`

**Interfaces:**
- Produces: `ResolvedVariant` (from `productForm.ts`, derived from the query return) gains `skus: { colorway: string; size: string; stock: number }[]` (empty for Caps).

- [ ] Test `getAllProductsAdmin lists each tee's SKUs`: create a tee with colorways `black`,`white` and sizes `M`,`L`; `setTeeSkuStock(black/M = 3)`; expect the row's `skus` to contain `{colorway:"black",size:"M",stock:3}` and length 4; the cap row's `skus` is `[]`.
- [ ] Run, expect FAIL (`skus` undefined).
- [ ] `adminProductRow = variantWithSubscribers.extend({ skus: v.array(v.object({colorway, size, stock})) })`; map `listSkus` rows to the three fields in the handler.
- [ ] Gates, commit `feat(admin): include SKUs on admin product rows`.

### Task 2: List view-model helpers

**Files (each with `*.test.ts`):**
- Create: `src/lib/admin/productSearch.ts`, `stockLevel.ts`, `productAttention.ts`, `productCard.ts`, `keyboardNav.ts`
- Rewrite: `src/lib/admin/productFilters.ts` (+ test) to the spec's shape; the old silhouette/availability filters go.

**Interfaces (Produces):**
- `type AdminProduct = ResolvedVariant` (rows from Task 1).
- `foldText(s: string): string` (NFD, strip combining marks, lower-case); `searchableText(p): string` (nameEn, nameEs, variantId, colorway nameEn/nameEs/id); `matchesQuery(p, q): boolean` (every whitespace token is a substring).
- `LOW_STOCK_THRESHOLD = 5`; `totalStock(p): number` (sum of `skus` when non-empty, else `p.stock`); `stockLevel(n): "out" | "low" | "in"`.
- `type AttentionReason = "no_catalog_shot" | "colorway_missing_catalog_shot" | "angles_incomplete" | "visible_out_of_stock"`; `attentionReasons(p): AttentionReason[]` in that order. Archived → `[]`. Tee: no colorway with a non-blank Catalog Shot → `no_catalog_shot`; else some blank → `colorway_missing_catalog_shot`. Cap: blank `catalogShot` → `no_catalog_shot`; `angles` undefined → `angles_incomplete`. `isAvailable && totalStock === 0` → `visible_out_of_stock`.
- `type StatusFilter = "live" | "hidden" | "archived" | "drop"`; `type StockFilter = "out" | "low" | "in"`; `type ProductFilters = { q: string; category?: Category; status?: StatusFilter; stock?: StockFilter; featured?: boolean; attention?: boolean }`; `EMPTY_FILTERS`; `applyFilters(products, f, now)`; `filtersFromSearchParams(sp: URLSearchParams): ProductFilters`; `filtersToSearchParams(f): URLSearchParams` (keys `q`, `category`, `status`, `stock`, `featured=1`, `attention=1`; empty values omitted); `hasActiveFilters(f)`; `chipCount(products, f, patch: Partial<ProductFilters>, now)` = `applyFilters(products, {...f, ...patch}, now).length`.
  - status `live` = available and not archived; `hidden` = not available, not archived; `drop` = `computedDropStatus` is `scheduled` or `live`; `archived` = archived only. Without `status:"archived"` archived rows are excluded.
- `type Pill = "hidden" | "featured" | "drop" | "attention"`; `toProductCard(p, locale, now): ProductCardVM` = `{ id, name, slug, priceLabel, stock, stockLevel, imageUrl?, pills, drop?: { date: string; subscribers: number; live: boolean }, attention: AttentionReason[], archived, isTee }`. `imageUrl` = non-blank `catalogShot`, else default colorway's Catalog Shot, else non-blank `image`. `drop.date` via `Intl.DateTimeFormat(locale, { month: "short", day: "numeric", hour: "numeric", minute?: only when non-zero })`. `priceLabel` = `$45` (no decimals when whole).
- `nextGridIndex(index, key: "ArrowLeft"|"ArrowRight"|"ArrowUp"|"ArrowDown"|"Home"|"End", columns, count): number` clamped; ArrowDown from the row above a partial last row lands on the last item.

- [ ] Write tests with the spec's cases: "gotico" matches "Gótico" and "GÓTICO" matches "gotico"; slug and colorway names match; empty query matches all. URL round trip; junk params ignored; archived excluded unless `status:"archived"`; low is `1..5`; combined filters AND. Tee sum; `0→out`, `5→low`, `6→in`. Each attention reason alone; archived reports none; a tee never reports angles; blank and whitespace Catalog Shot are missing. Pill order `hidden, featured, drop, attention`; en drop date `"Oct 24, 6 PM"`; missing image gives `imageUrl` undefined. Arrow keys at the edges; last row partial.
- [ ] Run, expect FAIL.
- [ ] Implement.
- [ ] Run, expect PASS. Gates, commit `feat(admin): product list view models`.

### Task 3: Product grid page

**Files:**
- Create: `src/components/admin/products/ProductGrid.tsx`, `FilterChips.tsx`, `ProductCard.tsx`, `ProductCardMenu.tsx`, `ProductGridSkeleton.tsx`, `EmptyState.tsx`, `useProductFilters.ts`, `useAdminShortcuts.ts`
- Create: `src/lib/admin/shortcuts.ts` (+ test): `isTypingTarget(el: {tagName?: string; isContentEditable?: boolean} | null): boolean`; `shortcutKey(e: {key; metaKey; ctrlKey; altKey}): string` → `"mod+s"`, `"escape"`, `"/"`, `"n"`, the arrow names, or `""`; `shouldHandle(key, typing): boolean` (typing allows only `mod+s` and `escape`).
- Rewrite: `src/app/[locale]/admin/products/page.tsx` → renders `<ProductGrid />` only.
- Delete: `ProductList.tsx`, `ProductRow.tsx`, `ProductMetrics.tsx`.
- Modify: `useProductActions.ts` handlers take a row; `ProductActionDialogs.tsx` unchanged in behaviour.

**Interfaces:**
- `useProductFilters(): { filters; setFilters(patch: Partial<ProductFilters>); clear() }` via `useSearchParams` + `router.replace(pathname + "?" + params, { scroll: false })`.
- `useAdminShortcuts(map: Partial<Record<string, (e: KeyboardEvent) => void>>)`.
- `ProductGrid` queries `getAllProductsAdmin({ includeArchived: filters.status === "archived" })`; states per D12 (skeleton, empty catalog CTA, no results + Clear, error panel via error boundary-free `try`: Convex `useQuery` throws, so wrap the grid in a small `QueryErrorBoundary` with Retry that remounts).
- Shortcuts: `/` focuses search; `n` → `/admin/products/new?category=headwear`; arrows move focus among cards (`nextGridIndex`, columns from `getComputedStyle(grid).gridTemplateColumns.split(" ").length`); Enter on a card opens it (cards are links).
- Card: link to `/admin/products/[variantId]`; quick row: visibility (AvailabilityConfirmDialog), stock (Cap: `−1/+1` via StockConfirmDialog; Tee: opens TeeSkuStockDialog), featured star; ⋯ menu Edit / Drop schedule / View on store / Archive (confirm) or Restore for archived. Archived card greyed with Restore.
- Phone: chip row scrolls horizontally; one FAB with Cap/Tee choice; desktop shows two buttons.

- [ ] `shortcuts.test.ts`: `mod+s` from metaKey and ctrlKey; typing blocks `/`, `n`, arrows but not `mod+s`/`escape`; INPUT/TEXTAREA/SELECT/contentEditable count as typing. Run FAIL → implement → PASS.
- [ ] Build components and page; delete replaced files; fix `drops/page.tsx` compile if types moved.
- [ ] Gates, commit `feat(admin): product card grid with search, filters and quick actions`.

### Task 4: Full-page editor

**Files:**
- Modify: `src/lib/admin/editorSession.ts` (+ test)
- Create: `src/lib/admin/navigationGuard.ts` (+ test)
- Modify: `useProductEditor.ts`; Create: `useUnsavedChangesGuard.ts`, `ProductEditorPage.tsx`, `DetailsSection.tsx` (from `ProductDetailsFields`), `PricingStockSection.tsx` (from `ProductPricingFields`), `DropSection.tsx` (from `ProductDropSection`), `StaleValuesPanel.tsx`
- Create: `src/app/[locale]/admin/products/[variantId]/page.tsx`, `src/app/[locale]/admin/products/new/page.tsx`
- Delete: `ProductEditor.tsx`, `ProductDetailsFields.tsx`, `ProductPricingFields.tsx`, `ProductDropSection.tsx`

**Interfaces:**
- Reducer changes: `{ type: "openCreate"; category: Category }`; new `{ type: "saved"; updatedAt: number }` (edit session with known version → `version = updatedAt`, `initial = form`); `reload` keeps the discarded form in `state.unsaved` when it was dirty; `EditorState` gains `unsaved: ProductFormState | null`; `edit` with an archived flag is not the reducer's concern (UI disables). New pure `unsavedFields(fresh, mine): (keyof ProductFormState)[]` (fields whose values differ; colorways/sizes/defaultColorway compared as a group under `"colorways"`/`"sizes"`), `reapplyField(form, unsaved, field): ProductFormState`. Remove `closeDecision` (modal only); add `leaveDecision(state, saving): "leave" | "confirm"` (dirty and savable → confirm).
- `shouldGuardClick(a: { href: string; target?: string; download?: boolean }, mods: { meta; ctrl; shift; alt; button: number }, currentUrl: string): boolean` — true only for same-origin, left-click, no modifier, no `_blank`, no download, different path+search.
- `useProductEditor(target: { mode: "new"; category: Category } | { mode: "edit"; variantId: string }, rows)` returns the old surface minus `openCreate/openEdit/close/requestClose`, plus `isDirty`, `isArchived`, `notFound`, `discard()`, `unsaved`, `reapply(field)`, `createdId`. Edit save: `updateVariant` → dispatch `saved` with returned `updatedAt`. Create save: `createVariant` → `created`; when `rowUpdated` seeds the row, the page `router.replace`s to `/admin/products/[id]`.
- `useUnsavedChangesGuard(isDirty, message)`: `beforeunload`; capture-phase document click using `shouldGuardClick` + `window.confirm`; popstate sentinel (push a duplicate entry while dirty; on popstate confirm, re-push on cancel).
- `ProductEditorPage({ target })`: queries `getAllProductsAdmin({ includeArchived: true })`; header (← Products, name, ● Unsaved, Discard, Save ⌘S); desktop `lg:grid-cols-[3fr_2fr]` images left, sections right; phone stacked with sticky bottom bar; archived → `<fieldset disabled>` + "Restore to edit" banner with Restore; not found → message + back link; `/new` images column shows "Save the product first to add images". Shortcuts: `mod+s` save, `escape` → list through the guard.

- [ ] Reducer tests: `openCreate` with `apparel` seeds an apparel form; `saved` adopts `updatedAt` and clears dirty; `saved` ignored while version null; `reload` of a dirty form stores `unsaved` and lists the changed fields; `reapplyField` copies one field; save after reload uses the row's version (Review Focus 5); `leaveDecision`.
- [ ] `navigationGuard.test.ts`: same path+search → false; other path → true; `_blank`, meta/ctrl click, middle button, other origin, download → false.
- [ ] Run FAIL → implement → PASS.
- [ ] Build hook, guard, page, sections, routes; delete replaced files.
- [ ] Gates, commit `feat(admin): full-page product editor with unsaved-changes guard`.

### Task 5: Images, crop guide and SKU matrix

**Files:**
- Create: `src/lib/admin/imageSlots.ts`, `src/lib/admin/skuMatrix.ts` (+ tests)
- Modify: `src/lib/admin/cropFrame.ts` (+ test): add `fitCropBox(width, height, aspect = 4/5): { x; y; width; height }` (centred cover box in natural pixels; `cropFrame` stays for percentages)
- Modify: `src/lib/admin/imageUpload.ts` (+ test): `type PreflightCheck = { id: "type" | "size" | "shortSide" | "alpha"; pass: boolean }`; `preflightSummary(input: { role; bytes; header }): PreflightCheck[]` — `type`, `size` always; `alpha` for angle, `shortSide` otherwise; a missing header fails `type` and the dependent rows.
- Modify: `ProductImagesPanel.tsx`, `CropGuide.tsx`, `TeeOptionsEditor.tsx`; Create: `ImageSlot.tsx`, `SkuMatrix.tsx`, `useImageUpload.ts`

**Interfaces:**
- `buildImageSlots<T extends { _id: string; role; colorway?; angle?; order }>(category, colorwayIds: string[], images: T[]): { groups: { colorway?: string; catalog?: T; lifestyle: T[]; missingCatalog: boolean }[]; angles: { angle: CapAngle; image?: T }[]; anglesComplete: boolean }` (one group per colorway for tees, one without colorway for caps; `angles` empty for tees; lifestyle sorted by `order`).
- `moveImage<T>(ids: T[], from, to): T[]` (out-of-range returns a copy unchanged).
- `buildSkuMatrix(colorways: {id; name}[], sizes: string[], skus): { sizes; rows: { colorway; name; cells: { size; stock; saved: boolean; blocked: boolean }[] }[]; total }` (missing cell → stock 0, `saved:false`); `markBlocked(matrix, cells: {colorway; size}[])`.
- `useImageUpload(variantId, slot)`: preflight (`preflightSummary` + header), then upload URL, POST, `attachImage`; status `idle | review | uploading | error`.
- Panel per D8: big 4:5 Catalog Shot; Lifestyle strip with HTML5 drag-to-reorder plus up/down buttons; Cap 2×2 Angle grid on a checkerboard with "Incomplete: hidden from Try-On" warning; Tee colorway tab row with a dot on tabs missing a Catalog Shot. Drop-or-tap upload → CropGuide with overlay + checklist; Upload disabled when any check fails.
- `SkuMatrix` in Tee Options: rows = Apparel Colorways, columns = sizes; saved cells are number inputs; a changed cell confirms through `StockConfirmDialog` then `setTeeSkuStock`; unsaved cells show 0 with a "Save to add" hint; cells from a `sku_in_stock` banner are highlighted.

- [ ] Tests: Cap without angles → 4 empty slots, `anglesComplete:false`; tee groups carry `missingCatalog`; `moveImage` bounds; `fitCropBox` landscape/portrait/exact 4:5 full box; `preflightSummary` rows per role; SKU missing cell 0; blocked cells flagged.
- [ ] Run FAIL → implement → PASS.
- [ ] Build components.
- [ ] Gates, commit `feat(admin): image manager, crop guide checklist and SKU matrix`.

### Task 6: Copy and final gates

- [ ] Every new key under `admin.products.*` in `en.json` and `es.json`; remove keys only used by deleted components (`columns`, `row`, `metrics`, old filter labels) after a grep confirms no other user.
- [ ] Gates; commit `feat(admin): redesign copy (en/es)`. (Copy may land with each task instead; this task is the final sweep.)
