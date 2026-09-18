# Inventory Limits, Stock Verification, and Transaction Idempotency

## Context
MoyaCaps sells limited-edition streetwear caps (gorras) with small, finite batch sizes. Previously, the storefront allowed customers to select quantities that exceeded available warehouse stock in the catalog, QuickView modal, and Cart Drawer. Furthermore, during checkout session initialization with Stripe, stock was not checked beforehand, allowing customers to initiate checkout for items that were already depleted. Concurrently, if a customer rapidly clicked the checkout button or experienced network retries, duplicate checkout sessions could be created, and parallel webhook and return redirects could attempt concurrent order updates.

## Decision
1. **Real-Time Available Inventory Bounding**:
   - Every product touchpoint (Product Detail Page, Quick View modal, Cart Drawer, and Catalog Card) clamps maximum selectable quantity to `Math.max(0, variant.stock - inCartQty)`.
   - The increment (`+`) button is disabled when current quantity matches available stock.
   - When a Cap Variant has 0 stock units remaining, it is designated as "Sold Out" / "Agotado", disabling all add-to-cart interactions.
2. **Persistent Cart Auto-Clamping**:
   - The Zustand store (`useStore`) enforces upper-bound stock limits during `addToCart` and `updateQuantity`.
   - If stock diminishes while items are in a customer's persistent cart, opening the cart drawer re-syncs with live Convex database variants and clamps quantities down to the maximum available stock.
3. **Pre-Flight Inventory Validation at Gateway**:
   - In Convex `createCheckoutSession`, the server re-queries live inventory in the `variants` table for every line item.
   - If any variant has `stock <= 0` or if `item.quantity > variant.stock`, checkout creation is rejected with a descriptive localized error, preventing checkout sessions for unfulfillable items.
4. **End-to-End Concurrency & Idempotency Safeguards**:
   - **Client-Side In-Flight Lock**: The checkout button locks into a disabled processing state immediately on click, preventing double-clicks or repeated submissions.
   - **Stripe Session Idempotency**: Stripe checkout session requests pass a deterministic idempotency key (`cs_${userId}_${orderNumber}`), preventing duplicate gateway charges.
   - **Atomic Database Settlement**: Convex order creation and stock decrements are keyed to `stripeSessionId`, ensuring stock is decremented exactly once even if both the Stripe webhook and the success return page fire concurrently.
