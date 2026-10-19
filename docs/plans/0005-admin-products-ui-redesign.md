# Admin Products UI Redesign — Design Spec

**Status:** Design settled (grilling session, 2026-10-19). Not implemented.
**Depends on:** `docs/plans/0004-admin-catalog-foundation.md` (branch `feat/admin-catalog-foundation`). Do not start implementation until that branch has merged: it is actively changing `src/app/[locale]/admin/products/page.tsx` and `src/components/admin/**`.
**Scope:** The Administrator's product management UI only: `src/app/[locale]/admin/products/**` and `src/components/admin/products/**`. No backend changes except where noted under "Backend gaps".

**Goal:** Make it fast to find and edit a Product, with big images. Today the page is a dense table with 48 px thumbnails, a modal editor and a 1500-line page component.

Domain terms follow `CONTEXT.md`: Product, Cap, Heavyweight Tee, Catalog Shot, Lifestyle Shot, Angle Shot (added in this change), Apparel Colorway, SKU, Available Inventory, Administrator, High-Friction Confirmation Safeguard.

---

## Decisions

| # | Decision | Changes plan 0004? |
|---|----------|--------------------|
| D1 | **Mobile-first, both devices first-class.** Phone layout is designed first. Desktop gets more columns and a two-column editor. | — |
| D2 | **Product list is a card grid**, not a table. Cards show a 4:5 Catalog Shot. 2 columns on phone, 3 at `md`, 4 at `xl` (cards ~240 px wide). One layout, no table toggle. | Yes: `ProductList`/`ProductRow` become `ProductGrid`/`ProductCard`. |
| D3 | **The editor is a full page** at `/[locale]/admin/products/[variantId]`, plus `/[locale]/admin/products/new?category=headwear\|apparel`. It is linkable, survives a refresh and works with the back button. | Yes: Task 17's `ProductEditor` "modal shell" becomes a page body. |
| D4 | **Search is client-side and instant.** One box matches name EN/ES, slug (`variantId`), Colorway / Apparel Colorway names and Graphic Design. Filter chips: Category (Caps / Tees), Status (Live / Hidden / Archived / Drop scheduled), Stock (Out / Low ≤ 5 / In stock), Featured, Needs attention. Search and filters sync to URL query params. | Extends Task 17's filters. |
| D5 | **Quick actions on the card:** visibility toggle, stock (caps: the existing ± `StockConfirmDialog`; tees: the existing `TeeSkuStockDialog`), and featured star. Visibility and stock keep their confirm dialogs (High-Friction Confirmation Safeguard). Price is edited only in the editor. | — |
| D6 | **Editor layout:** on desktop, two columns: images on the left (~60%, the biggest element) and form sections on the right. On phone, one column with images first and a sticky bottom bar (Save / Discard). | Yes: replaces the modal section stack. |
| D7 | **One explicit Save** for the form, with a dirty indicator and an unsaved-changes guard on navigation (in-app links, back, `beforeunload`). One save is one `updateVariant` call, one `expectedUpdatedAt` check and one audit event. **Exceptions that save immediately:** image operations (`attachImage`/`removeImage`/`reorderImages`) and tee SKU stock cells (`setTeeSkuStock`, behind a confirm). | — |
| D8 | **Image manager:** a big 4:5 Catalog Shot slot; a Lifestyle Shot strip with drag-to-reorder (up/down buttons as keyboard fallback); for Caps, a 2×2 Angle Shot grid on a checkerboard with an "Incomplete: hidden from Try-On" warning; for Tees, an Apparel Colorway tab row with one Catalog Shot per colorway and a dot on tabs that lack one. Upload by drop or tap, then a **CropGuide** step: 4:5 overlay plus pass/fail preflight (type, ≤ 10 MB, ≥ 1600 px short side, alpha for Angle Shots). The guide only advises. It never crops or alters the file. | Refines Task 13's `ProductImagesPanel`/`CropGuide`. |
| D9 | **Tee SKU matrix:** in Tee Options, rows are Apparel Colorways and columns are sizes. Each cell is a stock number. Adding a colorway or size adds a row or column at 0 (saved through form Save → `updateVariant`). Removing one that holds stock is blocked: cells are highlighted and named from `ConvexError{kind:"sku_in_stock", cells}`. Cell stock edits save immediately through `setTeeSkuStock` behind a confirm, separate from form Save, because stock is live Available Inventory, not product definition. | Refines Task 17's `TeeOptionsEditor`. |
| D10 | **No bulk actions in v1.** Deferred: about 28 Products, and bulk needs new batch mutations or partial-failure handling. | — |
| D11 | **Keyboard:** `/` focuses search; arrow keys move across the grid; `Enter` opens the editor; `N` starts a new Product; in the editor, `⌘S`/`Ctrl+S` saves and `Esc` returns to the list (through the dirty guard). Shortcuts are ignored while typing in an input, except `⌘S` and `Esc`. | — |
| D12 | **States:** loading shows 4:5 skeleton cards. Empty catalog shows a "Create your first Product" CTA. No results shows "No products match" with Clear filters. A query error shows a retry panel. A mutation error shows an inline banner at the field or section. `stale` shows a banner with **Reload latest**, which keeps the unsaved values visible beside the fresh ones so the Administrator can re-apply them. A missing Catalog Shot shows a placeholder tile with a "Needs Catalog Shot" pill. | — |
| D13 | **Needs attention** (a filter chip and a card pill) means any of: no Catalog Shot (for a Tee, any Apparel Colorway without one); a Cap with incomplete Angle Shots; visible but out of stock (total Available Inventory 0). | New. |
| D14 | **Archived Products** show only under Status → Archived, greyed out with a Restore button. Their editor opens read-only with a "Restore to edit" banner. | — |
| D15 | **Drops on the card:** a scheduled drop shows a "Drop · Oct 24, 6 PM" chip with the subscriber count; a live drop shows a "Live drop" chip. The card ⋯ menu opens the existing `DropScheduleDialog`. The editor's Drop section edits the same fields. | — |
| D16 | **Card anatomy:** a 4:5 Catalog Shot; status pills top-left (Hidden / Featured / Drop / Needs attention); name in the admin's locale; slug in mono; price; total stock (tees sum their SKUs; red at 0, amber at ≤ 5); a bottom row with visibility toggle, stock button and featured star; a ⋯ menu with Edit / Drop schedule / View on store / Archive (Archive behind a confirm, since it is reversible). | — |

