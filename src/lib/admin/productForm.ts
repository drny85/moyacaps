import type { FunctionArgs, FunctionReturnType } from "convex/server";
import type { api } from "../../../convex/_generated/api";
import {
  ALLOWED_SIZES,
  DEFAULT_TAX_CODE,
  SILHOUETTES_BY_CATEGORY,
  normalizeSlug,
  validateProductFields,
  validateTeeOptions,
} from "../../../convex/catalog/rules";
import type { Category, FieldError, TeeColorwayInput } from "../../../convex/catalog/rules";

/**
 * Pure model behind the admin product editor. Text inputs hold strings; the
 * conversions to the mutation args live here so the UI stays a thin shell.
 * Images and `printPosition` are not form fields: images belong to the image
 * panel, `printPosition` is data-owned.
 */

export type CreateVariantArgs = FunctionArgs<typeof api.catalog.admin.createVariant>;
export type UpdatePatch = FunctionArgs<typeof api.catalog.admin.updateVariant>["patch"];
export type ResolvedVariant = FunctionReturnType<typeof api.catalog.admin.getAllProductsAdmin>["variants"][number];

/** `uid` is a client-only key for list rendering; it is never sent to the server. */
export type ColorwayDraft = TeeColorwayInput & { uid?: string };

function toColorwayInputs(colorways: ColorwayDraft[]): TeeColorwayInput[] {
  return colorways.map(({ id, nameEn, nameEs, hex, borderHex }) => ({ id, nameEn, nameEs, hex, borderHex }));
}

export type ProductFormState = {
  variantId: string;
  nameEn: string;
  nameEs: string;
  category: Category;
  silhouette: string;
  primaryHex: string;
  secondaryHex: string;
  priceUsd: string;
  stock: string;
  taxCode: string;
  descriptionEn: string;
  descriptionEs: string;
  badgeTextEn: string;
  badgeTextEs: string;
  isFeatured: boolean;
  isAvailable: boolean;
  fabricEn: string;
  fabricEs: string;
  fitEn: string;
  fitEs: string;
  sizes: string[];
  defaultColorway?: string;
  colorways: ColorwayDraft[];
};

const DEFAULT_TEE_SIZES: readonly string[] = ["S", "M", "L", "XL", "2XL"].filter((s) =>
  (ALLOWED_SIZES as readonly string[]).includes(s)
);

const TEXT_FIELDS = ["descriptionEn", "descriptionEs", "badgeTextEn", "badgeTextEs"] as const;
const TEE_TEXT_FIELDS = ["fabricEn", "fabricEs", "fitEn", "fitEs"] as const;

export function emptyForm(category: Category): ProductFormState {
  return {
    variantId: "",
    nameEn: "",
    nameEs: "",
    category,
    silhouette: SILHOUETTES_BY_CATEGORY[category][0],
    primaryHex: "#000000",
    secondaryHex: "#ffffff",
    priceUsd: "",
    stock: "0",
    taxCode: DEFAULT_TAX_CODE[category],
    descriptionEn: "",
    descriptionEs: "",
    badgeTextEn: "",
    badgeTextEs: "",
    isFeatured: false,
    // Hidden until the Administrator adds a Catalog Shot and publishes: a visible Product needs an image.
    isAvailable: false,
    fabricEn: "",
    fabricEs: "",
    fitEn: "",
    fitEs: "",
    sizes: category === "apparel" ? [...DEFAULT_TEE_SIZES] : [],
    colorways: [],
  };
}

/** Same fallback the server uses for rows saved before `category` existed. */
export function categoryOf(v: Pick<ResolvedVariant, "category" | "silhouette">): Category {
  if (v.category === "apparel" || v.category === "headwear") return v.category;
  return v.silhouette === "tee" ? "apparel" : "headwear";
}

