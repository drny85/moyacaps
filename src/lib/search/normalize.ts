/**
 * Text folding shared by the search index and the query (plan 0006): lowercase, accents
 * removed ("Camiseta Negra" and "camiseta negra" match, "café" matches "cafe"), "&" read
 * as "and", every other punctuation mark a word break. Pure.
 */
export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Words of `text` after `normalize`, empty strings dropped */
export function tokenize(text: string): string[] {
  const folded = normalize(text);
  return folded ? folded.split(" ") : [];
}
