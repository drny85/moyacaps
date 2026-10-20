---
status: accepted
---

# Guest Orders are claimed by a verified email

Guest checkout stays the default (ADR 0002). A guest Order has no `clerkUserId`, so it never appears in an account's order history: the guest can only look it up on `/track` with its Order number and email (ADR 0006). When that guest later signs up or signs in with the same email, their guest Orders now join their account.

- **Only a verified email claims.** The address and its verified status come from Clerk, never from a client argument: the JWT's `email` and `email_verified` claims in `users/functions:syncCurrentUser`, or the primary address's `verification.status` in the signed Clerk webhook (`users/functions:upsertUser`, also used by `scripts/sync-users.ts`). Anything short of an explicit `true` claims nothing.
- **Only guest Orders move.** An Order that already has an owner is never reassigned. A claim sets `clerkUserId` and nothing else, so the Customer gets the same owner view, address editing and self-cancellation as for an Order placed while signed in.
- **Both sync paths claim.** The JIT sync runs on every sign-in, so a missed webhook only delays a claim. The webhook covers a sign-up that verifies the email before the app loads again.
- **Emails are stored normalized.** Claims match `customerEmail` through the `by_customerEmail` index, so every write lowercases and trims it (Stripe settlement, the Checkout Hold, the admin edit). `orders/guestClaim:normalizeOrderEmails` backfills existing Orders.

## Considered options

- **Match by email at read time, without claiming**: every history read would need the verified email, and an Order would have two kinds of owner.
- **Ask the Customer to confirm each Order by its number**: more friction, and the verified email already proves the Customer owns the address the receipts went to.
- **Claim on any email the client sends**: anyone could take another person's Orders, the same hole PR #30 closed in checkout.

## Consequences

- The sign-in path depends on the Clerk `convex` JWT template carrying `email_verified`. Without it, claims come only from the webhook.
- A Customer who changes their primary email in Clerk and verifies the new one also claims the guest Orders placed with the new address.
- One claim takes at most `MAX_ORDERS_CLAIMED` (100) Orders; the next sign-in or webhook takes the rest.
- Stored emails are lowercase, so receipts and the admin desk show them that way.
- Run on each deployment, passing `continueCursor` back until `isDone`: `npx convex run orders/guestClaim:normalizeOrderEmails`.
