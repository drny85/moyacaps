---
status: accepted
---

# Order lifecycle: hold stock at checkout, split payment and fulfillment status

Card checkout used to create no Order until Stripe's webhook reported payment, so two Customers could pay for the last unit of a drop and the oversell went unnoticed (stock clamped at zero). An Order now exists from the moment the Customer clicks Pay: it holds its units (Checkout Hold) for the life of a 30-minute Checkout Session, settles on payment, and is cancelled with its hold released when Stripe reports the session expired.

The single `status` field is replaced by two: **Payment Status** (awaiting payment, paid, partially refunded, refunded, disputed) and **Fulfillment Status** (unfulfilled, label purchased, in transit, delivered, delivery exception, returned), plus a cancelled marker. One field mixing both meant a refund erased that an order had shipped or been delivered.

## Considered options

- **No hold; detect oversell at settlement and auto-refund**: cheaper, but a Customer pays and then gets refunded for a drop item they thought they had.
- **Keep one status with more combined values** (`delivered_partially_refunded`, …): the combinations multiply with every new state.

## Consequences

- A shipping label can be bought only for a paid, not cancelled, unfulfilled Order, and buying one never moves stock.
- Restock on refund or return is an explicit per-line Administrator choice.
- Tracking numbers come only from carrier labels.
- A Checkout Hold is released only after Stripe reports the session expired; a backstop every 10 minutes expires sessions of Orders still awaiting payment 5 minutes after their hold ended, and logs each release as a warning, since every one means a lost or rejected webhook (a wrong signing secret once left holds to the backstop alone for over an hour). A new Pay click or Stripe's back link expires the previous session at once.
- A disputed unfulfilled Order cannot get a label until the dispute closes.
- Refunds are by line and quantity (line price plus its tax share, optional shipping); a free-amount Goodwill Refund never restocks.
- Existing orders need a one-off migration from the old `status` to the two new fields.
