import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getVariants = query({
  args: {
    silhouette: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let variants = await ctx.db.query("variants").collect();
    if (args.silhouette && args.silhouette !== "all") {
      variants = variants.filter((v) => v.silhouette === args.silhouette);
    }
    return variants;
  },
});

export const getVariantById = query({
  args: {
    variantId: v.string(),
  },
  handler: async (ctx, args) => {
    const variant = await ctx.db
      .query("variants")
      .filter((q) => q.eq(q.field("variantId"), args.variantId))
      .first();
    return variant;
  },
});

export const seedAll = mutation({
  args: {},
  handler: async (ctx) => {
    // Clear existing
    const existingProducts = await ctx.db.query("products").collect();
    for (const p of existingProducts) {
      await ctx.db.delete(p._id);
    }
    const existing = await ctx.db.query("variants").collect();
    for (const item of existing) {
      await ctx.db.delete(item._id);
    }

    // Insert Product
    await ctx.db.insert("products", {
      nameEn: "0880 Good Luck Signature Edition",
      nameEs: "0880 Good Luck Edición Insignia",
      slug: "0880-good-luck",
      collection: "0880 Mythos",
      basePriceUsd: 120,
      featured: true,
    });

    // 16 Variants
    const variants = [
      {
        variantId: "negro-rojo",
        nameEn: "Black / Red Signature",
        nameEs: "Negro / Rojo Insignia",
        silhouette: "snapback",
        primaryHex: "#111111",
        secondaryHex: "#ef4444",
        image: "/caps/negro-rojo.png",
        stock: 12,
        priceUsd: 120,
        isFeatured: true,
      },
      {
        variantId: "blanco-rojo",
        nameEn: "White / Red Clean",
        nameEs: "Blanco / Rojo",
        silhouette: "snapback",
        primaryHex: "#f8fafc",
        secondaryHex: "#ef4444",
        image: "/caps/blanco-rojo.png",
        stock: 8,
        priceUsd: 120,
        isFeatured: false,
      },
      {
        variantId: "azul-marino-rojo",
        nameEn: "Navy / Red Classic",
        nameEs: "Azul Marino / Rojo",
        silhouette: "snapback",
        primaryHex: "#1e293b",
        secondaryHex: "#ef4444",
        image: "/caps/azul-marino-rojo.png",
        stock: 15,
        priceUsd: 120,
        isFeatured: false,
      },
      {
        variantId: "rojo-negro",
        nameEn: "Red / Black Devil Flare",
        nameEs: "Rojo / Negro",
        silhouette: "snapback",
        primaryHex: "#dc2626",
        secondaryHex: "#111111",
        image: "/caps/rojo-negro.png",
        stock: 6,
        priceUsd: 120,
        isFeatured: false,
      },
      {
        variantId: "verde-rojo",
        nameEn: "Forest Green / Red Shamrock",
        nameEs: "Verde Bosque / Rojo",
        silhouette: "snapback",
        primaryHex: "#14532d",
        secondaryHex: "#ef4444",
        image: "/caps/verde-rojo.png",
        stock: 14,
        priceUsd: 120,
        isFeatured: false,
      },
      {
        variantId: "gris-rojo",
        nameEn: "Heather Grey / Red",
        nameEs: "Gris Jaspe / Rojo",
        silhouette: "snapback",
        primaryHex: "#6b7280",
        secondaryHex: "#ef4444",
        image: "/caps/gris-rojo.png",
        stock: 10,
        priceUsd: 120,
        isFeatured: false,
      },
      {
        variantId: "beige-rojo",
        nameEn: "Sand Beige / Red",
        nameEs: "Beige Arena / Rojo",
        silhouette: "snapback",
        primaryHex: "#d6c7a1",
        secondaryHex: "#ef4444",
        image: "/caps/beige-rojo.png",
        stock: 9,
        priceUsd: 120,
        isFeatured: false,
      },
      {
        variantId: "marron-rojo",
        nameEn: "Chocolate Brown / Red",
        nameEs: "Marrón Chocolate / Rojo",
        silhouette: "snapback",
        primaryHex: "#451a03",
        secondaryHex: "#ef4444",
        image: "/caps/marron-rojo.png",
        stock: 7,
        priceUsd: 120,
        isFeatured: false,
      },
      {
        variantId: "azul-rey-blanco",
        nameEn: "Royal Blue / White Crisp",
        nameEs: "Azul Rey / Blanco",
        silhouette: "snapback",
        primaryHex: "#1d4ed8",
        secondaryHex: "#ffffff",
        image: "/caps/azul-rey-blanco.png",
        stock: 11,
        priceUsd: 120,
        isFeatured: false,
      },
      {
        variantId: "rosa-blanco",
        nameEn: "Pastel Pink / White",
        nameEs: "Rosa Pastel / Blanco",
        silhouette: "snapback",
        primaryHex: "#f472b6",
        secondaryHex: "#ffffff",
        image: "/caps/rosa-blanco.png",
        stock: 8,
        priceUsd: 120,
        isFeatured: false,
      },
      {
        variantId: "morado-blanco",
        nameEn: "Imperial Purple / White",
        nameEs: "Morado Imperial / Blanco",
        silhouette: "snapback",
        primaryHex: "#6b21a8",
        secondaryHex: "#ffffff",
        image: "/caps/morado-blanco.png",
        stock: 5,
        priceUsd: 120,
        isFeatured: false,
      },
      {
        variantId: "turquesa-blanco",
        nameEn: "Cyan Turquoise / White",
        nameEs: "Turquesa / Blanco",
        silhouette: "snapback",
        primaryHex: "#06b6d4",
        secondaryHex: "#ffffff",
        image: "/caps/turquesa-blanco.png",
        stock: 12,
        priceUsd: 120,
        isFeatured: false,
      },
      {
        variantId: "camuflaje-negro",
        nameEn: "Woodland Camo / Black",
        nameEs: "Camuflaje Bosque / Negro",
        silhouette: "snapback",
        primaryHex: "#3f4733",
        secondaryHex: "#111111",
        image: "/caps/camuflaje-negro.png",
        stock: 18,
        priceUsd: 125,
        isFeatured: false,
      },
      {
        variantId: "gris-negro-trucker",
        nameEn: "Heather Grey / Mesh Trucker",
        nameEs: "Gris / Negro (Malla Trucker)",
        silhouette: "trucker",
        primaryHex: "#4b5563",
        secondaryHex: "#111111",
        image: "/caps/gris-negro-trucker.png",
        stock: 14,
        priceUsd: 120,
        isFeatured: false,
      },
      {
        variantId: "blanco-negro-trucker",
        nameEn: "Two-Tone White / Black Trucker",
        nameEs: "Blanco / Negro (Malla Trucker)",
        silhouette: "trucker",
        primaryHex: "#f8fafc",
        secondaryHex: "#111111",
        image: "/caps/blanco-negro-trucker.png",
        stock: 13,
        priceUsd: 120,
        isFeatured: false,
      },
      {
        variantId: "camuflaje-gris-negro",
        nameEn: "Urban Camo Shadow / Black",
        nameEs: "Camuflaje Urbano Gris / Negro",
        silhouette: "snapback",
        primaryHex: "#374151",
        secondaryHex: "#111111",
        image: "/caps/camuflaje-gris-negro.png",
        stock: 9,
        priceUsd: 125,
        isFeatured: false,
      },
    ];

    for (const v of variants) {
      await ctx.db.insert("variants", v);
    }

    return { success: true, count: variants.length };
  },
});