export function formFromVariant(v: ResolvedVariant): ProductFormState {
  const category = categoryOf(v);
  return {
    variantId: v.variantId,
    nameEn: v.nameEn,
    nameEs: v.nameEs,
    category,
    silhouette: v.silhouette,
    primaryHex: v.primaryHex,
    secondaryHex: v.secondaryHex,
    priceUsd: String(v.priceUsd),
    stock: String(v.stock),
    taxCode: v.taxCode ?? DEFAULT_TAX_CODE[category],
    descriptionEn: v.descriptionEn ?? "",
    descriptionEs: v.descriptionEs ?? "",
    badgeTextEn: v.badgeTextEn ?? "",
    badgeTextEs: v.badgeTextEs ?? "",
    isFeatured: v.isFeatured,
    isAvailable: v.isAvailable,
    fabricEn: v.fabricEn ?? "",
    fabricEs: v.fabricEs ?? "",
    fitEn: v.fitEn ?? "",
    fitEs: v.fitEs ?? "",
    sizes: [...(v.sizes ?? [])],
    defaultColorway: v.defaultColorway,
    colorways: (v.colorways ?? []).map(({ id, nameEn, nameEs, hex, borderHex }) => ({ id, nameEn, nameEs, hex, borderHex })),
  };
}

/** Switch category, resetting the fields whose valid values depend on it. */
export function withCategory(form: ProductFormState, category: Category): ProductFormState {
  if (form.category === category) return form;
  return {
    ...form,
    category,
    silhouette: SILHOUETTES_BY_CATEGORY[category][0],
    taxCode: form.taxCode === DEFAULT_TAX_CODE[form.category] ? DEFAULT_TAX_CODE[category] : form.taxCode,
    sizes: category === "apparel" && form.sizes.length === 0 ? [...DEFAULT_TEE_SIZES] : form.sizes,
  };
}

/** The default colorway a save will store: the chosen one while it exists, else the first. */
function effectiveDefault(form: ProductFormState): string | undefined {
  const { defaultColorway, colorways } = form;
  if (defaultColorway !== undefined && colorways.some((c) => c.id === defaultColorway)) return defaultColorway;
  return colorways[0]?.id;
}

type Parsed = { value: number } | { error: FieldError["code"] };

function parseNumber(raw: string): Parsed {
  const trimmed = raw.trim();
  if (trimmed === "") return { error: "required" };
  const n = Number(trimmed);
  return Number.isNaN(n) ? { error: "format" } : { value: n };
}

/** Only call on a valid form; an unparseable number would be NaN. */
function numberOf(raw: string): number {
  return Number(raw.trim());
}

export function validateForm(form: ProductFormState): FieldError[] {
  const errors: FieldError[] = [];
  const isTee = form.category === "apparel";
  const price = parseNumber(form.priceUsd);
  const stock = isTee ? undefined : parseNumber(form.stock);

  // An unparseable number gets our error; the rules see a harmless stand-in.
  errors.push(
    ...validateProductFields({
      variantId: form.variantId,
      nameEn: form.nameEn,
      nameEs: form.nameEs,
      category: form.category,
      silhouette: form.silhouette,
      primaryHex: form.primaryHex,
      secondaryHex: form.secondaryHex,
      priceUsd: "value" in price ? price.value : 1,
      stock: stock === undefined ? undefined : "value" in stock ? stock.value : 0,
      taxCode: form.taxCode,
      descriptionEn: form.descriptionEn,
      descriptionEs: form.descriptionEs,
      badgeTextEn: form.badgeTextEn,
      badgeTextEs: form.badgeTextEs,
    })
  );
  if ("error" in price) errors.push({ field: "priceUsd", code: price.error });
  if (stock && "error" in stock) errors.push({ field: "stock", code: stock.error });

  if (isTee) {
    errors.push(
      ...validateTeeOptions({
        colorways: toColorwayInputs(form.colorways),
        sizes: form.sizes,
        defaultColorway: effectiveDefault(form),
        fabricEn: form.fabricEn,
        fabricEs: form.fabricEs,
        fitEn: form.fitEn,
        fitEs: form.fitEs,
      })
    );
  }
  return errors;
}

/** Slug a typed name into a product id suggestion. */
export function suggestVariantId(name: string): string {
  return normalizeSlug(name);
}

/** The storefront path a slug will get, previewed under the slug field. */
export function storePath(variantId: string): string {
  return `/products/${variantId.trim() === "" ? "…" : variantId}`;
}