Out of scope: bulk actions (D10), price quick-edit, MXN, background removal, server-side search or pagination. Revisit pagination above ~200 Products.

---

## Screens

### 1. Product list: `/[locale]/admin/products`

```
┌ AdminConsoleLayout ───────────────────────────────────────────┐
│ Products (28)                         [+ New cap] [+ New tee] │
│ [🔍 Search name, slug, colorway, design…            /]        │
│ (Caps)(Tees) · (Live)(Hidden)(Archived)(Drop) ·               │
│ (Out)(Low)(In stock) · (★ Featured)(⚠ Needs attention) [Clear]│
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                           │
│ │ 4:5  │ │ 4:5  │ │ 4:5  │ │ 4:5  │   pills top-left          │
│ │ shot │ │ shot │ │ shot │ │ shot │                           │
│ ├──────┤ ├──────┤ ├──────┤ ├──────┤                           │
│ │Name  │ │Name  │ │…     │ │…     │                           │
│ │slug  │ │slug  │                                             │
│ │$45 ·12│ │$60 · 0│                                           │
│ │👁 ± ★ ⋯│ │👁 ± ★ ⋯│                                         │
│ └──────┘ └──────┘                                             │
└───────────────────────────────────────────────────────────────┘
```

On phone, filters collapse into a horizontally scrolling chip row, there are 2 columns, and the "New" buttons merge into one FAB with a Cap/Tee choice.

