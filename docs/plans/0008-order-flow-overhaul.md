# 0008 — Order flow overhaul

Decisions from the 2026-10-19 order-flow review, cart through delivery. Rationale lives in ADR 0023 (remove WhatsApp ordering) and ADR 0024 (Checkout Hold, split status); terms in `CONTEXT.md`.

**Status: shipped 2026-10-20.** Every PR below is merged and deployed to Convex prod, with prod backfills run.

| Step | PR | Prod data step |
| --- | --- | --- |
| 1. Remove WhatsApp ordering | #8 | `cancelOpenWhatsAppReservations`: 0 open |
| 2. Checkout Hold | #9, #14 (back-link fix) | none |
| 3. Split status | #13 | `backfillOrderStatusAxes`: 1 order |
| 4. Tax and territory | #12 | `backfillTaxCodes`: 16 patched, 0 to review |
| 5. Fulfillment and money back | #15, #16 (`refund.failed` / `refund.updated`) | none |
| 6. Cart and copy | #11 | none |
| Cleanup | #10 (legacy shims), #17 + #18 (drop legacy `orders.status`) | `unsetLegacyOrderStatus`: 1 order |

Follow-ups not yet built: recompute Payment Status after a refund fails at Stripe, and an admin alert email for a failed refund.

## Decisions

**Checkout and stock**
- Every purchase is card checkout (Stripe). WhatsApp is a support link only; Zelle is gone.
- Clicking Pay creates a `pending` Order and a Checkout Hold on its units. The Checkout Session lasts 30 minutes.
- A hold is released only after Stripe reports `checkout.session.expired`. An hourly backstop expires the session of any Order still awaiting payment after 45 minutes, then releases.
- The cart remembers its open Order: a new Pay click, or returning through Stripe's back link, expires the previous session immediately.
- The cart clamps each tee line to its SKU's stock, not the variant total.

**Tax**
- Stripe Tax is the only tax authority; prices are tax-exclusive. Convex records Stripe's figures.
- Tax code comes from category (Caps `txcd_30060006`, Tees `txcd_30011000`). No name-keyword fallback; checkout refuses a product with no code.

**Territory and shipping**
- Fulfillment Territory: 50 states + DC. Excludes territories, AA/AE/AP military, international.
- The payment webhook flags out-of-territory paid Orders for refund.
- Checkout offers one option: "Standard shipping, 2–5 business days", free at or above the unit threshold, flat fee otherwise. No "Express" wording.

**Status**
- Payment Status: awaiting payment, paid, partially refunded, refunded, disputed.
- Fulfillment Status: unfulfilled, label purchased, in transit, delivered, delivery exception, returned. Plus a cancelled marker.
- Delivered comes from the carrier scan. A manual change needs a High-Friction Confirmation Safeguard and locks out carrier overwrites.

**Fulfillment**
- A label requires a paid (or partially refunded), not cancelled, not disputed, unfulfilled Order. Buying a label never moves stock.
- No placeholder `GL-TRK-` numbers; a Tracking Number exists only from a carrier label.
- Delivery Exception / returned to sender: email the Administrator and Customer; the Administrator reships (new label, label history kept) or refunds.

**Money back**
- Refunds by line and quantity (line price + its tax share), optional shipping, via the Stripe API. Free-amount Goodwill Refunds never restock.
- Restock is a per-line Administrator choice behind a safeguard.
- Customer Cancellation: a signed-in owner may cancel a paid, unfulfilled Order for a full automatic refund. Guests go through support.
- Returns: 30 days from the delivered date (fallback: label date + 7 days), unworn with tags, for a refund. The Customer pays return shipping unless the item is defective or wrong. Original shipping is not refunded. An exchange is a Return plus a new Order.

**Accounts**
- Guest checkout stays. Guest Orders attach to an account later created with the same verified email.

## PR sequence

1. **Remove WhatsApp ordering.** Delete the lead, payment-link, Zelle and reservation-cron paths and their admin UI. The migration cancels open `whatsapp_initiated` orders and releases their stock; paid WhatsApp orders stay as history. Check the admin desk for live chats before deploying.
2. **Checkout Hold.** `pending` Order at Pay, 30-minute session, expire handling, backstop cron, cart remembers its open Order.
3. **Split status.** Payment Status + Fulfillment Status, migration from `status`, admin desk, tracking views, emails.
4. **Tax and territory.** Category-derived tax codes, delete the keyword fallback, territory check in the webhook.
5. **Fulfillment and money back.** Label gating, no fake tracking numbers, line refunds, Restock, Reship, Returns, Customer Cancellation, dispute block.
6. **Cart and copy.** SKU clamp in the cart; shipping, returns and invoice-footer wording in EN/ES.

Each PR ships pure-module tests.

## Open items for the store owner

- Confirm Stripe Tax registrations (at least NY) and the tax origin address in the Stripe dashboard.
- Ship-from address lives in the Convex deployment's `SHIP_FROM_*` env vars (`convex/shipping/shipFrom.ts`), never in the repo. Match it as the tax origin in Stripe Tax.
