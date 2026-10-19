# 0006 — Storefront Search

Builds on [ADR 0016](../adr/0016-mobile-first-storefront-redesign.md) (Shop model), [ADR 0018](../adr/0018-lazy-auth-and-storefront-performance-budget.md) and [ADR 0020](../adr/0020-static-storefront-and-lcp-measurement.md) (performance budget). Vocabulary: `CONTEXT.md` (Product, Catalog Shot, Colorway, Apparel Colorway, Silhouette, Graphic Design, Shop, Customer).

## 1. Overview

A Customer who knows a Product's name should find it in a few keystrokes from any storefront page. Customers search by name ("gothic skull", "eagle clover", the cap's name), so the name is the strongest signal. Colorway names, Silhouette, category and synonyms ("hat", "gorra", "shirt", "playera") help but rank lower.

Branch: `claude/storefront-search-294b37`, cut from `feat/admin-catalog-foundation`. Storefront only: no admin or Convex changes.

Out of scope: a search results page, server-side search, a third-party analytics vendor.

## 2. Decisions

The Customer chose name-first search and left the rest to the builder. The calls below were made by the builder.

- **Entry point.** A search button in the navbar opens an overlay. On phones it fills the screen; from `md` up it is a centered panel. `/` and Cmd/Ctrl+K open it, except while typing in a field.
- **Results.** Instant, on every keystroke, with no debounce (about 30 Products). One row per Product shows the Catalog Shot, name, price and Cap or Tee. When the query names an Apparel Colorway ("gothic skull cream"), the row shows that Colorway's Catalog Shot and links to `?colorway=`. At most 8 rows.
- **Matching.** All query words must match (AND), after lowercasing and accent folding. Each word is scored against weighted fields. Names score highest (en and es, which cover the Graphic Design). Colorway names come next. Silhouette, category and synonyms score lowest. Within a field, an exact word beats a prefix, a prefix beats a substring, and a substring beats a typo. Typo tolerance (Damerau–Levenshtein) allows 1 edit for words of 4–7 letters and 2 edits for 8 or more. Ties go to featured Products, then purchasable ones, then catalog order (the Shop's "featured" order).
- **Empty query.** Shows up to 5 recent searches (in `localStorage`, guarded, clearable) and 4 featured Products.
- **No results.** Shows "did you mean" with up to 3 closest names (a relaxed pass: any word, looser typos) and a link to the full Shop.
- **Shop deep link.** A footer link, "See all in the Shop", carries what the query implies as Shop filters: category from synonyms (`category=caps|tees`), color families from color words in en and es (`color=black`), and Silhouette (`silhouette=trucker`). It uses `serializeShopState`, so links stay in step with the Shop's URL rules.
- **Analytics.** No vendor is installed on the storefront. Search sends typed `CustomEvent("gl:search")` events on `window`: `open`, `select` (query, Product, position), `no_results` and `shop_link`. Wiring a vendor is a follow-up.
- **Accessibility.** The panel is a `dialog` (`aria-modal`) containing an ARIA 1.2 combobox: the input has `aria-expanded`, `aria-controls` and `aria-activedescendant` over a `listbox` of `option`s. Arrow keys move, Enter opens, Escape closes. `useFocusTrap` keeps focus in the panel and returns it to the trigger. `useLockBodyScroll` stops the page scrolling behind. Result counts are announced in a polite live region.
- **Performance.** The overlay is a separate chunk loaded through `DeferredOverlays` (`next/dynamic`, `ssr: false`) the first time search opens, and warmed on first interaction like the cart. First-load JS on home and Shop gains only the navbar button, a store flag and the shortcut listener. Search reads the already-seeded catalog through `useCapVariants()`. No new backend.

## 3. Implementation

Pure modules (`src/lib/search/`, unit-tested):
- `normalize.ts`: `normalize`, `tokenize` (accent folding, punctuation, `&`).
- `vocabulary.ts`: category synonyms, color words to `ColorFamily`, Silhouette words (en and es).
- `match.ts`: `editDistance` (Damerau–Levenshtein with a cutoff) and `scoreWord`.
- `searchProducts.ts`: `buildSearchIndex`, `searchProducts`, `suggestNames`, `featuredProducts`.
- `shopLink.ts`: `shopStateForQuery` and `shopHrefForQuery`.
- `recent.ts`: `pushRecent`.
- `shortcut.ts`: `isSearchShortcut`.
- `analytics.ts`: `SearchEvent` and `trackSearch`.

Client:
- `src/store/useStore.ts`: `isSearchOpen`, `openSearch`, `closeSearch`. Not persisted.
- `src/components/search/SearchOverlay.tsx`: the dialog, combobox and result rows.
- `src/components/search/useRecentSearches.ts`: the guarded `localStorage` wrapper.
- `src/components/layout/DeferredOverlays.tsx`: latch, lazy import, warm-up, `/` shortcut.
- `src/components/layout/Navbar.tsx`: one search button (minimal diff).
- `src/messages/{en,es}.json`: the `search` namespace and `nav.search`.

## 4. Verification

- `bun run test` and `bunx tsc --noEmit`.
- On the dev preview at 375 px and desktop:
  - The navbar button and `/` both open search.
  - Typing "gotic" finds Gothic Skull.
  - "hat" lists Caps.
  - The arrow keys, Enter and Escape all work.
  - The empty state shows recent searches, and a no-results query shows suggestions.
  - The Shop link carries filters.
  - No console errors.

## 5. Status

- [x] 1. Plan
- [x] 2. Pure modules and tests
- [x] 3. Overlay, store, navbar, copy (`search` added to `STOREFRONT_NAMESPACES`; the overlay sits at `z-[60]`, above the z-50 bars)
- [x] 4. Verify on the dev preview, desktop and 375 px, en and es. The `/` key opens search. "gotic skul" finds the Gothic Skull Tee, and "black hat" gives 5 Caps with a Shop link to `?category=caps&color=black`. "skull cream" plus Enter opens `?colorway=butter-cream`, records a recent search and emits a `select` event. "skoal" shows "did you mean". Escape closes and returns focus to the trigger.

Known gap (data, not search): some live Spanish names keep the English Graphic Design ("Playera Gothic Eagle & Clover…"), so "aguila" finds nothing. Fix it in the admin catalog copy, or add design aliases later.
