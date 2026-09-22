# ADR 0011: Lean WhatsApp Concierge Submission & Delegated Address / Tax Capture

## Context
In ADR 0010, WhatsApp Concierge orders collected an 8-field domestic US shipping address form (Name, Phone, Email, Street Line 1, Line 2, City, State, ZIP) in the Cart Drawer followed by a 2-step review screen before creating an order lead.

However:
1. **Redundant User Friction**: When the customer opens the official Stripe payment link sent by the Administrator, Stripe Checkout's hosted interface already asks for their phone number and shipping address to ensure carrier-level address normalization.
2. **Sales Tax Resolution**: Stripe Automatic Tax calculates state and jurisdictional sales taxes directly within the hosted Stripe Checkout flow based on the final delivery address entered by the customer. Asking for the address twice created duplicate entry friction on mobile devices.
3. **Conversion Drop-Off**: For a high-end streetwear drop, an 8-field form in an interactive cart drawer slows checkout momentum compared to a frictionless 2-field lead reservation.

## Decision

1. **Lean Loot Bag Concierge Submission**:
   - The WhatsApp Concierge checkout form in `CartDrawer.tsx` is collapsed into a single, high-conversion screen requiring only **Full Name** and **Email Address**.
   - Physical address fields (Street, City, State, ZIP) and Phone Number are removed from the initial drawer submission.
   - The customer's email is strictly validated and used as the primary identity anchor for:
     - Immediate redirect to `/track?order=GL-WA-XXXXXX&email=...` (the Public Tracking Portal).
     - Pre-filling the customer profile in Stripe Checkout.
     - Anti-hoarding safeguards in Convex.

2. **Delegated Address & Sales Tax Capture via Stripe**:
   - The Stripe Checkout session maintains `shipping_address_collection: { allowed_countries: ["US"] }`, `phone_number_collection: { enabled: true }`, and `automatic_tax: { enabled: true }`.
   - When the customer opens the payment link, Stripe prompts for their shipping address and computes sales tax dynamically.
   - Upon payment completion, the Stripe webhook (`checkout.session.completed`) automatically extracts `session.shipping_details.address` and `session.customer_details.phone` and updates the Convex order record.

3. **Administrator Manual Address Entry for Zelle Settlements**:
   - If a customer chooses to settle via Zelle / direct bank transfer (where Stripe is never visited), the Administrator can click **`[ Edit / Add Address ]`** in `/admin/orders/[orderNumber]` to manually record the delivery address received in the WhatsApp chat.

4. **Inventory Anti-Hoarding**:
   - `convex/orders.ts` enforces the 3-lead active reservation limit based on `customerEmail` (max 3 unpaid `whatsapp_initiated` reservations per email address).

## Consequences
- **Positive**: Customer checkout time is cut by over 70%, eliminating unnecessary mobile keystrokes while maintaining full inventory reservation, email receipt delivery, and tracking lookup.
- **Positive**: Stripe remains the single source of truth for US sales tax calculation and address verification.
- **Trade-off**: Fresh WhatsApp order leads do not display a physical shipping address in the Admin Panel until the customer pays on Stripe or the Admin manually inputs it during Zelle confirmation.
