import { describe, expect, it } from "vitest";
import type { Doc } from "@convex/_generated/dataModel";
import { toCapVariant } from "./toCapVariant";

const row = (over: Partial<Doc<"variants">> = {}): Doc<"variants"> =>
  ({
    _id: "v1",
    _creationTime: 1,
    variantId: "test-cap",
    nameEn: "Test",
    nameEs: "Prueba",
    silhouette: "snapback",
    category: "headwear",
    primaryHex: "#000",
    secondaryHex: "#fff",
    image: "/x.png",
    stock: 1,
    priceUsd: 10,
    ...over,
  }) as Doc<"variants">;

describe("toCapVariant admin fields", () => {
  it("maps description and badge per locale", () => {
    const cap = toCapVariant(
      row({ descriptionEn: "Desc", descriptionEs: "Descripción", badgeTextEn: "New", badgeTextEs: "Nuevo" }),
    );
    expect(cap.descriptionEn).toBe("Desc");
    expect(cap.descriptionEs).toBe("Descripción");
    expect(cap.tagEn).toBe("New");
    expect(cap.tagEs).toBe("Nuevo");
  });

  it("treats an empty or blank badge as no tag", () => {
    const cap = toCapVariant(row({ badgeTextEn: "", badgeTextEs: "  " }));
    expect(cap.tagEn).toBeUndefined();
    expect(cap.tagEs).toBeUndefined();
  });
});

describe("toCapVariant lifestyle shots", () => {
  const colorway = { id: "washed-black", nameEn: "Black", nameEs: "Negro", hex: "#000", borderHex: "#000", lifestyleImage: "/a.jpg", catalogShot: "/c.webp" };

  it("maps every Lifestyle Shot of a colorway", () => {
    const tee = toCapVariant({ ...row({ silhouette: "tee" }), colorways: [{ ...colorway, lifestyleImages: ["/a.jpg", "/b.jpg"] }] });
    expect(tee.colorways?.[0]).toMatchObject({ modelImage: "/a.jpg", modelImages: ["/a.jpg", "/b.jpg"] });
  });

  it("falls back to the single lifestyleImage when the list is absent", () => {
    const tee = toCapVariant(row({ silhouette: "tee", colorways: [colorway] }));
    expect(tee.colorways?.[0].modelImages).toEqual(["/a.jpg"]);
  });
});
