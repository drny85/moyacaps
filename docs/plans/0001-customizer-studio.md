# Plan 0001: Undervisor & Side-Patch Customizer Studio ("Moya Studio")

**Status:** Ready for Future Implementation  
**Target Branch:** `feat/customizer-studio`  
**Created:** 2026-09-19  

---

## 1. Overview & Business Value

Implement a flagship, collector-grade **Customizer Studio** (`/[locale]/studio`) for MoyaCaps. In streetwear cap culture (New Era, Hat Club, Just Don), contrasting *undervisor tints* (Kelly Green UV, Bubblegum Pink UV, Grey UV) and *commemorative embroidered side patches / enamel pins* are high-status collector attributes.

This feature transforms MoyaCaps from a standard catalog into an interactive digital atelier, expanding Average Order Value (AOV) via modular add-ons and driving organic social sharing through customized build permalinks.

---

## 2. Architecture & Design Decisions

### 2.1 Inventory & Pricing Model
- **Base Caps:** Real-time inventory deduction from existing Convex `variants` table via atomic mutations.
- **Modular Add-ons:** 
  - Contrast Undervisors: Included in base or selectable tint options.
  - Commemorative Side Patches: Modular add-on pricing (+$15 – $18 USD).
  - Collectible Enamel Pins: Modular add-on pricing (+$10 – $12 USD).
- **Cart & Order Items:** Atomically bundled in line items with full customization metadata.

### 2.2 Viral Social Sharing
- Studio configurations synchronize bidirectionally with URL search parameters:
  `/[locale]/studio?cap={variantId}&uv={undervisorId}&patch={patchId}&pin={pinId}`
- A one-click "Share Build" button copies the permalink with visual toast confirmation.

---

## 3. Implementation Breakdown

### 3.1 Data & Store Layer (`src/data/caps.ts`, `src/store/useStore.ts`)
- **Customization Types & Options:**
  - `UNDERVISOR_OPTIONS`: Kelly Green (`#16a34a`), Bubblegum Pink (`#f472b6`), Heather Grey (`#9ca3af`), Ice Cyan (`#22d3ee`), Gold Dust (`#eab308`), Infrared Red (`#ef4444`), Stealth Black (`#18181b`).
  - `SIDE_PATCH_OPTIONS`: CDMX 0880 Heritage (+$15), Lucky Clover Gold 0880 (+$15), El Ángel Gold Crest (+$18), Moya Streetwear Anniversary (+$15).
  - `ENAMEL_PIN_OPTIONS`: Solid Brass Clover Pin (+$10), Silver Devil Mask Pin (+$10), Moya Red Flame Pin (+$12).
- **Cart State Update:**
  - Extend `CartItem` to support optional `customization?: CapCustomization` and `variantId?: string`.
  - Composite unique IDs for customized variants (e.g. `{variantId}-custom-{hash}`).
  - Update `clampCartToStock` to match against `item.variantId || item.id`.

### 3.2 Convex Backend & Checkout (`convex/schema.ts`, `convex/orders.ts`, `convex/stripe.ts`)
- **Schema:**
  - Support `customization` sub-fields on `orders.items`: `undervisorHex`, `undervisorName`, `patchId`, `patchName`, `pinId`, `pinName`, `customizationPrice`.
- **Orders Mutation:**
  - Decrement stock atomically from the base cap's `variantId`.
- **Stripe Checkout Action:**
  - Compute composite line item prices in Stripe sessions.
  - Pass custom build descriptor in line item title: `Moya Caps 0880 — Black / Red [UV: Kelly Green | Patch: CDMX 0880]`.
  - Preserve customization attributes in Stripe webhook order settlement.

### 3.3 Interactive Studio Components (`src/components/studio/`)
- `CapStudioVisualizer.tsx`:
  - Multi-perspective 3D/canvas renderer:
    - **3/4 Front Perspective**: Crown profile, front 3D puff embroidery, lighting highlights.
    - **Undervisor Flip (UV View)**: Flipped view showing the visor underbill with live UV color swatch and stitch texture.
    - **Side Patch Perspective**: Left/right crown panel showcasing the embroidered commemorative patch with metallic thread shimmer.
    - **Crown Pin Attachment**: Enamel pin overlaid on the cap eyelet/visor seam.
  - Camera angle switcher tabs and lighting controls.
- `CapStudioWorkbench.tsx`:
  - Base cap picker dropdown/carousel with live stock status from Convex.
  - Tabbed customization steps: Undervisor tint -> Side Patch -> Enamel Pin.
  - Real-time price breakdown (Base + Patch + Pin).
  - Share build permalink generator.
  - Add to Cart button with celebratory confetti and cart drawer auto-open.

### 3.4 Storefront Integration
- **Studio Route:** Dedicated page at `src/app/[locale]/studio/page.tsx`.
- **Navigation:** Add "Studio" link to `Navbar.tsx` with a glowing 3D/NEW pill badge.
- **Product Detail Page (`ProductDetailView.tsx`):** Add "Customize in Studio" CTA button linking to `/studio?cap={cap.id}`.
- **Catalog Cards (`CapCard.tsx`):** Add studio customizer icon shortcut.
- **Cart Drawer (`CartDrawer.tsx`):** Display UV swatch dot, side patch label, and enamel pin badge on customized items; format WhatsApp concierge orders with full custom breakdown.
- **Translations:** Comprehensive EN/ES coverage in `src/messages/en.json` and `src/messages/es.json`.

---

## 4. Verification & Testing Checklist
- [ ] Run `bun x tsc --noEmit` and `bun run build` to verify clean compilation.
- [ ] Verify URL query params round-trip: reloading `/studio?cap=negro-rojo&uv=kelly-green&patch=cdmx-0880` accurately pre-populates all controls.
- [ ] Verify stock limits: out-of-stock base variants disable the Studio "Add to Cart" button with clear messaging.
- [ ] Verify Cart and WhatsApp concierge formatting: verify custom options are displayed and calculated correctly.
- [ ] Verify mobile layout: visualizer and controls stack cleanly on small viewports with no overflow.
