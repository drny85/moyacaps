import { ALLOWED_SIZES } from "../../../convex/catalog/rules";
import { suggestVariantId } from "./productForm";
import type { ColorwayDraft, ProductFormState } from "./productForm";

/** Pure edits behind the tee options editor: Apparel Colorways and sizes. */

const BLANK_COLORWAY: ColorwayDraft = { id: "", nameEn: "", nameEs: "", hex: "#000000", borderHex: "#000000" };

/** A uid not yet used in `colorways` (client-only list key). */
function nextUid(colorways: ColorwayDraft[]): string {
  const used = new Set(colorways.map((c) => c.uid));
  let n = colorways.length;
  while (used.has(`c${n}`)) n++;
  return `c${n}`;
}

/** Give every colorway a list key; used when a form is seeded. */
export function withColorwayUids(form: ProductFormState): ProductFormState {
  const colorways: ColorwayDraft[] = [];
  for (const c of form.colorways) colorways.push(c.uid ? c : { ...c, uid: nextUid([...form.colorways, ...colorways]) });
  return { ...form, colorways };
}

export function addColorway(form: ProductFormState): ProductFormState {
  return { ...form, colorways: [...form.colorways, { ...BLANK_COLORWAY, uid: nextUid(form.colorways) }] };
}

/**
 * A saved colorway's id is fixed: SKUs and images hang off it. A new colorway
 * that repeats a saved id further down the list stays editable so it can be fixed.
 */
export function isColorwayLocked(colorways: ColorwayDraft[], index: number, savedIds: ReadonlySet<string>): boolean {
  const id = colorways[index]?.id;
  if (id === undefined || !savedIds.has(id)) return false;
  return colorways.findIndex((c) => c.id === id) === index;
}

/** Apply edits to one colorway. A new colorway's id follows its English name until edited by hand. */
export function updateColorway(
  form: ProductFormState,
  index: number,
  changes: Partial<ColorwayDraft>,
  savedIds: ReadonlySet<string>
): ProductFormState {
  const current = form.colorways[index];
  if (!current) return form;
  const locked = isColorwayLocked(form.colorways, index, savedIds);
  const next: ColorwayDraft = { ...current, ...changes, id: locked ? current.id : (changes.id ?? current.id) };
  const followsName = current.id === "" || current.id === suggestVariantId(current.nameEn);
  if (!locked && changes.id === undefined && changes.nameEn !== undefined && followsName) {
    next.id = suggestVariantId(changes.nameEn);
  }
  return { ...form, colorways: form.colorways.map((c, i) => (i === index ? next : c)) };
}

export function removeColorway(form: ProductFormState, index: number): ProductFormState {
  const removed = form.colorways[index];
  if (!removed) return form;
  return {
    ...form,
    colorways: form.colorways.filter((_, i) => i !== index),
    defaultColorway: form.defaultColorway === removed.id ? undefined : form.defaultColorway,
  };
}

/** Toggle a size chip; the list keeps the `ALLOWED_SIZES` order. */
export function toggleSize(form: ProductFormState, size: string): ProductFormState {
  if (!(ALLOWED_SIZES as readonly string[]).includes(size)) return form;
  const selected = new Set(form.sizes);
  if (selected.has(size)) selected.delete(size);
  else selected.add(size);
  return { ...form, sizes: ALLOWED_SIZES.filter((s) => selected.has(s)) };
}

/** `<input type="color">` only takes `#rrggbb`. */
export function colorInputValue(hex: string): string {
  if (/^#[0-9a-fA-F]{6}$/.test(hex)) return hex.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(hex)) {
    return `#${hex.slice(1).split("").map((ch) => ch + ch).join("")}`.toLowerCase();
  }
  return "#000000";
}
