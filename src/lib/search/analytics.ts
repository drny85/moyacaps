/**
 * Search analytics (plan 0006). The storefront has no analytics vendor yet, so events go out
 * as a `gl:search` CustomEvent on `window`; a vendor adapter can listen there later without
 * touching the search UI.
 */
export const SEARCH_EVENT = "gl:search";

export type SearchEvent =
  | { type: "open" }
  | { type: "select"; query: string; productId: string; position: number; resultCount: number }
  | { type: "no_results"; query: string }
  | { type: "shop_link"; query: string; href: string };

export function trackSearch(event: SearchEvent): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<SearchEvent>(SEARCH_EVENT, { detail: event }));
}
