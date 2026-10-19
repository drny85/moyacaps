# goodluckcaps.com — multi-lane SEO audit

- **Status:** provisional (no formal `seo-findings.json` bundle; not validated by the suite findings validator)
- **Captured:** live 2026-10-19T16:43Z (pre-deploy); local branch `feat/try-on-redesign` @ `e16dce6`; live recheck 2026-10-19T16:54Z (post-deploy)
- **Owner:** Robert Melendez (site owner, engineering)
- **Next destination:** [Action plan, below](#7-proposed-next-steps-pending-approval) → `seo-action-plan` if a formal plan is wanted

## 1. Charter

| Item | Value |
|---|---|
| Objective | Find search-visibility defects and opportunities on the storefront; check public Markdown discovery coverage |
| Property | `https://goodluckcaps.com` (apex canonical; `www` and `http` 308 to apex). Hosted on Vercel, Next.js 16 App Router + next-intl |
| Locales | `en` (default), `es` — path-prefixed `/en`, `/es` |
| Environments | Production (live HTTP fetches) and local dev server of the current branch (source parity) |
| Templates sampled | Home, Shop (`/products`), category view (`?category=caps`), cap PDP, tee PDP, tee PDP with `?colorway=`, Try-on, Track, 404 — `en` and `es` |
| Access | Owner's repo and public site only. **Not available:** Search Console, analytics, server logs, CrUX/field data, a full crawler |
| Exclusions | `/admin`, `/checkout`, `/account` (private, robots-disallowed). Off-page authority, competitors, performance lab runs |
| Lanes run | Technical, international (hreflang), structured data, page/content, sitemap, AI-crawler access, Markdown discovery |
| Lanes not run | Performance (no field data this run; repo has its own LCP budget, ADR 0019/0020), authority, competitive, measurement |

Evidence: [live page signals](raw/live/page-signals.txt), [live sitemap](raw/live/sitemap.xml), [live robots](raw/live/robots.txt), [local page signals](raw/local/page-signals.txt), [local sitemap](raw/local/sitemap.xml), [post-deploy page signals](raw/postdeploy/page-signals.txt), [post-deploy sitemap](raw/postdeploy/sitemap.xml), hashes in [raw-sha256.txt](raw-sha256.txt), extractor [raw/extract.py](raw/extract.py).

## 2. Headline

At first capture (16:43Z) production ran `main` @ `9b1a48c`, without the SEO commit `afb5f93`. [drny85/moyacaps#3](https://github.com/drny85/moyacaps/pull/3) merged it (merge `f70b11f`) at 16:45:35Z and Vercel deployed `main`. **Live recheck at 16:54Z confirms D1–D7 fixed on production.** Five opportunities (O1–O5) and four unknowns remain.

## 3. Findings

Classes: **Defect** = confirmed by capture. **Opportunity** = supported improvement. **Unknown** = needs evidence not available here.

### Defects confirmed pre-deploy, fixed live by PR #3

| ID | Lane | Finding | Pre-deploy evidence (16:43Z) | Status (local + live 16:54Z) |
|---|---|---|---|---|
| D1 | International | `/es/*` pages serve `<html lang="en">` | `page_es`, `page_es_products_negro-rojo` → `lang ['en']` | Fixed: local `/es` → `lang="es"` |
| D2 | International | No `x-default` hreflang in HTML or sitemap | 0 `x-default` in live sitemap/HTML | Fixed: 68/68 sitemap URLs + HTML carry `x-default` → `/en` |
| D3 | Structured data | `WebSite` `SearchAction` target `https://goodluckcaps.com/en/products/{search_term_string}` resolves to a product route; `/en/products/red` → **404** | live JSON-LD; HTTP 404 | Fixed: SearchAction removed (`src/lib/seo/jsonLd.ts:29`) |
| D4 | Sitemap | Sitemap lists `https://goodluckcaps.com` (bare root), which **307**s to `/en` — redirecting URL in sitemap; root redirect is temporary | live `sitemap.xml` entry 1; `curl -I /` → 307 | Fixed: root dropped; 68 entries all locale URLs |
| D5 | Sitemap | `/try-on` (indexable, self-canonical, 200) missing from live sitemap | live sitemap has 67 locs, no `/try-on` | Fixed: `/en/try-on`, `/es/try-on` present |
| D6 | Structured data | PDP has no `BreadcrumbList`; Product lacks `@id`, `url`, `category`; Offer `availability` hard-coded `InStock` | live PDP JSON-LD | Fixed: Breadcrumb + `@id`/`url`/`category`; availability from `stock` |
| D7 | Sitemap | No image sitemap entries for product images | live sitemap | Fixed: 112 `image:image` entries |

### Open on production

| ID | Class | Lane | Finding | Evidence | Proposed owner |
|---|---|---|---|---|---|
| O1 | Opportunity | Commerce / structured data | `Offer` has no `shippingDetails` or `hasMerchantReturnPolicy`. Google lists both as recommended for merchant listings; absence limits shipping/returns annotations, not eligibility | live + local PDP JSON-LD | Eng + ops (needs real shipping rates/return terms; don't invent) |
| O2 | Opportunity | Structured data | Product has one image on cap PDPs; no `color`, `size`, `material` or `ProductGroup`/`hasVariant` for tee colourways | live PDP JSON-LD; tee `?colorway=` canonicalises to base PDP (good) | Eng |
| O3 | Owner-required profile gap | Markdown discovery | No `/llms.txt`, `/sitemap.md` or page `.md` mirrors; 0 of 68 eligible URLs covered. `/sitemap.md` 307s to `/en/sitemap.md` (middleware matcher does not exclude `.md`) then 404 | see [markdown-coverage.md](markdown-coverage.md) | Eng + content |
| O4 | Opportunity | Page/content | Category views (`?category=caps|tees`) reuse the Shop meta description verbatim; PDP body copy is short (≈260–300 visible words incl. chrome) and templated per type | `page-signals.txt` | Content |
| O5 | Opportunity | Page/content | `/products` and `/track` have no `og:image`; PDP `og:type` is `website` | live head tags | Eng |

### Checked and fine (no action)

- HTTPS, HSTS (`max-age=63072000`), `www`→apex and `http`→`https` are single 308 hops.
- Self-referencing canonicals on every sampled 200 page; `?colorway=` variants canonicalise to the base PDP.
- 404s return real 404 status with `noindex`.
- `robots.txt` blocks only private areas; `Sitemap:` points at the real XML sitemap. GPTBot, ClaudeBot, PerplexityBot and Googlebot UAs all get 200 on a PDP (a 200 is not evidence of crawling, indexing or citation).
- One `<h1>` per page; titles and descriptions are unique per locale and localized (`es` product names, copy).
- Try-on `alt=""` images (24) sit inside buttons with `aria-label`/visible names — correct decorative use, not a defect.
- Server-rendered HTML contains product name, price and links; no client-render dependency observed for core content.

### Unknown (needs evidence not available here)

| ID | Question | Evidence needed |
|---|---|---|
| U1 | Indexed page count, duplicate/alternate handling of `?category=` pages | Search Console coverage + URL inspection |
| U2 | Core Web Vitals on real users | CrUX / Vercel Speed Insights |
| U3 | Whether AI engines retrieve or cite the site | AI-visibility monitoring (`ai-visibility-monitor`) |
| U4 | Rich-result eligibility after deploy | Rich Results Test on deployed PDPs |

## 4. Limitations

- Sample of 11 live URLs + 3 local; inventory from XML sitemap + source routes (`src/lib/seo/sitemap.ts`, `src/data/caps`). No crawler run, so orphan or non-sitemap URLs beyond source routes are not proven absent.
- Local check used `next dev`, not a production build; head/JSON-LD output is the same code path, but caching/headers were not verified locally.
- No ranking, traffic or citation claims are made.

## 5. Prioritized ownership map

| Priority | Item | Why | Owner | Reversibility |
|---|---|---|---|---|
| 1 | Search Console: resubmit `sitemap.xml`; URL-inspect `/es` and one PDP; request reindex | Speeds pickup of D1–D7 fixes; needs owner's GSC access | Owner | n/a |
| 2 | Rich Results Test on one cap and one tee PDP | Confirms Product + Breadcrumb parse in production (U4) | Owner / Eng | n/a |
| 3 | O1 shipping + return policy markup | Needs real policy facts first | Ops → Eng | Remove fields |
| 4 | O3 llms.txt + Markdown mirrors (owner-required profile) | Larger build; middleware change | Eng + content | Delete routes |
| 5 | O2, O4, O5 | Incremental | Eng / content | Trivial |

## 6. Decisions recorded

- No blended SEO score is given.
- D-items were graded fixed only after a fetch confirmed the output (local, then live), not from the commit message.
- Ship path: no merge or cherry-pick needed; PR #3 already landed. Cherry-picking `afb5f93` alone would have dropped the conflict resolution in `e16dce6`.

## 7. Proposed next steps (pending approval)

1. Owner runs the Search Console steps above (submit sitemap, inspect `/es`, `/en/products/negro-rojo`). Watch Page indexing for `es` URLs over ~2 weeks; hreflang errors should clear.
2. Rich Results Test on `/en/products/negro-rojo` and `/en/products/vintage-f1-tee`.
3. Gather shipping-rate and return-policy facts, then add O1 markup.
4. Decide whether to implement the Markdown discovery profile (O3) — scope in [markdown-coverage.md](markdown-coverage.md).
