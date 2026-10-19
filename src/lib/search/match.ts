/**
 * How well one query word matches one indexed word (plan 0006). Exact beats prefix beats
 * substring beats typo, so "skull" ranks the Gothic Skull Tee above a fuzzy hit. Pure.
 */

/**
 * Damerau–Levenshtein distance (optimal string alignment), stopping early once every
 * path exceeds `max`. Returns `max + 1` for anything further than `max`.
 */
export function editDistance(a: string, b: string, max: number): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;

  let prevPrev: number[] = [];
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let d = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d = Math.min(d, prevPrev[j - 2] + 1);
      row.push(d);
      if (d < rowMin) rowMin = d;
    }
    if (rowMin > max) return max + 1;
    prevPrev = prev;
    prev = row;
  }
  return Math.min(prev[b.length], max + 1);
}

/** Typos allowed for a query word of this length; `loose` is the "did you mean" pass. */
export function allowedTypos(length: number, loose = false): number {
  if (loose) return length >= 7 ? 3 : length >= 4 ? 2 : length >= 3 ? 1 : 0;
  return length >= 8 ? 2 : length >= 4 ? 1 : 0;
}

export const MATCH = { exact: 1, prefix: 0.85, substring: 0.6, typo: 0.45 } as const;

/** Score in [0, 1] for `query` against one indexed `word`; 0 is no match. */
export function scoreWord(query: string, word: string, loose = false): number {
  if (!query || !word) return 0;
  if (query === word) return MATCH.exact;
  if (word.startsWith(query)) return MATCH.prefix;
  if (query.length >= 3 && word.includes(query)) return MATCH.substring;

  const max = allowedTypos(query.length, loose);
  if (max === 0) return 0;
  // A typo in a word still being typed: compare against the word's start too ("gotic" vs "gothic", "eagl" vs "eagle")
  const whole = editDistance(query, word, max);
  const head = word.length > query.length ? editDistance(query, word.slice(0, query.length), max) : max + 1;
  const d = Math.min(whole, head);
  if (d > max) return 0;
  return MATCH.typo * (1 - (d - 1) * 0.2);
}