**Data:**
- `api.catalog.admin.getAllProductsAdmin({ includeArchived })`. `includeArchived` is true only when the Archived status filter is on. Each row is already resolved (`resolveProduct`) with its Catalog Shot URL and `subscribersCount`.
- Mutations: `toggleVariantAvailable`, `toggleVariantFeatured`, `adjustVariantStock` (caps), `setTeeSkuStock` (tees, through `TeeSkuStockDialog`), `archiveVariant`, `restoreVariant`, `api.catalog.drops.updateVariantDropStatus` (through `DropScheduleDialog`).

### 2. Product editor: `/[locale]/admin/products/[variantId]` and `/new`

```
Desktop
┌ ← Products   Gothic Skull Tee   ● Unsaved      [Discard] [Save ⌘S] ┐
│ ┌ Images (60%) ─────────────────┐ ┌ Details ───────────────────┐   │
│ │ [Black][White●][Grey][Cream]  │ │ name EN/ES, slug, category, │   │
│ │ ┌───────────────┐             │ │ silhouette, hex, description,│  │
│ │ │  Catalog Shot  │  4:5 large  │ │ badge EN/ES, tax code       │   │
│ │ │                │             │ ├ Pricing & Stock ────────────┤   │
│ │ └───────────────┘             │ │ price; cap stock (or → SKU) │   │
│ │ Lifestyle ▸ [▢][▢][▢][+]      │ ├ Tee Options (tees) ─────────┤   │
│ │ Angles (caps) [F][L][B][R]    │ │ colorway×size SKU matrix,   │   │
│ └───────────────────────────────┘ │ sizes, default colorway,    │   │
│                                   │ fabric/fit, print position  │   │
│                                   ├ Drop ───────────────────────┤   │
│                                   ├ History (collapsed) ────────┤   │
│                                   └ Danger: Archive ────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
```

On phone: a header with ← and the dirty dot, then Images, then sections as stacked cards, then a sticky bottom bar [Discard] [Save].

`/new` shows the form only. The Images column shows "Save the product first to add images", because `attachImage` needs an existing `variantId`. After the first save, it navigates to `/[variantId]` with images enabled.

**Data:**
- Product: `getAllProductsAdmin` is already cached by the list, so select the row by `variantId` and do not add a new query. If that row is missing after load, show "Product not found" with a back link.
- Images: `api.catalog.images.functions.listProductImages({ variantId })`, plus the upload URL mutation from Task 9/13, then `api.catalog.images.attach.attachImage({ variantId, storageId, role, colorway?, angle?, replaceImageId? })`, then `removeImage({ imageId })` and `reorderImages({ variantId, role, colorway?, orderedIds })`.
- Save: `createVariant` (new) or `updateVariant({ …patch, expectedUpdatedAt })`. Error kinds: `validation`, `stale`, `sku_in_stock`, `image_rule`.
- SKU cells: `setTeeSkuStock({ variantId, colorway, size, stock })`.
- Drop: the form fields go through `updateVariant`; the card dialog uses `updateVariantDropStatus`.
- History: `api.catalog.history.getVariantHistory` through the existing `ProductHistory`.
- Archive / restore: `archiveVariant` / `restoreVariant`.

---

## Component breakdown

Pure modules live in `src/lib/admin/`, are framework-free and tested with `bun test`. Components stay thin: they render view models and call hooks. This follows the repo's engineering standard: modular, testable, pure logic separated from UI.

### Pure view-model helpers (each with `*.test.ts`)

