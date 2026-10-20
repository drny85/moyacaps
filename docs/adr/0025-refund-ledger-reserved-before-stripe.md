---
status: accepted
---

# Refunds go through a ledger reserved before Stripe is called

ADR 0024 made refunds by line and quantity, with Restock an explicit per-line choice. Stripe only knows amounts, so Convex has to remember which units of which line were refunded. Every refund (line refund, Return, Goodwill Refund, Customer Cancellation, Administrator cancellation) is first written to an `order_refunds` row as **pending** inside the mutation that checks the rules, then sent to the Stripe Refunds API with an idempotency key derived from the Order and a caller-chosen request id, then marked **issued** or **failed**.

- A pending row counts against the line, so two Administrators (or a double click) can never refund the same unit twice.
- Restock happens only when the row turns issued: stock never moves for money that did not go back.
- An ambiguous Stripe error (network, outage) leaves the row pending; retrying sends the same idempotency key, so Stripe returns the refund it already made instead of a second one. Only errors Stripe raises before refunding (invalid request, card, auth) fail the row and free its lines.
- Payment Status and `refundedAmount` still come only from Stripe's `charge.refunded` webhook, so a refund made in the Stripe Dashboard and one made from the order page are recorded the same way, once.

## Considered options

- **Call Stripe first, then record**: a crash between the two loses which lines were refunded, and a concurrent refund can pass the quantity check.
- **Write Payment Status from the action**: a second writer for the same field, racing the webhook.

## Consequences

- A cancellation gives back only the units no issued refund already restocked, and a refund still pending when its Order is cancelled never restocks.
- Tax is shared across lines and shipping in proportion to their pre-tax amounts, cumulatively per line, so partial refunds of a line add up exactly to the whole line.
- A refund made in the Stripe Dashboard is not in the ledger: line quantities do not see it, but the remaining refundable amount does (the larger of the ledger total and `refundedAmount`).
- Stripe can fail or cancel a refund after accepting it (`refund.failed`, or `refund.updated` with status failed or canceled). The webhook finds the row by its Stripe refund id (or the ledger id in the refund's metadata) and marks it failed, which frees its lines, then records a `refund_failed` payment event and an adminNotes line. A Restock already done is not reversed automatically: the note asks the Administrator to check stock. Replays of the same event id change nothing.
