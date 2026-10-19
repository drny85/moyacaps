/**
 * The Shop filters a search query implies (plan 0006): "gorra negra" opens the Shop on Caps
 * in black, "trucker" on the trucker Silhouette. Built with the Shop's own serializer so the
 * link follows its URL rules (ADR 0016, 0020). Pure.
 */
import { DEFAULT_STATE, serializeShopState, type ColorFamily, type ShopState, type Silhouette } from "../shop";
import { tokenize } from "./normalize";
import { categoryOfWord, COLOR_WORDS, SILHOUETTE_WORDS } from "./vocabulary";

export function shopStateForQuery(query: string): ShopState {
  const categories = new Set<"caps" | "tees">();
  const colors = new Set<ColorFamily>();
  const silhouettes = new Set<Silhouette>();

  for (const word of tokenize(query)) {
    const category = categoryOfWord(word);
    if (category) categories.add(category);
    if (COLOR_WORDS[word]) colors.add(COLOR_WORDS[word]);
    if (SILHOUETTE_WORDS[word]) silhouettes.add(SILHOUETTE_WORDS[word]);
  }

  // A Silhouette is a cap facet, so it implies Caps unless the query also asked for tees
  if (silhouettes.size && !categories.has("tees")) categories.add("caps");

  return {
    ...DEFAULT_STATE,
    category: categories.size === 1 ? [...categories][0] : "all",
    colors: [...colors],
    silhouettes: categories.has("tees") ? [] : [...silhouettes],
  };
}

/** Locale-less Shop href for the i18n `Link` */
export function shopHrefForQuery(query: string): string {
  return `/products${serializeShopState(shopStateForQuery(query))}`;
}