| Module | Exports | Key tests |
|--------|---------|-----------|
| `productSearch.ts` | `searchableText(p): string` (normalized, accent-folded, lower-case); `matchesQuery(p, q): boolean` (all whitespace tokens must match) | "gotico" matches "Gótico" through accent folding. Slug and colorway names match. An empty query matches all. |
| `productFilters.ts` | `type ProductFilters = { q; category?; status?: "live"\|"hidden"\|"archived"\|"drop"; stock?: "out"\|"low"\|"in"; featured?: boolean; attention?: boolean }`; `applyFilters(products, f)`; `filtersFromSearchParams(sp)` / `filtersToSearchParams(f)`; `LOW_STOCK_THRESHOLD = 5` | URL round trip; archived excluded unless `status:"archived"`; low means `1..5`; combined filters AND. |
| `stockLevel.ts` | `totalStock(p)` (tees sum SKUs); `stockLevel(n): "out"\|"low"\|"in"` | Tee sum; 0 gives out, 5 gives low, 6 gives in. |
| `productAttention.ts` | `attentionReasons(p, images?): AttentionReason[]` (`"no_catalog_shot"`, `"colorway_missing_catalog_shot"`, `"angles_incomplete"`, `"visible_out_of_stock"`) | Each reason separately; archived Products report none; a Tee never reports angles. |
| `productCard.ts` | `toProductCard(p, locale): ProductCardVM` with `{ id, name, slug, priceLabel, stock, stockLevel, imageUrl?, pills: Pill[], drop?: { label, subscribers, live }, archived }` | Pill order; drop label formatting in en/es; missing image. |
| `imageSlots.ts` | `buildImageSlots(category, colorways, images): ImageSlotsVM`, the Catalog Shot per colorway (tees) or single (caps), the ordered Lifestyle list and the four Angle Shot slots each marked filled/empty; `moveImage(ids, from, to): ids` for reorder | A Cap without angles gives 4 empty slots and `anglesComplete:false`; tee colorway tabs carry a `missingCatalog` flag; `moveImage` bounds. |
| `cropGuide.ts` | `fitCropBox(width, height, aspect = 4/5): Rect`; `preflightSummary(result): Check[]` (pass/fail rows for type, size, short side, alpha) | Landscape and portrait inputs; an exact 4:5 gives the full box. |
| `skuMatrix.ts` | `buildSkuMatrix(colorways, sizes, skus): Matrix`; `markBlocked(matrix, cells)` from `sku_in_stock` | A missing cell shows 0; blocked cells flagged. Reuses `planSkuChanges` semantics from `convex/catalog/skuPlan.ts` for previews. |
| `editorErrors.ts` | `toEditorError(err): { fieldErrors; banner?: "stale"\|"sku_in_stock"\|"image_rule"\|"unknown"; cells? }` | Each `ConvexError` kind maps correctly; an unknown error gives a generic banner. |
| `keyboardNav.ts` | `nextGridIndex(index, key, columns, count)` | Arrow keys at the edges; last row partial. |

Plan 0004's `productForm.ts` (Task 15) stays as is: `formFromVariant`, `formToPatch`, `validateForm`. The editor's dirty state is `Object.keys(formToPatch(initial, current)).length > 0`.

### Hooks (`src/components/admin/products/`)

- `useProductFilters()`: reads and writes `ProductFilters` through `useSearchParams`/`router.replace` using `productFilters.ts`.
- `useProductEditor(variantId | "new")`: as in Task 17. It holds `ProductFormState`, saves through `createVariant`/`updateVariant`, maps errors with `toEditorError` and exposes `isDirty`, `save`, `discard`, `reloadLatest`.
- `useUnsavedChangesGuard(isDirty)`: covers `beforeunload` and in-app navigation confirm.
- `useImageUpload(variantId)`: preflight (`src/lib/admin/imageUpload.ts` from Task 13), then upload URL, then POST, then `attachImage`. Exposes per-slot status.
- `useAdminShortcuts(map)`: global keys, ignoring inputs except `⌘S`/`Esc`.

### Components (`src/components/admin/products/`)

