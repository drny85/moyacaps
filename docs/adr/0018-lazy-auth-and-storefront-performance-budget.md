# Lazy Clerk on the Storefront and the Performance Budget Check

ADR 0016 sets a hard motion budget: Lighthouse mobile performance ≥ 90 and LCP < 2.5 s. When Phase 5 shipped, every storefront page loaded Clerk up front: about 150 KB of `@clerk/*` bindings in our bundle, plus clerk-js and `@clerk/ui` from Clerk's CDN (about 350 KB). The page also took a `clerkMiddleware` handshake redirect (three redirects, about 550 ms) for any visitor without Clerk cookies, which is every visitor on a development instance. No server code reads the session outside `/account`, `/checkout` and `/admin`. Convex auth is client-side (ADR 0005).

## Decisions

1. **Clerk mounts beside the page, not around it.** `ClerkClientProvider` renders the page as `children` and, when needed, lazily mounts `ClerkRuntime` next to it. `ClerkRuntime` is the only client module that imports `@clerk/nextjs`. Loading Clerk therefore never remounts the page tree. `ClerkRuntime` reports `useUser` / `useAuth` into a small zustand store (`src/lib/auth/safeAuthStore.ts`). It portals `<UserButton>` into the slots that `SafeUserButton` reserves.
2. **When Clerk loads** (`src/lib/auth/clerkLoadPolicy.ts`, pure and tested):
   - **Immediately** on `/account`, `/checkout` and `/admin`.
   - **After idle** when a `__client_uat` cookie is positive (a returning, probably signed-in visitor). Their avatar, orders link, admin bar and Convex auth come back without delaying first paint.
   - **Otherwise on intent.** Hovering or focusing a sign-in control preloads Clerk. Clicking it queues the sign-in, loads Clerk and opens the modal once the session is known. If the cookie hint was stale and the visitor is already signed in, no modal opens.
3. **The component API is unchanged.** `useSafeUser`, `SafeSignInButton` and `SafeUserButton` keep their signatures. Before Clerk reports, a visitor we expect to have a session (auth route, cookie hint, or Clerk loading) is `isLoaded: false`. An anonymous visitor on a public page is `isLoaded: true, isSignedIn: false`. `AdminGuard` and checkout still wait for the real answer.
4. **Convex auth comes from the same store.** `ConvexClientProvider` uses `ConvexProviderWithAuth` with a hook over `safeAuthStore`. The token rules mirror `convex/react-clerk`: use the `convex` JWT template unless the session token already has `aud: "convex"`, and refetch when the session or org changes. `UserSyncProvider` is unchanged.
5. **`clerkMiddleware` runs only on the auth routes**, through the same `routeNeedsClerk` rule. Public pages skip the handshake. Server-side admin protection is unchanged: Convex functions check the identity, and `/admin` still runs the middleware.
6. **First-load JavaScript is trimmed elsewhere too:**
   - Framer Motion uses `LazyMotion` + `m` (`strict`). `domAnimation` loads as its own chunk, and the Shop adds `domMax` (`LayoutMotion`) for `layout` / `layoutId`.
   - The cart drawer, drop alert, try-on modal, share toast and admin bar load as separate chunks (`DeferredOverlays`). Each loads the first time it is needed, and the chunks are warmed on the visitor's first interaction.
   - Lenis loads only on fine-pointer, motion-OK devices.
   - next-intl precompiles messages, so the ICU parser does not ship to the browser.
   - Storefront pages receive only storefront message namespaces (`src/i18n/clientMessages.ts`). Checkout, account, track and admin add the rest in their segment layouts.
   - The hero turntable paints only its front photo until the page is idle or the visitor reaches for the cap.
   - Only the poster face (Anton) is preloaded.
7. **The budget is a script, not a manual step.** `bun run perf-budget` builds the app, serves it, runs Lighthouse mobile 3× on `/en`, `/en/products` and the first product page, and exits non-zero when a median misses the budget. Use `--url` for a deployed preview.

## Consequences

- An anonymous visitor's first sign-in click waits for Clerk to download (about 0.5–1 s on 4G) before the modal opens. Hovering or focusing the button preloads it.
- Code that needs Clerk's own hooks or components must live in `ClerkRuntime` or be portaled from it. Importing `@clerk/nextjs` in other client code would bring Clerk back onto every page.
- The overlays' first open costs a chunk download if the visitor has not interacted with the page yet.
- New message namespaces must be classified as storefront or route-scoped, or a test fails.
- Local Lighthouse runs are noisy under CPU load (±3 points between runs). Compare medians from the same machine state, and trust a preview deployment over a busy laptop.
