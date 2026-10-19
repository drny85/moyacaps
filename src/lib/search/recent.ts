/** Recent searches, newest first (plan 0006). Pure; storage lives in useRecentSearches. */
import { normalize } from "./normalize";

export const RECENT_LIMIT = 5;

/** `list` with `query` moved to the front, duplicates (ignoring case and accents) dropped */
export function pushRecent(list: string[], query: string, limit = RECENT_LIMIT): string[] {
  const trimmed = query.trim().replace(/\s+/g, " ");
  if (!normalize(trimmed)) return list;
  const key = normalize(trimmed);
  return [trimmed, ...list.filter((q) => normalize(q) !== key)].slice(0, limit);
}

/** Stored value back to a list; anything malformed reads as empty */
export function parseRecent(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((q): q is string => typeof q === "string").slice(0, RECENT_LIMIT) : [];
  } catch {
    return [];
  }
}
