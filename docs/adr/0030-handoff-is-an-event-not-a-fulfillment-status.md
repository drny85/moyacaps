---
status: accepted
---

# A Handoff is an event on the Order, not a Fulfillment Status

Between buying a label and the carrier's first scan, a package can sit on the Administrator's shelf or already be in a USPS truck that skipped its pickup scan. The store had no record of when the box left. The Customer's timeline also lit "Shipped" as soon as the label was bought. We now record a **Handoff** (picked up or dropped off, with a time and an optional note) as a dated event on the Order's current label. Fulfillment Status stays **Ready to Ship** until a carrier scan moves it.

- **Fulfillment Status stays carrier-driven.** The scan rules (ADR 0024, `fulfillmentAfterScan`) and every queue, badge and email built on the six statuses are unchanged. A `TRANSIT` scan still moves Ready to Ship to in transit, whether or not a Handoff was recorded.
- **Recording a Handoff never locks carrier updates.** Only an Administrator's manual status change sets the lock. A Handoff is not a status change.
- **The Customer is told the package shipped at the Handoff or at the first scan, whichever comes first, and only once.** "Shipped" on the Customer's timeline follows the same rule.
- **Each label has at most one Handoff.** It can be corrected until the first scan. A Reship's new label starts without one.

## Considered options

- **A new `handed_to_carrier` Fulfillment Status**: easier to show in a list. But every scan rule, the manual-change lock, the queues, the badges and the emails would need a seventh state. A missed or delayed scan would also leave two sources fighting over one field.

## Consequences

- "Shipped" in the Customer's words means a Handoff or a scan, not a status value. Code that decides it reads both.
- The Orders desk flags a Ready to Ship package with no Handoff and no scan after 24 hours (a forgotten box), and one handed off with no scan after 3 days (likely lost before USPS took it).
