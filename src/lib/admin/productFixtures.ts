import type { AdminProduct } from "./productSearch";

/** Test rows for the admin list helpers: only the fields they read. */
export function capRow(overrides: Partial<AdminProduct> = {}): AdminProduct {
  return {
    variantId: "negro-rojo",
    nameEn: "Black Red",
    nameEs: "Negro Rojo",
    category: "headwear",
    silhouette: "snapback",
    image: "/caps/negro-rojo.png",
    catalogShot: "/shots/negro-rojo.jpg",
    angles: { front: "f", left: "l", back: "b", right: "r" },
    stock: 12,
    priceUsd: 45,
    isAvailable: true,
    isFeatured: false,
    subscribersCount: 0,
    skus: [],
    ...overrides,
  };
}

export function teeRow(overrides: Partial<AdminProduct> = {}): AdminProduct {
  return {
    variantId: "gothic-skull-tee",
    nameEn: "Gothic Skull Tee",
    nameEs: "Playera Calavera Gótica",
    category: "apparel",
    silhouette: "tee",
    image: "",
    defaultColorway: "black",
    colorways: [
      { id: "black", nameEn: "Vintage Washed Black", nameEs: "Negro Deslavado", catalogShot: "/t/black.jpg" },
      { id: "white", nameEn: "Crisp White", nameEs: "Blanco", catalogShot: "/t/white.jpg" },
    ],
    stock: 5,
    priceUsd: 60,
    isAvailable: true,
    isFeatured: false,
    subscribersCount: 0,
    skus: [
      { colorway: "black", size: "M", stock: 2 },
      { colorway: "white", size: "M", stock: 3 },
    ],
    ...overrides,
  };
}
