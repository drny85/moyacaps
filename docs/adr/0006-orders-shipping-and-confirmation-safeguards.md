# Orders Flow, Shipping Integration, and Action Confirmation Safeguards

## Context
MoyaCaps operates a bilingual hybrid e-commerce engine catering to both domestic and international streetwear collectors via automated Stripe Checkout and WhatsApp Concierge flows. Order processing touches inventory replenishment, third-party carrier dispatching, financial charge refunds, and parcel deliveries. Operational staff previously lacked safeguard dialogs on sensitive actions (e.g. marking shipments delivered without confirmation), while guest checkout customers lacked a method to track orders without logging in with Clerk. Furthermore, cancellations executed from the administration desk did not integrate with Stripe API refunds, risking financial discrepancy.

## Decision
1. **High-Friction Confirmation Safeguards**: Enforce interactive confirmation modals for all state mutations that alter physical or monetary conditions:
   - **Delivery Completion**: Requires explicit confirmation displaying recipient, courier, and tracking code to prevent accidental status advancement.
   - **Order Cancellation with Integrated Stripe Refund**: Administrative cancellations automatically detect Stripe sessions and prompt the operator to issue an instant full refund via the Stripe API alongside atomic inventory restocking in Convex.
   - **Pre-Dispatch Recipient & Address Modification**: Allow administrative staff to correct typos in recipient name, phone, and delivery address prior to courier dispatch with form-level confirmation.
   - **Delivery Status Reversal**: Provide an explicit revert action from `delivered` back to `dispatched` in case of human misclick.
2. **Carrier Dispatch Deep Linking**: Logistics couriers (DHL Express, FedEx International, Estafeta Express, Correos de México, UPS Worldwide) generate live external tracking URIs accessible in the Administrative Orders Desk, Customer Account Vault, and Public Tracking Portal.
3. **Public Guest Tracking Portal**: Implement a dedicated public lookup route (`/:locale/track`) enabling guest buyers to authenticate and view live order fulfillment milestones, secured drop items, and courier tracking using their Order Number and checkout Email address.
4. **State Machine Harmonization**: Standardize canonical order statuses in Convex queries, mutations, and frontend components around `"pending" | "paid" | "dispatched" | "delivered" | "cancelled" | "whatsapp_initiated"`.
