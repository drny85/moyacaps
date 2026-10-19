/**
 * Storefront search over the loaded catalog (plan 0006). About 30 Products, so a linear
 * scan per keystroke is well under a millisecond and needs no backend.
 *
 * Every query word must match somewhere (AND). A word scores best against the Product's
 * name (both locales, which carry the Graphic Design), then a Colorway name, then the
 * category / Silhouette / color vocabulary. Ties keep the Shop's featured order. Pure.
 */
import type { CapVariant } from "../../data/caps";
import { colorFamily, isPurchasable, isTee } from "../shop";
import { scoreWord } from "./match";
import { normalize, tokenize } from "./normalize";
import { CAP_WORDS, COLOR_WORDS, SILHOUETTE_WORDS, STOP_WORDS, TEE_WORDS } from "./vocabulary";

const WEIGHT = { name: 3, colorway: 2, keyword: 1 } as const;
/** Bonus when the whole query appears in the name as typed ("gothic skull") */
const PHRASE_BONUS = 2;

interface IndexedColorway {
  id: string;
  words: string[];
}

export interface IndexedProduct {
  product: CapVariant;
  /** Catalog position, the last tie-break */
  order: number;
  names: string[];
  nameWords: string[];
  colorways: IndexedColorway[];
  keywords: string[];
}

export interface SearchHit {
  product: CapVariant;
  /** Catalog Shot for the row: the matched Apparel Colorway's when there is one */
  image: string;
  /** Apparel Colorway the row opens on, when the query named one */
  colorway?: string;
  score: number;
}

const unique = (words: string[]) => [...new Set(words)];

const wordsForFamily = (family: string) => Object.keys(COLOR_WORDS).filter((w) => COLOR_WORDS[w] === family);

export function buildSearchIndex(products: CapVariant[]): IndexedProduct[] {
  return products.map((product, order) => {
    const tee = isTee(product);
    const keywords: string[] = [...(tee ? TEE_WORDS : CAP_WORDS)];
    if (!tee) {
      keywords.push(...Object.keys(SILHOUETTE_WORDS).filter((w) => SILHOUETTE_WORDS[w] === product.silhouette));
      keywords.push(...wordsForFamily(colorFamily(product.primaryHex)));
    }
    for (const tag of [product.tagEn, product.tagEs]) if (tag) keywords.push(...tokenize(tag));

    return {
      product,
      order,
      names: unique([normalize(product.nameEn), normalize(product.nameEs)]),
      nameWords: unique([...tokenize(product.nameEn), ...tokenize(product.nameEs)]),
      colorways: tee
        ? (product.colorways ?? []).map((c) => ({
            id: c.id,
            words: unique([...tokenize(c.nameEn), ...tokenize(c.nameEs), ...wordsForFamily(colorFamily(c.hex))]),
          }))
        : [],
      keywords: unique(keywords),
    };
  });
}

const best = (query: string, words: string[], loose = false) =>
  words.reduce((max, w) => Math.max(max, scoreWord(query, w, loose)), 0);

/** Query words worth matching: stop words dropped unless they are all there is */
export function queryWords(query: string): string[] {
  const words = tokenize(query);
  const meaningful = words.filter((w) => !STOP_WORDS.has(w));
  return meaningful.length ? meaningful : words;
}

function imageFor(product: CapVariant, colorwayId?: string): string {
  if (isTee(product) && product.colorways?.length) {
    const c =
      product.colorways.find((x) => x.id === colorwayId) ??
      product.colorways.find((x) => x.id === product.defaultColorway) ??
      product.colorways[0];
    return c.catalogShot ?? product.catalogShot ?? c.modelImage ?? product.image;
  }
  return product.catalogShot ?? product.image;
}

/** Score one Product, or null when some query word matches nothing */
function scoreProduct(entry: IndexedProduct, words: string[], phrase: string): Omit<SearchHit, "image"> | null {
  let score = 0;
  // Per-colorway score, to pick the Apparel Colorway the query names
  const colorwayScores = entry.colorways.map(() => 0);

  for (const word of words) {
    const name = best(word, entry.nameWords) * WEIGHT.name;
    const keyword = best(word, entry.keywords) * WEIGHT.keyword;
    let colorway = 0;
    entry.colorways.forEach((c, i) => {
      const s = best(word, c.words) * WEIGHT.colorway;
      colorwayScores[i] += s;
      colorway = Math.max(colorway, s);
    });
    const top = Math.max(name, colorway, keyword);
    if (top === 0) return null;
    score += top;
  }

  if (phrase.length >= 3 && entry.names.some((n) => n.includes(phrase))) score += PHRASE_BONUS;

  const bestColorway = colorwayScores.reduce((bi, s, i) => (s > (colorwayScores[bi] ?? 0) ? i : bi), 0);
  const colorway = colorwayScores[bestColorway] > 0 ? entry.colorways[bestColorway].id : undefined;
  return { product: entry.product, colorway, score };
}

/** Shop "featured" rank: featured first, then purchasable */
const shopRank = (p: CapVariant, now: number) => (p.isFeatured ? 0 : 2) + (isPurchasable(p, now) ? 0 : 1);

export function searchProducts(index: IndexedProduct[], query: string, now: number, limit = 8): SearchHit[] {
  const words = queryWords(query);
  if (words.length === 0) return [];
  const phrase = normalize(query);

  const hits: (SearchHit & { order: number })[] = [];
  for (const entry of index) {
    const hit = scoreProduct(entry, words, phrase);
    if (hit) hits.push({ ...hit, image: imageFor(hit.product, hit.colorway), order: entry.order });
  }
  hits.sort(
    (a, b) => b.score - a.score || shopRank(a.product, now) - shopRank(b.product, now) || a.order - b.order
  );
  return hits.slice(0, limit).map(({ order: _order, ...hit }) => hit);
}

/**
 * "Did you mean": Products whose name is closest to any query word, with looser typos.
 * For a query that found nothing.
 */
export function suggestNames(index: IndexedProduct[], query: string, limit = 3): SearchHit[] {
  const words = queryWords(query);
  if (words.length === 0) return [];
  return index
    .map((entry) => ({ entry, score: words.reduce((sum, w) => sum + best(w, entry.nameWords, true), 0) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.entry.order - b.entry.order)
    .slice(0, limit)
    .map(({ entry }) => ({ product: entry.product, image: imageFor(entry.product), score: 0 }));
}

/** Empty-query picks: the Shop's featured order, purchasable first */
export function featuredProducts(products: CapVariant[], now: number, limit = 4): SearchHit[] {
  return products
    .map((product, order) => ({ product, order }))
    .sort((a, b) => shopRank(a.product, now) - shopRank(b.product, now) || a.order - b.order)
    .slice(0, limit)
    .map(({ product }) => ({ product, image: imageFor(product), score: 0 }));
}
