# Apparel Collection and Model Lookbook Studio

## Context
Good Luck expanded from a cap-only brand into a full streetwear architecture featuring heavyweight 280-300 GSM combed cotton graphic tees ($160 USD) alongside signature 0880 headwear ($120-$125 USD). Customers needed to inspect real streetwear model photos wearing the garments, switch between 11 graphic designs, test across 4 core fabric colorways, select streetwear sizes (`S`, `M`, `L`, `XL`, `2XL`), and purchase or inquire via WhatsApp without losing their chosen colorway or sizing.

## Decision
1. **Model Lookbook Studio (`src/components/studio/ModelLookbookStudio.tsx`)**:
   - Integrated interactive showcase featuring authentic streetwear lookbook photos on live models (`public/shirts/*.jpg`).
   - Graphic Design switcher spanning all 11 heavyweight designs with front/back print location badges and GSM indicators.
   - 4 canonical luxury apparel colorways (`washed-black`, `crisp-white`, `heather-grey`, `butter-cream`) dynamically updating the model photo in-place.
   - Dual view toggle ("On Model" vs "Graphic Artwork") allowing close inspection of high-density screen prints (`public/shirts/graphics/*.jpg`).
   - Fullscreen lightbox view with zoom inspection.
2. **Global & Homepage Integration**:
   - Featured directly on the homepage (`/#apparel-studio`) between `CapGrid` and `BrandStory`.
   - Global modal launcher (`ModelLookbookStudioModal`) mounted in `src/app/[locale]/layout.tsx`, triggered from Navbar, QuickView, and Catalog Cards.
   - Desktop and mobile navigation updated to direct shoppers immediately to the studio.
3. **Product QuickView & Detail Page Swatches**:
   - Enhanced `ProductQuickView.tsx` and `ProductDetailView.tsx` with colorway swatch buttons that update the active model image interactively.
   - Direct link to launch the Model Lookbook Studio from any tee PDP or QuickView modal.
4. **Cart, Stripe Checkout & WhatsApp Serialization**:
   - `CartItem` in `useStore.ts` tracks `variantId` alongside unique line item IDs (`${cap.id}-${colorway}-${size}`) so different colorways and sizes don't overwrite each other.
   - `convex/stripe.ts` (`createCheckoutSession` and `createWhatsAppCheckoutSession`) accept optional `size` and `colorway`, rendering the exact size and colorway on Stripe line items and WhatsApp reservations.
   - `CartDrawer` renders custom colorway badges and itemized specs.

- Authentic street photography anchors customer trust in the $160 price point.
- Colorway and sizing choices are preserved end-to-end through Stripe and WhatsApp Concierge pipelines.
- Complete 44-image matrix (11 designs × 4 colorways) ensures that selecting any graphic on any colorway strictly renders that exact graphic on that garment color, eliminating any mismatch or placeholder drift.
