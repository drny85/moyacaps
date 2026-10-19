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
