---
status: accepted
---

# Guests are rate-limited per client IP through a Checkout Pass

Every Pay click places a Checkout Hold for about 30 minutes (ADR 0024), so Pay clicks are rate-limited (security review H1). Signed-in buyers had their own bucket. All guests shared one bucket of 60 a minute, because Convex actions see no client IP. One script could drain that bucket and block every guest from checking out during a drop, and every request it made also held stock (security review M2).

The Next.js server does see the client IP. Before a guest's Pay click, the browser calls the `getCheckoutPass` server action. It returns a **Checkout Pass**: a keyed hash of the client IP, the time it was issued, and an HMAC over both, signed with `CHECKOUT_PASS_SECRET`. Only the Next.js server and Convex hold that secret. `createCheckoutSession` verifies the pass, which is valid for 2 minutes, and uses the hash as the guest's own bucket key, with the same budget as a signed-in buyer: 10 in 10 minutes.

- **No raw IP is stored or sent to Convex.** The rate-limit key is an HMAC of the IP.
- **A guest cannot pick another guest's bucket.** Making a pass needs the secret, and the server action only signs the caller's own IP.
- **Guests without a pass fall back to the shared bucket.** That covers `CHECKOUT_PASS_SECRET` not being set yet, a page built before passes existed, and a failed server action. A script that skips the pass drains only the shared bucket, which real guests with a pass no longer use.
- **IP source.** The pass reads `x-real-ip`, then the first hop of `x-forwarded-for`. Vercel sets both from the connecting client. If a proxy such as Cloudflare sits in front of Vercel, these headers carry the proxy's IP, and guests behind one proxy edge would share a bucket.

The same review (M1) also budgeted the public `syncCheckoutSession` and `abandonCheckoutSession` actions, because each call reaches Stripe. Both accept only `cs_` ids. Each Checkout Session is limited to 5 lookups a minute. Sync also draws from a shared budget of 120 a minute. Abandon does not: if a script drained that budget, real back-link releases would stop and units would stay held.

## Considered options

- **Require sign-in for drops**: simplest to enforce, but it adds friction to the store's main sales moment.
- **Route the whole checkout through a Next.js server action**: also gives per-IP limits, but every checkout would then have to forward the Clerk token through Next.js, and the Convex action would stay callable directly anyway.
- **Bot check (Turnstile) on guest checkout**: stronger against scripts, but it adds friction and another dependency. It could be layered on later.

## Consequences

- Set `CHECKOUT_PASS_SECRET` to the same random value in Vercel and in each Convex deployment. Until both have it, guests keep using the shared bucket, as before.
- A guest's Pay click makes one extra round trip, to the server action.
- An attacker with many IPs can still hold stock. The per-IP limit only raises the cost of doing so.
