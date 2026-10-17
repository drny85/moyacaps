import { SHIRT_VARIANTS } from "../data/caps";
import type { CartItem } from "../store/useStore";

/**
 * Bags saved before tee stock moved to SKUs (ADR 0015) can hold tee lines with a size but
 * no colorway: the old grid quick-add stored only "L". Checkout now needs both, and the
 * drawer cannot change them, so those lines get the tee's default colorway. Lines that
 * become identical are merged.
 */
export function backfillTeeColorways(cart: CartItem[]): CartItem[] {
  const out: CartItem[] = [];
  for (const item of cart) {
    const variantId = item.variantId ?? item.id;
    const tee = SHIRT_VARIANTS.find((t) => t.id === variantId);
    let next = item;
    if (tee && !item.colorway) {
      const cw = tee.colorways?.find((c) => c.id === tee.defaultColorway) ?? tee.colorways?.[0];
      if (cw) {
        const size = item.size ?? "L";
        next = {
          ...item,
          variantId,
          size,
          colorway: cw.id,
          colorwayName: cw.nameEn,
          id: `${variantId}-${cw.id}-${size}`,
        };
      }
    }
    const dup = out.find((o) => o.id === next.id);
    if (dup) {
      const limit = Math.min(dup.maxStock ?? 99, next.maxStock ?? 99);
      dup.quantity = Math.min(limit, dup.quantity + next.quantity);
      dup.maxStock = limit;
    } else {
      out.push({ ...next });
    }
  }
  return out;
}
