---
status: accepted
supersedes: ADR 0010, ADR 0011
---

# Remove WhatsApp Concierge Orders and Zelle settlement

Every purchase goes through card checkout (Stripe). The WhatsApp Concierge Order (ADR 0010, 0011) is removed: no more `whatsapp_initiated` orders, 24-hour holds, Administrator-sent payment links or manually confirmed Zelle settlements. WhatsApp stays only as a support chat link and as a channel for drop/launch waitlist sign-ups.

## Why

- About half the order-lifecycle complexity existed only for this path: a separate status, a 24-hour stock hold and its extension, payment-link refresh history, the double-settlement guard (Zelle paid, then Stripe paid too), the nightly reservation reconciliation cron, and a per-email limit on unpaid reservations.
- Zelle orders collected no sales tax, a compliance gap wherever the store is registered.
- Zelle has no chargeback trail and is reconciled by a person reading a bank receipt.
- Stripe Checkout already collected the address, phone and tax for WhatsApp orders, so the Administrator in the middle added a step, not information.
- A short stock hold on card checkout covers the "save my unit during a drop" need without locking limited stock for 24 hours.

## Considered options

- **Keep it, fix Zelle tax with the Stripe Tax Calculation API**: keeps every race and state above.
- **Administrator chats on WhatsApp and sends an ordinary checkout link**: still possible later with no separate order type; not built now.

## Consequences

- Existing orders with `paymentMethod: "whatsapp"` stay readable as history; nothing creates new ones.
- Drop waitlist sign-ups with `channel: "whatsapp"` are unaffected.
