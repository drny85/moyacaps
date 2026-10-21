---
status: accepted
---

# Product Reviews come only from Verified Buyers and are pre-moderated

Only a Verified Buyer can write a Product Review: a signed-in Customer who owns a delivered Order containing the Product, on a line that was neither refunded nor cancelled. Guest Orders count once claimed by a verified email (ADR 0026). Every new or edited review starts Pending, and nothing reaches the storefront or the Product JSON-LD until an Administrator publishes it. The store is small and every review is shown on a product page and in Google rich results, so one fake or abusive review costs more than the friction of an approval queue.

- **Eligibility is checked when a review is written or edited, never afterwards.** A review stays Published if its line is later refunded, for example after a Return of a defective item. That signal is genuine and worth keeping.
- **"Delivered", not "paid".** A Customer cannot review a Cap before holding it. A Delivery Exception or an unfulfilled Order makes no one a Verified Buyer.
- **One review per Customer per Product**, across all its Colorways and sizes. A repeat buyer edits the review instead of writing a second one.

## Considered options

- **Any signed-in Customer, or anonymous reviews**: cheaper to build, but they open the store to fake and competitor reviews. A "Verified Buyer" badge would then mean nothing.
- **Publish instantly and let an Administrator hide reviews later**: faster for the Customer, but abusive text is public and indexed until someone notices. Review volume is low enough for the queue to stay short.
- **Re-check eligibility on refund and unpublish**: would silently erase honest complaints about defective items.

## Consequences

- A review takes at least one Administrator action before it is public. Reviews stall if the `/admin/reviews` queue is ignored, because no email alert is sent.
- Editing a Published review takes it off the storefront until it is approved again.
- The product page and Product JSON-LD only ever read Published reviews.
