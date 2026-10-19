import { describe, expect, it } from "vitest";
import type { ApparelColorwayOption, CapVariant } from "../../data/caps";
import { buildSearchIndex, featuredProducts, queryWords, searchProducts, suggestNames } from "./searchProducts";

const NOW = 1_800_000_000_000;

const cap = (over: Partial<CapVariant>): CapVariant => ({
  id: "cap",
  nameEn: "Cap",
  nameEs: "Gorra",
  silhouette: "snapback",
  category: "headwear",
  primaryHex: "#18181b",
  secondaryHex: "#ffffff",
  image: "/caps/x.png",
  catalogShot: "/caps/x-shot.jpg",
  stock: 10,
  priceUsd: 45,
  ...over,
});

const colorway = (id: ApparelColorwayOption["id"], nameEn: string, nameEs: string, hex: string): ApparelColorwayOption => ({
  id,
  nameEn,
  nameEs,
  hex,
  borderHex: hex,
  modelImage: `/shirts/${id}.jpg`,
  catalogShot: `/shirts/${id}-shot.jpg`,
});

const tee = (over: Partial<CapVariant>): CapVariant =>
  cap({
    silhouette: "tee",
    category: "apparel",
    priceUsd: 55,
    defaultColorway: "washed-black",
    colorways: [
      colorway("washed-black", "Vintage Washed Black", "Negro Lavado", "#18181b"),
      colorway("crisp-white", "Crisp Optical White", "Blanco Puro", "#fafafa"),
      colorway("butter-cream", "Butter Cream Vintage", "Crema Vintage", "#fefce8"),
    ],
    ...over,
  });

const CATALOG: CapVariant[] = [
  cap({ id: "red-snap", nameEn: "Good Luck Crimson Snapback", nameEs: "Gorra Carmesí Good Luck", primaryHex: "#dc2626" }),
  cap({ id: "black-trucker", nameEn: "Good Luck Midnight Trucker", nameEs: "Trucker Medianoche Good Luck", silhouette: "trucker" }),
  tee({ id: "gothic-skull", nameEn: "Good Luck Halftone Gothic Skull Tee", nameEs: "Playera Calavera Gótica Good Luck" }),
  tee({ id: "eagle-clover", nameEn: "Good Luck Gothic Eagle & Clover Back-Print Tee", nameEs: "Playera Águila y Trébol Good Luck" }),
  tee({ id: "eight-ball", nameEn: "Good Luck Street 8-Ball Graffiti Tee", nameEs: "Playera Bola 8 Graffiti Good Luck", isFeatured: true }),
];

const index = buildSearchIndex(CATALOG);
const ids = (query: string) => searchProducts(index, query, NOW).map((h) => h.product.id);

describe("searchProducts", () => {
  it("finds a Product by its name", () => {
    expect(ids("gothic skull")[0]).toBe("gothic-skull");
    expect(ids("eagle")).toEqual(["eagle-clover"]);
  });

  it("matches the Spanish name with or without accents", () => {
    expect(ids("calavera")).toEqual(["gothic-skull"]);
    expect(ids("aguila")).toEqual(["eagle-clover"]);
    expect(ids("Águila")).toEqual(["eagle-clover"]);
  });

  it("matches while the Customer is still typing", () => {
    expect(ids("gothic sk")[0]).toBe("gothic-skull");
    expect(ids("eag")).toEqual(["eagle-clover"]);
  });

  it("tolerates typos", () => {
    expect(ids("gotic skul")[0]).toBe("gothic-skull");
    expect(ids("graffitti")).toEqual(["eight-ball"]);
  });

  it("requires every word to match", () => {
    expect(ids("skull eagle")).toEqual([]);
  });

  it("finds by category synonyms in both languages", () => {
    expect(ids("hat").sort()).toEqual(["black-trucker", "red-snap"]);
    expect(ids("gorra").sort()).toEqual(["black-trucker", "red-snap"]);
    expect(ids("shirt")).toHaveLength(3);
    expect(ids("t-shirt")).toHaveLength(3);
  });

  it("finds a Cap by Silhouette and by color word", () => {
    expect(ids("trucker")).toEqual(["black-trucker"]);
    expect(ids("red cap")).toEqual(["red-snap"]);
    expect(ids("gorra roja")).toEqual(["red-snap"]);
  });

  it("opens a tee on the Apparel Colorway the query names", () => {
    const [hit] = searchProducts(index, "skull cream", NOW);
    expect(hit.product.id).toBe("gothic-skull");
    expect(hit.colorway).toBe("butter-cream");
    expect(hit.image).toBe("/shirts/butter-cream-shot.jpg");
  });

  it("shows the default Colorway when none is named", () => {
    const [hit] = searchProducts(index, "skull", NOW);
    expect(hit.colorway).toBeUndefined();
    expect(hit.image).toBe("/shirts/washed-black-shot.jpg");
  });

  it("ranks name matches above vocabulary matches", () => {
    // "gothic" is in two names; a featured Product with no match never sneaks in
    expect(ids("gothic").sort()).toEqual(["eagle-clover", "gothic-skull"]);
  });

  it("breaks ties by the Shop's featured order", () => {
    expect(ids("tee")[0]).toBe("eight-ball");
  });

  it("returns nothing for an empty query and respects the limit", () => {
    expect(ids("   ")).toEqual([]);
    expect(searchProducts(index, "good luck", NOW, 2)).toHaveLength(2);
  });
});

describe("queryWords", () => {
  it("drops stop words unless nothing else is left", () => {
    expect(queryWords("the eagle and clover")).toEqual(["eagle", "clover"]);
    expect(queryWords("the")).toEqual(["the"]);
  });
});

describe("suggestNames", () => {
  it("offers the closest names for a query that found nothing", () => {
    expect(ids("skoal")).toEqual([]);
    expect(suggestNames(index, "skoal").map((h) => h.product.id)).toContain("gothic-skull");
    expect(suggestNames(index, "zzzzzz")).toEqual([]);
  });
});

describe("featuredProducts", () => {
  it("lists featured, purchasable Products first", () => {
    const picks = featuredProducts([...CATALOG, cap({ id: "sold-out", isFeatured: true, stock: 0 })], NOW, 3);
    expect(picks.map((p) => p.product.id)).toEqual(["eight-ball", "sold-out", "red-snap"]);
  });
});
