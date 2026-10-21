/**
 * Parcel presets and the default-parcel rule (docs/shipping/usps-supplies-research.md §6).
 *
 * One source of truth for the Convex rates action and the admin ShippingLabelModal.
 * Dimensions are OUTSIDE dimensions (what USPS measures and what Shippo uses for cubic
 * pricing); weights are realistic packed weights (box tare + contents + tissue), not the
 * under-declared figures the store used to send. Pure module: no Convex imports.
 */

export type ParcelCategory = "headwear" | "apparel";

export interface ParcelLine {
  category: ParcelCategory;
  quantity: number;
}

export interface ParcelPreset {
  id: string;
  nameEn: string;
  nameEs: string;
  descriptionEn: string;
  descriptionEs: string;
  /** Outside dimensions in inches. */
  length: number;
  width: number;
  height: number;
  /** Declared packed weight in ounces. */
  weight: number;
  unit: "in";
  massUnit: "oz";
  /** Inclusive [min, max] counts this preset is meant for; the suggestion rule reads these. */
  fits: { caps: [number, number]; tees: [number, number] };
}

export const PARCEL_PRESETS: readonly ParcelPreset[] = [
  {
    id: "one_cap",
    nameEn: "1 Cap Box",
    nameEs: "Caja 1 Gorra",
    descriptionEn: "Rigid 8×8×6 box, crown insert",
    descriptionEs: "Caja rígida 8×8×6 con soporte de copa",
    length: 8.25,
    width: 8.25,
    height: 6.25,
    weight: 12,
    unit: "in",
    massUnit: "oz",
    fits: { caps: [1, 1], tees: [0, 0] },
  },
  {
    id: "two_caps",
    nameEn: "2 Caps Box",
    nameEs: "Caja 2 Gorras",
    descriptionEn: "10×8×6 box, two nested caps",
    descriptionEs: "Caja 10×8×6, dos gorras anidadas",
    length: 10.25,
    width: 8.25,
    height: 6.25,
    weight: 19,
    unit: "in",
    massUnit: "oz",
    fits: { caps: [2, 2], tees: [0, 0] },
  },
  {
    id: "cap_and_tee",
    nameEn: "Cap + Tee Box",
    nameEs: "Caja Gorra + Camiseta",
    descriptionEn: "10×8×6 box, one cap and one tee",
    descriptionEs: "Caja 10×8×6, una gorra y una camiseta",
    length: 10.25,
    width: 8.25,
    height: 6.25,
    weight: 24,
    unit: "in",
    massUnit: "oz",
    fits: { caps: [1, 1], tees: [1, 1] },
  },
  {
    id: "three_plus_caps",
    nameEn: "3+ Caps Master Box",
    nameEs: "Caja Maestra 3+ Gorras",
    descriptionEn: "12×10×8 master carton, 3 to 4 caps or mixed",
    descriptionEs: "Cartón maestro 12×10×8, 3 a 4 gorras o mixto",
    length: 12.25,
    width: 10.25,
    height: 8.25,
    weight: 28,
    unit: "in",
    massUnit: "oz",
    fits: { caps: [3, 4], tees: [0, 2] },
  },
  {
    id: "one_tee_mailer",
    nameEn: "1 Tee Mailer",
    nameEs: "Sobre 1 Camiseta",
    descriptionEn: "Poly mailer, tees only (never caps)",
    descriptionEs: "Sobre de polietileno, solo camisetas (nunca gorras)",
    length: 13,
    width: 10,
    height: 1,
    weight: 13,
    unit: "in",
    massUnit: "oz",
    fits: { caps: [0, 0], tees: [1, 1] },
  },
  {
    id: "two_tees_mailer",
    nameEn: "2 Tees Mailer",
    nameEs: "Sobre 2 Camisetas",
    descriptionEn: "Poly mailer, tees only (never caps)",
    descriptionEs: "Sobre de polietileno, solo camisetas (nunca gorras)",
    length: 15.5,
    width: 12,
    height: 2,
    weight: 26,
    unit: "in",
    massUnit: "oz",
    fits: { caps: [0, 0], tees: [2, 2] },
  },
];

/** The preset used when nothing in the order says otherwise (an empty or unknown order). */
export const FALLBACK_PRESET_ID = "one_cap";
/** The preset used when the order outgrows every fitted preset (4+ mixed, 5+ caps, 3+ tees). */
export const MASTER_PRESET_ID = "three_plus_caps";

export function getParcelPreset(id: string): ParcelPreset | undefined {
  return PARCEL_PRESETS.find((p) => p.id === id);
}

export function presetName(preset: ParcelPreset, locale: string): string {
  return locale.startsWith("es") ? preset.nameEs : preset.nameEn;
}

export function presetDescription(preset: ParcelPreset, locale: string): string {
  return locale.startsWith("es") ? preset.descriptionEs : preset.descriptionEn;
}

/** Caps and tees counted separately; anything that is not apparel ships as a cap. */
export function countParcelLines(lines: readonly ParcelLine[]): { caps: number; tees: number } {
  let caps = 0;
  let tees = 0;
  for (const line of lines) {
    const qty = Math.max(0, Math.floor(line.quantity || 0));
    if (line.category === "apparel") tees += qty;
    else caps += qty;
  }
  return { caps, tees };
}

function within(n: number, [min, max]: [number, number]): boolean {
  return n >= min && n <= max;
}

/**
 * Picks the default preset from what is actually in the order.
 * 1 cap → one_cap; 2 caps → two_caps; 3–4 caps → master; 1 tee → one_tee_mailer;
 * 2 tees → two_tees_mailer; 1 cap + 1 tee → cap_and_tee; anything bigger → master box.
 */
export function suggestParcel(lines: readonly ParcelLine[]): ParcelPreset {
  const { caps, tees } = countParcelLines(lines);
  if (caps === 0 && tees === 0) return getParcelPreset(FALLBACK_PRESET_ID)!;
  const exact = PARCEL_PRESETS.find((p) => within(caps, p.fits.caps) && within(tees, p.fits.tees));
  return exact ?? getParcelPreset(MASTER_PRESET_ID)!;
}

/** The parcel the rates action sends to Shippo for a preset. */
export function presetToParcel(preset: ParcelPreset) {
  return { length: preset.length, width: preset.width, height: preset.height, weight: preset.weight, unit: preset.unit };
}

/** USPS Ground Advantage and Priority include $100; above that the shipment buys cover. */
export const INSURANCE_THRESHOLD_USD = 100;

export function insuranceFor(orderTotal: number): { amount: string; currency: "USD"; content: string } | undefined {
  if (!(orderTotal > INSURANCE_THRESHOLD_USD)) return undefined;
  return { amount: orderTotal.toFixed(2), currency: "USD", content: "Apparel" };
}
