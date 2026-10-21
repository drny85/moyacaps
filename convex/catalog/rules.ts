import { ConvexError } from "convex/values";

// Pure catalog rules shared by Convex mutations and the admin form.
// Import nothing but convex/values so the Next.js client can use it.

export const CATEGORIES = ["headwear", "apparel"] as const;
export type Category = (typeof CATEGORIES)[number];

export const SILHOUETTES_BY_CATEGORY: Record<Category, readonly string[]> = {
  headwear: ["snapback", "trucker"],
  apparel: ["tee"],
};

export const DEFAULT_TAX_CODE: Record<Category, string> = {
  headwear: "txcd_30060006",
  apparel: "txcd_30011000",
};

/** The price a new Product starts at; the Administrator can change it before saving. */
export const DEFAULT_PRICE_USD: Record<Category, number> = {
  headwear: 120,
  apparel: 80,
};

export type FieldError = {
  field: string;
  code: "required" | "format" | "range" | "too_long" | "mismatch" | "taken";
};

export type ProductFieldsInput = {
  variantId?: string;
  nameEn: string;
  nameEs: string;
  category: Category;
  silhouette: string;
  primaryHex: string;
  secondaryHex: string;
  priceUsd: number;
  stock?: number;
  taxCode?: string;
  descriptionEn?: string;
  descriptionEs?: string;
  badgeTextEn?: string;
  badgeTextEs?: string;
};

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const TAX_CODE_RE = /^txcd_\d{8}$/;

const SLUG_MIN = 3;
const SLUG_MAX = 60;
const NAME_MAX = 80;
const DESCRIPTION_MAX = 1000;
const BADGE_MAX = 24;
const PRICE_MAX = 10000;

/** Field limits the admin editor shows as counters; the validators below enforce them. */
export const PRODUCT_LIMITS = { name: NAME_MAX, description: DESCRIPTION_MAX, badge: BADGE_MAX, slug: SLUG_MAX } as const;
/** Largest stock one product or SKU may hold. */
export const STOCK_MAX = 100000;

export function normalizeSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function resolveTaxCode(category: Category, taxCode?: string): string {
  return taxCode ?? DEFAULT_TAX_CODE[category];
}

export function throwIfInvalid(errors: FieldError[]): void {
  if (errors.length > 0) {
    throw new ConvexError({ kind: "validation", errors });
  }
}

function hasAtMostTwoDecimals(n: number): boolean {
  return Math.abs(n * 100 - Math.round(n * 100)) < 1e-6;
}

export function validateProductFields(input: ProductFieldsInput): FieldError[] {
  const errors: FieldError[] = [];
  const add = (field: string, code: FieldError["code"]) =>
    errors.push({ field, code });

  if (input.variantId !== undefined) {
    const id = input.variantId;
    if (
      id.length < SLUG_MIN ||
      id.length > SLUG_MAX ||
      !SLUG_RE.test(id)
    ) {
      add("variantId", "format");
    }
  }

  for (const field of ["nameEn", "nameEs"] as const) {
    const name = input[field].trim();
    if (name.length === 0) add(field, "required");
    else if (name.length > NAME_MAX) add(field, "too_long");
  }

  if (!CATEGORIES.includes(input.category)) {
    add("category", "format");
  } else if (!SILHOUETTES_BY_CATEGORY[input.category].includes(input.silhouette)) {
    add("silhouette", "mismatch");
  }

  for (const field of ["primaryHex", "secondaryHex"] as const) {
    if (!HEX_RE.test(input[field])) add(field, "format");
  }

  const p = input.priceUsd;
  if (!Number.isFinite(p) || p <= 0 || p > PRICE_MAX || !hasAtMostTwoDecimals(p)) {
    add("priceUsd", "range");
  }

  if (input.stock !== undefined) {
    const s = input.stock;
    if (!Number.isInteger(s) || s < 0 || s > STOCK_MAX) add("stock", "range");
  }

  if (input.taxCode !== undefined && !TAX_CODE_RE.test(input.taxCode)) {
    add("taxCode", "format");
  }

  for (const field of ["descriptionEn", "descriptionEs"] as const) {
    const v = input[field];
    if (v !== undefined && v.length > DESCRIPTION_MAX) add(field, "too_long");
  }
  for (const field of ["badgeTextEn", "badgeTextEs"] as const) {
    const v = input[field];
    if (v !== undefined && v.length > BADGE_MAX) add(field, "too_long");
  }

  return errors;
}

export const ALLOWED_SIZES = ["XS", "S", "M", "L", "XL", "2XL", "3XL"] as const;

const COLORWAY_ID_MIN = 2;
const COLORWAY_ID_MAX = 40;
const COLORWAY_NAME_MAX = 40;
const TEE_COPY_MAX = 200;

/** Tee option limits, for clients that clip values before they reach the validators. */
export const TEE_LIMITS = { colorwayId: COLORWAY_ID_MAX, colorwayName: COLORWAY_NAME_MAX, copy: TEE_COPY_MAX } as const;

/** Colorway fields an Administrator edits; the server fills the shot paths. */
export type TeeColorwayInput = { id: string; nameEn: string; nameEs: string; hex: string; borderHex: string };

export type TeeOptionsInput = {
  colorways: TeeColorwayInput[];
  sizes: string[];
  defaultColorway?: string;
  fabricEn?: string;
  fabricEs?: string;
  fitEn?: string;
  fitEs?: string;
};

/** Validate a tee's Apparel Colorways, sizes, default colorway and fabric/fit copy. */
export function validateTeeOptions(input: TeeOptionsInput): FieldError[] {
  const errors: FieldError[] = [];
  const add = (field: string, code: FieldError["code"]) => errors.push({ field, code });

  if (input.colorways.length === 0) add("colorways", "required");
  const seen = new Set<string>();
  input.colorways.forEach((c, i) => {
    const at = `colorways[${i}]`;
    if (c.id.length < COLORWAY_ID_MIN || c.id.length > COLORWAY_ID_MAX || !SLUG_RE.test(c.id)) add(`${at}.id`, "format");
    else if (seen.has(c.id)) add(`${at}.id`, "taken");
    seen.add(c.id);
    for (const field of ["nameEn", "nameEs"] as const) {
      const name = c[field].trim();
      if (name.length === 0) add(`${at}.${field}`, "required");
      else if (name.length > COLORWAY_NAME_MAX) add(`${at}.${field}`, "too_long");
    }
    for (const field of ["hex", "borderHex"] as const) {
      if (!HEX_RE.test(c[field])) add(`${at}.${field}`, "format");
    }
  });

  if (input.sizes.length === 0) add("sizes", "required");
  const sizeSeen = new Set<string>();
  input.sizes.forEach((size, i) => {
    if (!(ALLOWED_SIZES as readonly string[]).includes(size)) add(`sizes[${i}]`, "format");
    else if (sizeSeen.has(size)) add(`sizes[${i}]`, "taken");
    sizeSeen.add(size);
  });

  if (input.defaultColorway !== undefined && !input.colorways.some((c) => c.id === input.defaultColorway)) {
    add("defaultColorway", "mismatch");
  }

  for (const field of ["fabricEn", "fabricEs", "fitEn", "fitEs"] as const) {
    const value = input[field];
    if (value !== undefined && value.length > TEE_COPY_MAX) add(field, "too_long");
  }
  return errors;
}
