# goodluckcaps.com — Markdown discovery coverage

- **Status:** provisional — coverage audit only; nothing generated or published
- **Captured:** 2026-10-19T16:43Z (live), branch `e16dce6` (local)
- **Owner:** Robert Melendez
- **Next destination:** owner decision in [site-audit.md §7](site-audit.md#7-proposed-next-steps-pending-approval)

## Outcome

**0 of 68 eligible canonical URLs have a Markdown equivalent. No public Markdown entry point exists.** This is a gap against the audit suite's owner-required delivery profile, not a search-engine requirement: Google states no special AI text files are needed for AI features.

## Inventory and dispositions

Source of truth: `buildSitemap()` in `src/lib/seo/sitemap.ts` (branch) reconciled with the live XML sitemap and internal links on sampled pages.

| Group | Paths | Per locale | Total (en+es) | Disposition |
|---|---|---|---|---|
| Static storefront | `/`, `/products`, `/products?category=caps`, `/products?category=tees`, `/try-on`, `/track` | 6 | 12 | Eligible |
| Product pages | `/products/{id}` for available caps + tees | 28 | 56 | Eligible (price/stock are dynamic — need refresh path or time-bound statement) |
| **Eligible total** | | 34 | **68** | Markdown present: **0** |
| Private | `/admin/*`, `/checkout/*`, `/account/*` | — | — | Excluded: private, robots-disallowed |
| Variant params | `/products/{tee}?colorway=*` | — | — | Excluded: canonicalises to base PDP |
| Redirect | `/` (bare) → 307 `/en` | — | — | Excluded: redirect |

Pre-deploy live sitemap had 67 locs (bare root redirect, no `/try-on`). Since PR #3 deployed (recheck 16:54Z) live matches the 68 above. Inventory counts are complete for source-declared routes; no crawler run, so non-route URLs are unverified.

## Entry-point checks (live)

| Resource | Result |
|---|---|
| `/llms.txt` | 404 `text/html` |
| `/sitemap.md` | 307 → `/en/sitemap.md` → 404 |
| `/en/products/negro-rojo.md` | 404 `text/html` |
| `robots.txt` | 200 `text/plain; charset=utf-8`, no Markdown hint comments |
| `sitemap.xml` | 200 `application/xml`, no Markdown hint comment |

Root cause of the `/sitemap.md` redirect: the next-intl middleware matcher in `src/middleware.ts:38` excludes `.txt`/`.xml` but not `.md`, so any `.md` path gets a locale prefix. `/llms.txt` is excluded already and would serve from `public/` or a route handler.

## What implementation would need (pending approval)

1. Exclude `\.md` from the middleware matcher (or serve under a non-locale namespace).
2. Generate reviewed Markdown per eligible URL from the same source as HTML (`src/data/caps`, `messages/*`), with canonical URL, locale, source revision and owner in each file. Price/stock must come from the same data or carry an "as of" time.
3. `/llms.txt` + `/sitemap.md` listing all 68 mirrors; topic maps for caps, tees, try-on, orders/tracking.
4. `#` hint comments in `src/app/robots.ts` output and an XML comment in the sitemap — verify Next's serializer keeps them in delivered bytes.
5. Canonical policy for mirrors: `Link: <html-url>; rel="canonical"` header.
6. Validate with `manage_markdown_site.py validate`, then `live` for every generated resource after deploy.

Do not claim whole-site coverage from `llms.txt` alone or from a sample.
