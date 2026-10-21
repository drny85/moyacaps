import {
  PRODUCT_LIMITS,
  SILHOUETTES_BY_CATEGORY,
  TEE_LIMITS,
  normalizeSlug,
  type Category,
  type TeeColorwayInput,
} from "../../../../convex/catalog/rules";
import { emptyForm, suggestVariantId, withCategory, type ProductFormState } from "../productForm";
import type { AutofillCatalogContext } from "./context";
import type { AutofillProposal } from "./schema";

/**
 * Merges a Photo Autofill proposal into the product form (CONTEXT.md "Photo Autofill").
 * Only empty fields are filled; every value is cleaned to pass the form's format rules.
 */

export type AutofillField =
  | "category"
  | "silhouette"
  | "primaryHex"
  | "secondaryHex"
  | "nameEn"
  | "nameEs"
  | "variantId"
  | "descriptionEn"
  | "descriptionEs"
  | "colorways"
  | "fabricEn"
  | "fabricEs"
  | "fitEn"
  | "fitEs";

export type AutofillFilled = Partial<Pick<ProductFormState, AutofillField>>;

export type AutofillOutcome =
  | { kind: "unrecognized"; note: string }
  | {
      kind: "applied";
      form: ProductFormState;
      filled: AutofillFilled;
      note: string;
      /** The category the photos show when it differs from one the Administrator chose. */
      categoryConflict: Category | null;
    };

const SLUG_MIN = 3;

function categoryFor(recognized: "cap" | "tee"): Category {
  return recognized === "tee" ? "apparel" : "headwear";
}

/** "#rrggbb" in lowercase, expanding "#rgb"; null for anything else. */
function normalizeHex(raw: string): string | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(raw.trim());
  if (!m) return null;
  const hex = m[1].toLowerCase();
  return `#${hex.length === 3 ? [...hex].map((c) => c + c).join("") : hex}`;
}

function clip(raw: string, max: number): string {
  return raw.trim().slice(0, max).trim();
}

/** `normalizeSlug` plus accent folding and dropping characters a slug cannot hold. */
function slugify(raw: string): string {
  return normalizeSlug(raw.normalize("NFD").replace(/[\u0300-\u036f]/g, ""))
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function trimSlug(slug: string, max: number): string {
  return slug.slice(0, max).replace(/-+$/, "");
}

/** The proposal's slug, or one from the name, made free by a numeric suffix. Empty when unusable. */
function freeSlug(proposed: string, nameEn: string, taken: readonly string[]): string {
  const base = trimSlug(slugify(proposed) || slugify(suggestVariantId(nameEn)), PRODUCT_LIMITS.slug);
  if (base.length < SLUG_MIN) return "";
  const used = new Set(taken);
  if (!used.has(base)) return base;
  for (let n = 2; ; n++) {
    const suffix = `-${n}`;
    const candidate = `${trimSlug(base, PRODUCT_LIMITS.slug - suffix.length)}${suffix}`;
    if (!used.has(candidate)) return candidate;
  }
}

function mergeColorways(proposed: AutofillProposal["colorways"], stored: readonly TeeColorwayInput[]): TeeColorwayInput[] {
  const byId = new Map(stored.map((c) => [c.id, c]));
  const out: TeeColorwayInput[] = [];
  for (const c of proposed) {
    const id = trimSlug(slugify(c.id), TEE_LIMITS.colorwayId);
    if (out.some((o) => o.id === id)) continue;
    const known = byId.get(id);
    if (known) {
      out.push(known);
      continue;
    }
    const hex = normalizeHex(c.hex);
    const nameEn = clip(c.nameEn, TEE_LIMITS.colorwayName);
    const nameEs = clip(c.nameEs, TEE_LIMITS.colorwayName);
    if (id.length < 2 || !hex || !nameEn || !nameEs) continue;
    out.push({ id, nameEn, nameEs, hex, borderHex: normalizeHex(c.borderHex) ?? hex });
  }
  return out;
}

export function applyAutofill(
  current: ProductFormState,
  proposal: AutofillProposal,
  ctx: AutofillCatalogContext,
  categoryTouched: boolean
): AutofillOutcome {
  if (proposal.recognized === "other") return { kind: "unrecognized", note: proposal.note };

  const filled: AutofillFilled = {};
  let form = current;
  const detected = categoryFor(proposal.recognized);
  let categoryConflict: Category | null = null;
  if (form.category !== detected) {
    if (categoryTouched) categoryConflict = detected;
    else {
      form = withCategory(form, detected);
      filled.category = detected;
    }
  }

  const blank = emptyForm(form.category);
  const set = <K extends AutofillField>(field: K, value: ProductFormState[K] | null | "") => {
    if (value === null || value === "") return;
    form = { ...form, [field]: value };
    filled[field] = value as AutofillFilled[K];
  };

  if (form.silhouette === blank.silhouette && SILHOUETTES_BY_CATEGORY[form.category].includes(proposal.silhouette)) {
    set("silhouette", proposal.silhouette);
  }
  if (form.primaryHex === blank.primaryHex) set("primaryHex", normalizeHex(proposal.primaryHex));
  if (form.secondaryHex === blank.secondaryHex) set("secondaryHex", normalizeHex(proposal.secondaryHex));

  for (const field of ["nameEn", "nameEs"] as const) {
    if (form[field].trim() === "") set(field, clip(proposal[field], PRODUCT_LIMITS.name));
  }
  for (const field of ["descriptionEn", "descriptionEs"] as const) {
    if (form[field].trim() === "") set(field, clip(proposal[field], PRODUCT_LIMITS.description));
  }
  if (form.variantId.trim() === "") set("variantId", freeSlug(proposal.slug, form.nameEn, ctx.takenSlugs));

  if (form.category === "apparel") {
    if (form.colorways.length === 0) {
      const colorways = mergeColorways(proposal.colorways, ctx.colorways);
      if (colorways.length > 0) set("colorways", colorways);
    }
    for (const field of ["fabricEn", "fabricEs", "fitEn", "fitEs"] as const) {
      if (form[field].trim() === "") set(field, clip(proposal[field], TEE_LIMITS.copy));
    }
  }

  return { kind: "applied", form, filled, note: proposal.note.trim(), categoryConflict };
}

function sameValue(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    const strip = (list: unknown[]) =>
      JSON.stringify((list as TeeColorwayInput[]).map(({ id, nameEn, nameEs, hex, borderHex }) => ({ id, nameEn, nameEs, hex, borderHex })));
    return strip(a) === strip(b);
  }
  return a === b;
}

/** Fields still showing the AI marker: the form value still equals the value autofill put there. */
export function aiFilledFields(form: ProductFormState, filled: AutofillFilled): AutofillField[] {
  return (Object.keys(filled) as AutofillField[]).filter((field) => sameValue(form[field], filled[field]));
}
