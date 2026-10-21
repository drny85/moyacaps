import type { ContextRow } from "./context";

/** Admin rows for the Photo Autofill tests: only the fields the context reads. */
export function row(overrides: Partial<ContextRow> = {}): ContextRow {
  return {
    _creationTime: 1,
    variantId: "black-snap",
    category: "headwear",
    silhouette: "snapback",
    nameEn: "Black Snap",
    nameEs: "Snap Negra",
    descriptionEn: "A black Cap.",
    descriptionEs: "Una gorra negra.",
    ...overrides,
  };
}

export const blackColorway = { id: "vintage-black", nameEn: "Vintage Washed Black", nameEs: "Negro Deslavado", hex: "#1c1c1c", borderHex: "#333333" };
export const whiteColorway = { id: "crisp-white", nameEn: "Crisp White", nameEs: "Blanco Nítido", hex: "#fafafa", borderHex: "#d4d4d4" };

export function teeRow(overrides: Partial<ContextRow> = {}): ContextRow {
  return row({
    variantId: "skull-tee",
    category: "apparel",
    silhouette: "tee",
    nameEn: "Skull Tee",
    nameEs: "Playera Calavera",
    descriptionEn: "A heavyweight skull tee.",
    descriptionEs: "Una playera pesada de calavera.",
    colorways: [
      { ...blackColorway, lifestyleImage: "/l.jpg", catalogShot: "/c.jpg" },
      { ...whiteColorway, lifestyleImage: "/l2.jpg", catalogShot: "/c2.jpg" },
    ],
    ...overrides,
  });
}