| Component | Replaces (plan 0004 Task 17) | Notes |
|-----------|------------------------------|-------|
| `ProductGrid.tsx` | `ProductList.tsx` | Search box, `FilterChips`, grid, keyboard nav, states (D12). |
| `FilterChips.tsx` | — | Stateless; props `filters`, `onChange`, counts per chip. |
| `ProductCard.tsx` | `ProductRow.tsx` | Renders `ProductCardVM`; quick actions open the existing dialogs. |
| `ProductCardMenu.tsx` | — | ⋯ menu: Edit, Drop schedule, View on store, Archive/Restore. |
| `ProductEditorPage.tsx` | `ProductEditor.tsx` (modal shell) | Page body: header bar, two-column layout, sticky mobile bar. |
| `DetailsSection.tsx`, `PricingStockSection.tsx`, `DropSection.tsx` | inline in `ProductEditor` | Each takes `form`, `errors`, `onChange`. |
| `TeeOptionsEditor.tsx` | same | Uses `SkuMatrix`. |
| `SkuMatrix.tsx` | — | Renders `skuMatrix.ts` VM; cell edits go through a confirm, then `setTeeSkuStock`. |
| `ProductImagesPanel.tsx` | same (Task 13) | Renders `ImageSlotsVM`; colorway tabs; lifestyle strip; angle grid. |
| `ImageSlot.tsx` | — | Drop/tap target, replace/remove, upload progress. |
| `CropGuide.tsx` | same (Task 13) | Overlay from `fitCropBox`, preflight checklist, Upload/Cancel. |
| `ProductHistory.tsx` | existing | Collapsed by default. |
| `ProductGridSkeleton.tsx`, `EmptyState.tsx` | — | |

Routes:
- `src/app/[locale]/admin/products/page.tsx` renders `<ProductGrid />` only (well under 150 lines).
- `src/app/[locale]/admin/products/[variantId]/page.tsx` and `.../new/page.tsx` render `<ProductEditorPage />`.

Existing dialogs are reused unchanged: `StockConfirmDialog`, `TeeSkuStockDialog`, `AvailabilityConfirmDialog`, `DropScheduleDialog`.

---

## Backend gaps to check at implementation time

1. **Tee SKU stock on the list.** `totalStock` and the SKU matrix need per-SKU stock in `getAllProductsAdmin` rows. If `resolveProduct` does not include SKUs, add them to the admin query; do not query per card.
2. **Needs attention for images.** The list needs per-Product image completeness (angles complete, colorways missing a Catalog Shot) without N `listProductImages` calls. Extend `getAllProductsAdmin` rows with a small `imageSummary: { catalogColorways: string[]; angles: CapAngle[] }`, computed server-side from `productImages`.
3. **Search fields.** Graphic Design and colorway names must be on the admin rows. If not, include them in the resolved row.
4. **`/new` and images.** No backend change: images attach after the first save (see the editor).

Each gap is a small change to `convex/catalog/admin.ts` with a convex-test case. Do them in the first implementation PR.

---

## Implementation order (after plan 0004 merges)

1. Pure helpers and tests: `productSearch`, `productFilters`, `stockLevel`, `productAttention`, `productCard`, `keyboardNav`.
2. Backend gaps 1–3 with tests.
3. `ProductGrid` + `ProductCard` + `FilterChips`, then replace the list page. Verify in preview: search, filters in the URL, quick actions with confirms, phone width.
4. Editor route + `ProductEditorPage` + sections + `useUnsavedChangesGuard`, with the modal removed. Verify: create cap/tee, stale banner across two tabs, `⌘S`, `Esc` guard.
5. `imageSlots`, `cropGuide` and `skuMatrix` helpers + `ProductImagesPanel`/`CropGuide`/`SkuMatrix` refresh. Verify: upload with an angle preflight failure, lifestyle reorder by keyboard, blocked colorway removal.
6. Copy in `messages/{en,es}.json` under `admin.products.*` for every new string (both locales).

Each step is its own commit; steps 1–3 and 4–6 can be two PRs.
