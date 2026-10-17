/**
 * Order lines carried in Stripe Checkout metadata.
 *
 * Stripe caps each metadata value at 500 characters (and 50 keys per object). A tee line
 * with colorway and size takes ~70 characters, so one JSON value overflows around 7 lines.
 * Lines are packed into as few JSON arrays as fit: `itemsJson`, then `itemsJson_1`,
 * `itemsJson_2`, … Sessions created before this split only have `itemsJson`, which still
 * decodes the same way.
 */

export const STRIPE_METADATA_VALUE_MAX = 500;
/** Leaves room for the other ~12 keys the checkout already sets (Stripe allows 50) */
export const MAX_ITEM_CHUNKS = 30;

export type CompactLine = { v: string; q: number; p: number; c?: string; s?: string };

export function toCompactLine(item: {
  variantId: string;
  quantity: number;
  price: number;
  colorway?: string;
  size?: string;
}): CompactLine {
  return {
    v: item.variantId,
    q: item.quantity,
    p: item.price,
    ...(item.colorway ? { c: item.colorway } : {}),
    ...(item.size ? { s: item.size } : {}),
  };
}

const chunkKey = (i: number) => (i === 0 ? "itemsJson" : `itemsJson_${i}`);

/** Metadata entries for the given lines, every value at most 500 characters. */
export function encodeItemsMetadata(
  items: Array<{ variantId: string; quantity: number; price: number; colorway?: string; size?: string }>
): Record<string, string> {
  const chunks: CompactLine[][] = [[]];
  for (const line of items.map(toCompactLine)) {
    if (JSON.stringify(line).length + 2 > STRIPE_METADATA_VALUE_MAX) {
      throw new Error(`Order line for ${line.v} is too long for Stripe metadata`);
    }
    const current = chunks[chunks.length - 1];
    if (current.length > 0 && JSON.stringify([...current, line]).length > STRIPE_METADATA_VALUE_MAX) {
      chunks.push([line]);
    } else {
      current.push(line);
    }
  }
  if (chunks.length > MAX_ITEM_CHUNKS) {
    throw new Error(`Order has too many lines for Stripe metadata (${items.length})`);
  }
  return Object.fromEntries(chunks.map((chunk, i) => [chunkKey(i), JSON.stringify(chunk)]));
}

/**
 * Raw line objects reassembled from `itemsJson`, `itemsJson_1`, …; [] when absent or unreadable.
 * Entries may be compact ({v,q,p,c,s}) or full ({variantId,name,…}) from older sessions.
 */
export function decodeItemsMetadata(metadata: Record<string, string | undefined> | null | undefined): unknown[] {
  if (!metadata?.itemsJson) return [];
  const lines: unknown[] = [];
  for (let i = 0; i < MAX_ITEM_CHUNKS; i++) {
    const raw = metadata[chunkKey(i)];
    if (!raw) break;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) lines.push(...parsed);
    } catch (e) {
      console.error(`decodeItemsMetadata: unreadable ${chunkKey(i)}`, e);
      return [];
    }
  }
  return lines;
}
