# Static Storefront Pages, Deferred Offscreen Images and How LCP Is Measured

After ADR 0018, the storefront met ADR 0016's performance score on a Vercel preview (94 / 96 / 96) but not its LCP target (< 2.5 s). The `[locale]` routes rendered on every request, so a cold function took about 2 s to answer. During first load, Chrome's lazy loading also fetched offscreen grid photos in parallel with the LCP image. Applied-throttling runs showed a third problem. The homepage's largest element, the outlined "0880" behind the cap, faded in from opacity 0, so Chrome only counted it after hydration (LCP 4.25 s vs FCP 1.8 s).

## Decisions

1. **The storefront prerenders.**
   - The locale layout and the home, Shop and product pages call `setRequestLocale`, so next-intl no longer reads request headers.
   - Product pages use `generateStaticParams` from Convex with `revalidate = 300` (ISR). They fetch through `queryForStaticRender`, because `convex/nextjs`'s `fetchQuery` forces `cache: "no-store"`, which makes a route dynamic. It is for public queries only.
   - Price and stock stay live through the existing `useQuery` subscriptions.
   - Account, checkout, track and admin stay dynamic.
2. **Shop categories are their own static pages, with unchanged URLs.** The proxy rewrites `/{locale}/products?category=caps|tees` to `/{locale}/products/category/{category}` (`src/lib/shopRoutes.ts`), so each category keeps its canonical metadata and server-rendered grid.
3. **Query strings are read after hydration, not during prerender.** `useSearchParams` in a static page would make the grid and gallery render only in the browser. `useUrlQuery` renders the route's default, applies the live query before paint through a client-only sync, and writes filter and colourway changes with `history.replaceState` (no server round trip; Next keeps `useSearchParams` in step). The tab's `document.title` follows the category.
4. **Offscreen images wait for the page to settle.** `DeferredImage` renders a `fill` image once the first page has loaded and gone idle (`usePageSettled`), or when its box enters the viewport. It is used for Shop cards after the first four, the featured row, related products, gallery slides 2+, the anatomy and lookbook photos. LCP images and first-row cards render in the server HTML as before.
5. **Large decorative layers do not fade in.** An element animated from opacity 0 by CSS counts for LCP only when the main thread repaints it. The hero's ghost number uses the transform-only `.intro-settle`; `.intro-fade` remains for small elements.
6. **Each budget limit has its own measuring method** (owner's decision, 2026-10-17; ADR 0016 §8 amended):
   - **Performance ≥ 90 is judged on Lighthouse's default simulated throttling**, the score PageSpeed Insights shows.
   - **LCP < 2.5 s is judged on applied DevTools throttling** (slow 4G + 4× CPU actually applied), the closest lab stand-in for "a mid-range Android device".

   Simulated (Lantern) LCP is not used as the gate. It averages an optimistic and a pessimistic estimate, and the pessimistic one counts every request started before the observed LCP: here all ~250 KB of Next.js / React / Convex / motion JS from `<head>`. So it tracks total first-load JS whatever the page paints. `bun run perf-budget` runs both methods on every page and gates each limit on its method; the table keeps simulated LCP for reference.

## Consequences

- Catalog edits reach the static HTML within 5 minutes. New products render on first request, then are cached.
- A hard load of a filtered URL (e.g. `?color=black`) paints the unfiltered category first and applies the filter before the next paint after hydration.
- Pages reached by client navigation load all images at once (the settled flag stays true).
- On the preview, applied throttling meets the budget on all three pages, while simulated LCP is still 2.6–3.0 s. Closing the simulated gap needs roughly 100 KB less first-load JS, mostly framework and Convex client, which this ADR does not attempt. With the split in decision 6, the budget is met on the preview. Simulated LCP stays in the report so bundle growth remains visible.