const FORM_KEYS = Object.keys(emptyForm("headwear")) as (keyof ProductFormState)[];

/** True when the admin changed anything since `initial`; colorway `uid`s do not count. */
export function isFormDirty(initial: ProductFormState, current: ProductFormState): boolean {
  if (initial.defaultColorway !== current.defaultColorway) return true;
  if (!sameColorways(initial.colorways, current.colorways)) return true;
  if (!sameStrings(initial.sizes, current.sizes)) return true;
  return FORM_KEYS.some((key) => key !== "colorways" && key !== "sizes" && initial[key] !== current[key]);
}

/** Set the English name; a new product's id follows it until the id is edited by hand. */
export function withNameEn(form: ProductFormState, nameEn: string, suggestId: boolean): ProductFormState {
  const followsName = form.variantId === "" || form.variantId === suggestVariantId(form.nameEn);
  return { ...form, nameEn, variantId: suggestId && followsName ? suggestVariantId(nameEn) : form.variantId };
}

/** Create args for a valid form. Empty optional text is omitted; a tee's stock is the server's. */
export function formToCreateArgs(form: ProductFormState): CreateVariantArgs {
  const args: CreateVariantArgs = {
    variantId: form.variantId,
    nameEn: form.nameEn,
    nameEs: form.nameEs,
    category: form.category,
    silhouette: form.silhouette,
    primaryHex: form.primaryHex,
    secondaryHex: form.secondaryHex,
    priceUsd: numberOf(form.priceUsd),
    taxCode: form.taxCode,
    isFeatured: form.isFeatured,
    isAvailable: form.isAvailable,
  };
  for (const field of TEXT_FIELDS) {
    if (form[field] !== "") args[field] = form[field];
  }
  if (form.category === "apparel") {
    args.colorways = toColorwayInputs(form.colorways);
    args.sizes = form.sizes;
    args.defaultColorway = effectiveDefault(form);
    for (const field of TEE_TEXT_FIELDS) {
      if (form[field] !== "") args[field] = form[field];
    }
  } else {
    args.stock = numberOf(form.stock);
  }
  return args;
}

function sameStrings(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

function sameColorways(a: ColorwayDraft[], b: ColorwayDraft[]): boolean {
  return (
    a.length === b.length &&
    a.every(
      (c, i) =>
        c.id === b[i].id && c.nameEn === b[i].nameEn && c.nameEs === b[i].nameEs && c.hex === b[i].hex && c.borderHex === b[i].borderHex
    )
  );
}

/**
 * Only the fields that differ from `initial`. Cleared optional text goes as `""`
 * so it can be removed. Only call on a valid form.
 */
export function formToPatch(initial: ProductFormState, current: ProductFormState): UpdatePatch {
  const patch: UpdatePatch = {};

  for (const field of ["nameEn", "nameEs", "category", "silhouette", "primaryHex", "secondaryHex", "taxCode", ...TEXT_FIELDS] as const) {
    if (current[field] !== initial[field]) Object.assign(patch, { [field]: current[field] });
  }
  for (const field of ["isFeatured", "isAvailable"] as const) {
    if (current[field] !== initial[field]) patch[field] = current[field];
  }
  const price = numberOf(current.priceUsd);
  if (price !== numberOf(initial.priceUsd)) patch.priceUsd = price;

  if (current.category === "apparel") {
    if (!sameColorways(initial.colorways, current.colorways)) patch.colorways = toColorwayInputs(current.colorways);
    if (!sameStrings(initial.sizes, current.sizes)) patch.sizes = current.sizes;
    const nextDefault = effectiveDefault(current);
    if (nextDefault !== undefined && nextDefault !== effectiveDefault(initial)) patch.defaultColorway = nextDefault;
    for (const field of TEE_TEXT_FIELDS) {
      if (current[field] !== initial[field]) patch[field] = current[field];
    }
  } else {
    const stock = numberOf(current.stock);
    if (stock !== numberOf(initial.stock)) patch.stock = stock;
  }
  return patch;
}
