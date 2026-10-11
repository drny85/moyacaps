/**
 * Contract between the 3D scenes and the cap model asset.
 *
 * The production model is a GLB at NEXT_PUBLIC_CAP_MODEL_URL
 * (e.g. `/models/cap-0880.glb`, meshopt + KTX2/WebP compressed, ≤ 1.5 MB).
 * It must expose one node per part, named exactly as in CAP_PARTS, so the
 * scenes can tint each part to the colorway and pull parts apart for the
 * exploded view. Until that asset lands, development renders a procedural
 * stand-in with the same node names; production shows the photo poster.
 */

export const CAP_MODEL_URL = process.env.NEXT_PUBLIC_CAP_MODEL_URL || "";

export type CapModelSource = "gltf" | "standin" | "none";

export function getCapModelSource(): CapModelSource {
  if (CAP_MODEL_URL) return "gltf";
  return process.env.NODE_ENV === "production" ? "none" : "standin";
}

export const CAP_PARTS = [
  "Crown",
  "Visor",
  "Undervisor",
  "Button",
  "Strap",
  "Embroidery_Front",
  "Embroidery_Left",
  "Embroidery_Right",
  "Embroidery_Back",
] as const;

export type CapPart = (typeof CAP_PARTS)[number];

/** Which colorway hex drives each part's material */
export const PART_ROLE: Record<CapPart, "primary" | "underside" | "accent"> = {
  Crown: "primary",
  Visor: "primary",
  Undervisor: "underside",
  Button: "primary",
  Strap: "primary",
  Embroidery_Front: "accent",
  Embroidery_Left: "accent",
  Embroidery_Right: "accent",
  Embroidery_Back: "accent",
};

/**
 * Exploded-view offset per part at explode = 1, in the model's normalized
 * space (crown radius ≈ 1, front of the cap facing +Z).
 */
export const EXPLODE_OFFSET: Record<CapPart, [number, number, number]> = {
  Crown: [0, 0, 0],
  Visor: [0, -0.15, 0.7],
  Undervisor: [0, -0.45, 0.85],
  Button: [0, 0.65, 0],
  Strap: [0, -0.1, -0.75],
  Embroidery_Front: [0, 0.15, 0.6],
  Embroidery_Left: [-0.65, 0.05, 0],
  Embroidery_Right: [0.65, 0.05, 0],
  Embroidery_Back: [0, 0.2, -0.6],
};
