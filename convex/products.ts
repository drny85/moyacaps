import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { isAdmin, requireAdmin } from "./auth";
import { checkStock, getVariant, hasSkus, listSkus, setSkuStock } from "./inventory";
import { SHIRT_VARIANTS } from "../src/data/caps";
import catalogShots from "../src/data/catalogShots.json";

/** Tee stock lives on SKUs; the variant's `stock` is their sum and is never edited directly. */
const TEE_STOCK_EDIT_ERROR = "Tee stock is tracked per colorway and size. Edit it in the SKU stock grid.";

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const generateUploadUrlInternal = internalMutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const setVariantStorageId = internalMutation({
  args: {
    variantId: v.string(),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const variant = await ctx.db
      .query("variants")
      .withIndex("by_variantId", (q) => q.eq("variantId", args.variantId))
      .first();

    if (!variant) {
      throw new Error(`Variant ${args.variantId} not found`);
    }

    if (variant.storageId && variant.storageId !== args.storageId) {
      try {
        await ctx.storage.delete(variant.storageId);
      } catch (e) {
        // ignore if already deleted
      }
    }

    await ctx.db.patch(variant._id, {
      storageId: args.storageId,
    });

    return { success: true, variantId: args.variantId, storageId: args.storageId };
  },
});


async function resolveVariantWithStorageUrl<T extends { storageId?: any; image: string; isAvailable?: boolean }>(
  ctx: { storage: { getUrl: (storageId: any) => Promise<string | null> } },
  variant: T
): Promise<T & { isAvailable: boolean }> {
  let image = variant.image;
  if (variant.storageId) {
    const url = await ctx.storage.getUrl(variant.storageId);
    if (url) {
      image = url;
    }
  }
  return {
    ...variant,
    image,
    isAvailable: variant.isAvailable !== false,
  };
}

export const getVariants = query({
  args: {
    silhouette: v.optional(v.string()),
    // "headwear" | "apparel"; caps seeded before categories existed count as headwear
    category: v.optional(v.string()),
    inStock: v.optional(v.boolean()),
    includeUnavailable: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    let variants = await ctx.db.query("variants").collect();
    if (!args.includeUnavailable) {
      variants = variants.filter((v) => v.isAvailable !== false);
    }
    if (args.silhouette && args.silhouette !== "all") {
      variants = variants.filter((v) => v.silhouette === args.silhouette);
    }
    if (args.category && args.category !== "all") {
      variants = variants.filter((v) => (v.category ?? (v.silhouette === "tee" ? "apparel" : "headwear")) === args.category);
    }
    if (args.inStock) {
      variants = variants.filter((v) => v.stock > 0);
    }
    return await Promise.all(
      variants.map((v) => resolveVariantWithStorageUrl(ctx, v))
    );
  },
});

export const getVariantById = query({
  args: {
    variantId: v.string(),
    allowUnavailable: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const variant = await ctx.db
      .query("variants")
      .withIndex("by_variantId", (q) => q.eq("variantId", args.variantId))
      .first();
    if (!variant) return null;
    // Hidden products are visible to Administrators only; the flag is ignored for everyone else.
    if (variant.isAvailable === false && !(args.allowUnavailable && (await isAdmin(ctx)))) {
      return null;
    }
    return await resolveVariantWithStorageUrl(ctx, variant);
  },
});

export const seedAll = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    // Clear existing
    const existingProducts = await ctx.db.query("products").collect();
    for (const p of existingProducts) {
      await ctx.db.delete(p._id);
    }
    const existing = await ctx.db.query("variants").collect();
    for (const item of existing) {
      if (item.storageId) {
        try {
          await ctx.storage.delete(item.storageId);
        } catch (e) {
          // ignore if already deleted
        }
      }
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
      // ── Heavyweight Streetwear Shirts ($80 USD) ──
      {
        variantId: "boxing-gloves-tee",
        nameEn: "Good Luck Knockout Boxing Gloves Tee",
        nameEs: "Playera Knockout Boxing Gloves Good Luck",
        silhouette: "tee",
        category: "apparel",
        taxCode: "txcd_30011000",
        primaryHex: "#18181b",
        secondaryHex: "#ef4444",
        image: "/shirts/boxing-gloves-black.jpg",
        images: ["/shirts/boxing-gloves-black.jpg", "/shirts/graphics/boxing-gloves.jpg"],
        stock: 18,
        priceUsd: 80,
        isFeatured: true,
      },
      {
        variantId: "butterfly-grunge-tee",
        nameEn: "Good Luck Pink Grunge Butterfly Tee",
        nameEs: "Playera Pink Grunge Butterfly Good Luck",
        silhouette: "tee",
        category: "apparel",
        taxCode: "txcd_30011000",
        primaryHex: "#f5f5f0",
        secondaryHex: "#ec4899",
        image: "/shirts/butterfly-cream.jpg",
        images: ["/shirts/butterfly-cream.jpg", "/shirts/graphics/butterfly.jpg"],
        stock: 15,
        priceUsd: 80,
        isFeatured: true,
      },
      {
        variantId: "eagle-clover-tee",
        nameEn: "Good Luck Gothic Eagle & Clover Back-Print Tee",
        nameEs: "Playera Gothic Eagle & Clover Espalda Good Luck",
        silhouette: "tee",
        category: "apparel",
        taxCode: "txcd_30011000",
        primaryHex: "#27272a",
        secondaryHex: "#f97316",
        image: "/shirts/eagle-clover-black.jpg",
        images: ["/shirts/eagle-clover-black.jpg", "/shirts/eagle-clover-grey.jpg", "/shirts/graphics/eagle-clover.jpg"],
        stock: 22,
        priceUsd: 80,
        isFeatured: true,
      },
      {
        variantId: "gothic-skull-tee",
        nameEn: "Good Luck Halftone Gothic Skull Tee",
        nameEs: "Playera Halftone Gothic Skull Good Luck",
        silhouette: "tee",
        category: "apparel",
        taxCode: "txcd_30011000",
        primaryHex: "#1c1917",
        secondaryHex: "#a855f7",
        image: "/shirts/gothic-skull-black.jpg",
        images: ["/shirts/gothic-skull-black.jpg", "/shirts/graphics/gothic-skull.jpg"],
        stock: 14,
        priceUsd: 80,
        isFeatured: false,
      },
      {
        variantId: "eight-ball-tee",
        nameEn: "Good Luck Street 8-Ball Graffiti Tee",
        nameEs: "Playera Street 8-Ball Graffiti Good Luck",
        silhouette: "tee",
        category: "apparel",
        taxCode: "txcd_30011000",
        primaryHex: "#fafafa",
        secondaryHex: "#3b82f6",
        image: "/shirts/eight-ball-white.jpg",
        images: ["/shirts/eight-ball-white.jpg", "/shirts/graphics/eight-ball.jpg"],
        stock: 16,
        priceUsd: 80,
        isFeatured: true,
      },
      {
        variantId: "snake-horseshoe-tee",
        nameEn: "Good Luck Serpent & Horseshoe Back-Print Tee",
        nameEs: "Playera Serpiente & Herradura Espalda Good Luck",
        silhouette: "tee",
        category: "apparel",
        taxCode: "txcd_30011000",
        primaryHex: "#18181b",
        secondaryHex: "#991b1b",
        image: "/shirts/snake-horseshoe-black.jpg",
        images: ["/shirts/snake-horseshoe-black.jpg", "/shirts/graphics/snake-horseshoe.jpg"],
        stock: 20,
        priceUsd: 80,
        isFeatured: false,
      },
      {
        variantId: "vintage-f1-tee",
        nameEn: "Good Luck Grand Prix Vintage F1 Racer Tee",
        nameEs: "Playera Grand Prix Vintage F1 Racer Good Luck",
        silhouette: "tee",
        category: "apparel",
        taxCode: "txcd_30011000",
        primaryHex: "#fefce8",
        secondaryHex: "#dc2626",
        image: "/shirts/vintage-f1-cream.jpg",
        images: ["/shirts/vintage-f1-cream.jpg", "/shirts/graphics/vintage-f1.jpg"],
        stock: 12,
        priceUsd: 80,
        isFeatured: true,
      },
      {
        variantId: "retro-soul-tee",
        nameEn: "Good Luck 70s Soul Diva Vintage Tee",
        nameEs: "Playera 70s Soul Diva Vintage Good Luck",
        silhouette: "tee",
        category: "apparel",
        taxCode: "txcd_30011000",
        primaryHex: "#18181b",
        secondaryHex: "#eab308",
        image: "/shirts/retro-soul-black.jpg",
        images: ["/shirts/retro-soul-black.jpg", "/shirts/graphics/retro-soul.jpg"],
        stock: 15,
        priceUsd: 80,
        isFeatured: false,
      },
      {
        variantId: "lightning-star-tee",
        nameEn: "Good Luck Lightning Star Electric Tee",
        nameEs: "Playera Lightning Star Electric Good Luck",
        silhouette: "tee",
        category: "apparel",
        taxCode: "txcd_30011000",
        primaryHex: "#9ca3af",
        secondaryHex: "#22c55e",
        image: "/shirts/lightning-star-grey.jpg",
        images: ["/shirts/lightning-star-grey.jpg", "/shirts/graphics/lightning-star.jpg"],
        stock: 16,
        priceUsd: 80,
        isFeatured: false,
      },
      {
        variantId: "gothic-angel-tee",
        nameEn: "Good Luck Marble Angel Statue Tee",
        nameEs: "Playera Estatua Ángel de Mármol Good Luck",
        silhouette: "tee",
        category: "apparel",
        taxCode: "txcd_30011000",
        primaryHex: "#ffffff",
        secondaryHex: "#881337",
        image: "/shirts/angel-clover-white.jpg",
        images: ["/shirts/angel-clover-white.jpg", "/shirts/graphics/angel-clover.jpg"],
        stock: 14,
        priceUsd: 80,
        isFeatured: true,
      },
      {
        variantId: "muscle-car-tee",
        nameEn: "Good Luck Midnight Muscle Car & Roses Tee",
        nameEs: "Playera Midnight Muscle Car & Rosas Good Luck",
        silhouette: "tee",
        category: "apparel",
        taxCode: "txcd_30011000",
        primaryHex: "#18181b",
        secondaryHex: "#dc2626",
        image: "/shirts/muscle-car-black.jpg",
        images: ["/shirts/muscle-car-black.jpg", "/shirts/graphics/muscle-car.jpg"],
        stock: 15,
        priceUsd: 80,
        isFeatured: false,
      },
    ];

    for (const v of variants) {
      await ctx.db.insert("variants", v);
    }

    return { success: true, count: variants.length };
  },
});

export const getAllProductsAdmin = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const products = await ctx.db.query("products").collect();
    const rawVariants = await ctx.db.query("variants").collect();
    const variants = await Promise.all(
      rawVariants.map(async (v) => {
        const resolved = await resolveVariantWithStorageUrl(ctx, v);
        const alerts = await ctx.db
          .query("drop_alerts")
          .withIndex("by_variantId", (q) => q.eq("variantId", v.variantId))
          .collect();
        return {
          ...resolved,
          subscribersCount: alerts.length,
        };
      })
    );
    return {
      products,
      variants,
    };
  },
});

export const updateVariantStock = mutation({
  args: {
    variantId: v.string(),
    stock: v.number(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const variant = await ctx.db
      .query("variants")
      .withIndex("by_variantId", (q) => q.eq("variantId", args.variantId))
      .first();

    if (!variant) {
      throw new Error(`Variant ${args.variantId} not found`);
    }
    if (hasSkus(variant)) {
      throw new ConvexError(TEE_STOCK_EDIT_ERROR);
    }

    await ctx.db.patch(variant._id, {
      stock: Math.max(0, args.stock),
    });

    return { success: true, variantId: args.variantId, stock: Math.max(0, args.stock) };
  },
});

export const adjustVariantStock = mutation({
  args: {
    variantId: v.string(),
    delta: v.number(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const variant = await ctx.db
      .query("variants")
      .withIndex("by_variantId", (q) => q.eq("variantId", args.variantId))
      .first();

    if (!variant) {
      throw new Error(`Variant ${args.variantId} not found`);
    }

    if (hasSkus(variant)) {
      throw new ConvexError(TEE_STOCK_EDIT_ERROR);
    }
    const newStock = Math.max(0, variant.stock + args.delta);
    await ctx.db.patch(variant._id, {
      stock: newStock,
    });

    return { success: true, variantId: args.variantId, stock: newStock };
  },
});

export const updateVariantPrice = mutation({
  args: {
    variantId: v.string(),
    priceUsd: v.number(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const variant = await ctx.db
      .query("variants")
      .withIndex("by_variantId", (q) => q.eq("variantId", args.variantId))
      .first();

    if (!variant) {
      throw new Error(`Variant ${args.variantId} not found`);
    }

    await ctx.db.patch(variant._id, {
      priceUsd: Math.max(0, args.priceUsd),
    });

    return { success: true, variantId: args.variantId, priceUsd: args.priceUsd };
  },
});

export const toggleVariantFeatured = mutation({
  args: {
    variantId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const variant = await ctx.db
      .query("variants")
      .withIndex("by_variantId", (q) => q.eq("variantId", args.variantId))
      .first();

    if (!variant) {
      throw new Error(`Variant ${args.variantId} not found`);
    }

    await ctx.db.patch(variant._id, {
      isFeatured: !variant.isFeatured,
    });

    return { success: true, isFeatured: !variant.isFeatured };
  },
});

export const toggleVariantAvailable = mutation({
  args: {
    variantId: v.string(),
    isAvailable: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const variant = await ctx.db
      .query("variants")
      .withIndex("by_variantId", (q) => q.eq("variantId", args.variantId))
      .first();

    if (!variant) {
      throw new Error(`Variant ${args.variantId} not found`);
    }

    const nextAvailable =
      args.isAvailable !== undefined
        ? args.isAvailable
        : !(variant.isAvailable !== false);

    await ctx.db.patch(variant._id, {
      isAvailable: nextAvailable,
    });

    return { success: true, variantId: args.variantId, isAvailable: nextAvailable };
  },
});

export const saveVariant = mutation({
  args: {
    variantId: v.string(),
    nameEn: v.string(),
    nameEs: v.string(),
    silhouette: v.string(),
    primaryHex: v.string(),
    secondaryHex: v.string(),
    image: v.string(),
    storageId: v.optional(v.id("_storage")),
    images: v.optional(v.array(v.string())),
    stock: v.number(),
    priceUsd: v.number(),
    isFeatured: v.boolean(),
    isAvailable: v.optional(v.boolean()),
    isDrop: v.optional(v.boolean()),
    dropDate: v.optional(v.number()),
    dropBadgeTextEn: v.optional(v.string()),
    dropBadgeTextEs: v.optional(v.string()),
    dropStatus: v.optional(v.union(v.literal("scheduled"), v.literal("live"), v.literal("archived"))),
    category: v.optional(v.string()),
    taxCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    let resolvedImage = args.image;
    if (args.storageId && (!resolvedImage || resolvedImage.trim() === "")) {
      const url = await ctx.storage.getUrl(args.storageId);
      if (url) {
        resolvedImage = url;
      }
    }

    const existing = await ctx.db
      .query("variants")
      .withIndex("by_variantId", (q) => q.eq("variantId", args.variantId))
      .first();

    if (existing) {
      if (existing.storageId && args.storageId && existing.storageId !== args.storageId) {
        try {
          await ctx.storage.delete(existing.storageId);
        } catch (e) {
          // ignore error if file was already removed
        }
      }

      await ctx.db.patch(existing._id, {
        nameEn: args.nameEn,
        nameEs: args.nameEs,
        silhouette: args.silhouette,
        category: args.category !== undefined ? args.category : existing.category,
        taxCode: args.taxCode !== undefined ? args.taxCode : existing.taxCode,
        primaryHex: args.primaryHex,
        secondaryHex: args.secondaryHex,
        image: resolvedImage,
        storageId: args.storageId !== undefined ? args.storageId : existing.storageId,
        images: args.images !== undefined ? args.images : existing.images,
        stock: hasSkus(existing) ? existing.stock : args.stock,
        priceUsd: args.priceUsd,
        isFeatured: args.isFeatured,
        isAvailable: args.isAvailable !== undefined ? args.isAvailable : existing.isAvailable !== false,
        isDrop: args.isDrop !== undefined ? args.isDrop : existing.isDrop,
        dropDate: args.dropDate !== undefined ? args.dropDate : existing.dropDate,
        dropBadgeTextEn: args.dropBadgeTextEn !== undefined ? args.dropBadgeTextEn : existing.dropBadgeTextEn,
        dropBadgeTextEs: args.dropBadgeTextEs !== undefined ? args.dropBadgeTextEs : existing.dropBadgeTextEs,
        dropStatus: args.dropStatus !== undefined ? args.dropStatus : existing.dropStatus,
      });
      return { success: true, action: "updated", id: existing._id };
    }

    const id = await ctx.db.insert("variants", {
      variantId: args.variantId,
      nameEn: args.nameEn,
      nameEs: args.nameEs,
      silhouette: args.silhouette,
      category: args.category,
      taxCode: args.taxCode,
      primaryHex: args.primaryHex,
      secondaryHex: args.secondaryHex,
      image: resolvedImage,
      storageId: args.storageId,
      images: args.images,
      stock: args.stock,
      priceUsd: args.priceUsd,
      isFeatured: args.isFeatured,
      isAvailable: args.isAvailable !== undefined ? args.isAvailable : true,
      isDrop: args.isDrop ?? false,
      dropDate: args.dropDate,
      dropBadgeTextEn: args.dropBadgeTextEn,
      dropBadgeTextEs: args.dropBadgeTextEs,
      dropStatus: args.dropStatus,
    });

    return { success: true, action: "created", id };
  },
});

export const deleteVariant = mutation({
  args: {
    variantId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const variant = await ctx.db
      .query("variants")
      .withIndex("by_variantId", (q) => q.eq("variantId", args.variantId))
      .first();

    if (!variant) {
      throw new Error(`Variant ${args.variantId} not found`);
    }

    if (variant.storageId) {
      try {
        await ctx.storage.delete(variant.storageId);
      } catch (e) {
        // ignore if already deleted
      }
    }

    await ctx.db.delete(variant._id);
    return { success: true };
  },
});

export const getUpcomingDrops = query({
  args: {},
  handler: async (ctx) => {
    const rawVariants = await ctx.db.query("variants").collect();
    const dropVariants = rawVariants.filter(
      (v) =>
        v.isDrop === true &&
        typeof v.dropDate === "number" &&
        v.isAvailable !== false &&
        Date.now() < v.dropDate &&
        v.dropStatus !== "live"
    );

    // Sort by earliest dropDate
    dropVariants.sort((a, b) => (a.dropDate || 0) - (b.dropDate || 0));

    return await Promise.all(
      dropVariants.map(async (v) => {
        const withUrl = await resolveVariantWithStorageUrl(ctx, v);
        const subscribers = await ctx.db
          .query("drop_alerts")
          .withIndex("by_variantId", (q) => q.eq("variantId", v.variantId))
          .collect();

        return {
          ...withUrl,
          subscribersCount: subscribers.length,
        };
      })
    );
  },
});

export const subscribeToDropAlert = mutation({
  args: {
    variantId: v.string(),
    contact: v.string(),
    channel: v.union(v.literal("whatsapp"), v.literal("email")),
    name: v.optional(v.string()),
    clerkUserId: v.optional(v.string()),
    locale: v.union(v.literal("en"), v.literal("es")),
  },
  handler: async (ctx, args) => {
    const cleanContact = args.contact.trim().toLowerCase();
    if (!cleanContact) {
      throw new Error("Contact information is required");
    }

    const variant = await ctx.db
      .query("variants")
      .withIndex("by_variantId", (q) => q.eq("variantId", args.variantId))
      .first();

    if (!variant) {
      throw new Error(`Variant ${args.variantId} not found`);
    }

    // Check duplicate
    const existing = await ctx.db
      .query("drop_alerts")
      .withIndex("by_variant_contact", (q) =>
        q.eq("variantId", args.variantId).eq("contact", cleanContact)
      )
      .first();

    if (existing) {
      return { success: true, alreadySubscribed: true, id: existing._id };
    }

    const id = await ctx.db.insert("drop_alerts", {
      variantId: args.variantId,
      contact: cleanContact,
      channel: args.channel,
      name: args.name?.trim(),
      clerkUserId: args.clerkUserId,
      locale: args.locale,
      createdAt: Date.now(),
    });

    return { success: true, alreadySubscribed: false, id };
  },
});

export const updateVariantDropStatus = mutation({
  args: {
    variantId: v.string(),
    isDrop: v.boolean(),
    dropDate: v.optional(v.number()),
    dropBadgeTextEn: v.optional(v.string()),
    dropBadgeTextEs: v.optional(v.string()),
    dropStatus: v.optional(v.union(v.literal("scheduled"), v.literal("live"), v.literal("archived"))),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const variant = await ctx.db
      .query("variants")
      .withIndex("by_variantId", (q) => q.eq("variantId", args.variantId))
      .first();

    if (!variant) {
      throw new Error(`Variant ${args.variantId} not found`);
    }

    const nextStatus: "scheduled" | "live" | "archived" = args.dropStatus || (args.isDrop ? "scheduled" : "archived");

    await ctx.db.patch(variant._id, {
      isDrop: args.isDrop,
      dropDate: args.isDrop ? (args.dropDate || Date.now() + 86400000 * 2) : undefined,
      dropBadgeTextEn: args.dropBadgeTextEn,
      dropBadgeTextEs: args.dropBadgeTextEs,
      dropStatus: nextStatus,
    });

    return { success: true, variantId: args.variantId, isDrop: args.isDrop, dropStatus: nextStatus };
  },
});

export const scheduleDrop = mutation({
  args: {
    variantId: v.string(),
    dropDate: v.number(),
    dropBadgeTextEn: v.optional(v.string()),
    dropBadgeTextEs: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const variant = await ctx.db
      .query("variants")
      .withIndex("by_variantId", (q) => q.eq("variantId", args.variantId))
      .first();

    if (!variant) {
      throw new Error(`Variant ${args.variantId} not found`);
    }

    await ctx.db.patch(variant._id, {
      isDrop: true,
      dropDate: args.dropDate,
      dropBadgeTextEn: args.dropBadgeTextEn?.trim() || "VIP Exclusive Drop",
      dropBadgeTextEs: args.dropBadgeTextEs?.trim() || "Drop Exclusivo VIP",
      dropStatus: "scheduled",
    });

    return { success: true, variantId: args.variantId, dropDate: args.dropDate, dropStatus: "scheduled" };
  },
});

export const releaseDropNow = mutation({
  args: {
    variantId: v.string(),
    keepBadge: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const variant = await ctx.db
      .query("variants")
      .withIndex("by_variantId", (q) => q.eq("variantId", args.variantId))
      .first();

    if (!variant) {
      throw new Error(`Variant ${args.variantId} not found`);
    }

    await ctx.db.patch(variant._id, {
      dropDate: Date.now() - 1000,
      dropStatus: "live",
      dropBadgeTextEn: args.keepBadge ? variant.dropBadgeTextEn : "Released Drop",
      dropBadgeTextEs: args.keepBadge ? variant.dropBadgeTextEs : "Drop Lanzado",
    });

    return { success: true, variantId: args.variantId, dropStatus: "live" };
  },
});

export const postponeDrop = mutation({
  args: {
    variantId: v.string(),
    newDropDate: v.number(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const variant = await ctx.db
      .query("variants")
      .withIndex("by_variantId", (q) => q.eq("variantId", args.variantId))
      .first();

    if (!variant) {
      throw new Error(`Variant ${args.variantId} not found`);
    }

    await ctx.db.patch(variant._id, {
      dropDate: args.newDropDate,
      dropStatus: "scheduled",
    });

    return { success: true, variantId: args.variantId, dropDate: args.newDropDate };
  },
});

export const cancelDrop = mutation({
  args: {
    variantId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const variant = await ctx.db
      .query("variants")
      .withIndex("by_variantId", (q) => q.eq("variantId", args.variantId))
      .first();

    if (!variant) {
      throw new Error(`Variant ${args.variantId} not found`);
    }

    await ctx.db.patch(variant._id, {
      isDrop: false,
      dropDate: undefined,
      dropBadgeTextEn: undefined,
      dropBadgeTextEs: undefined,
      dropStatus: "archived",
    });

    return { success: true, variantId: args.variantId };
  },
});

export const deleteDrop = mutation({
  args: {
    variantId: v.string(),
    deleteSubscribers: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const variant = await ctx.db
      .query("variants")
      .withIndex("by_variantId", (q) => q.eq("variantId", args.variantId))
      .first();

    if (!variant) {
      throw new Error(`Variant ${args.variantId} not found`);
    }

    // Completely clear all drop attributes from the variant
    await ctx.db.patch(variant._id, {
      isDrop: false,
      dropDate: undefined,
      dropBadgeTextEn: undefined,
      dropBadgeTextEs: undefined,
      dropStatus: undefined,
    });

    // Delete any registered drop alerts/waitlist entries for this variant
    if (args.deleteSubscribers !== false) {
      const alerts = await ctx.db
        .query("drop_alerts")
        .withIndex("by_variantId", (q) => q.eq("variantId", args.variantId))
        .collect();
      for (const alert of alerts) {
        await ctx.db.delete(alert._id);
      }
    }

    return { success: true, variantId: args.variantId };
  },
});


export const getAllDropsAdmin = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rawVariants = await ctx.db.query("variants").collect();
    const dropVariants = rawVariants.filter(
      (v) => v.isDrop === true || v.dropDate !== undefined || v.dropStatus !== undefined
    );

    // Sort by dropDate or variantId
    dropVariants.sort((a, b) => (b.dropDate || 0) - (a.dropDate || 0));

    return await Promise.all(
      dropVariants.map(async (v) => {
        const withUrl = await resolveVariantWithStorageUrl(ctx, v);
        const subscribers = await ctx.db
          .query("drop_alerts")
          .withIndex("by_variantId", (q) => q.eq("variantId", v.variantId))
          .collect();

        const isLive = v.dropStatus === "live" || (typeof v.dropDate === "number" && Date.now() >= v.dropDate && v.isDrop);
        const isScheduled = v.isDrop === true && typeof v.dropDate === "number" && Date.now() < v.dropDate && v.dropStatus !== "live";

        return {
          ...withUrl,
          subscribersCount: subscribers.length,
          computedStatus: isLive ? ("live" as const) : isScheduled ? ("scheduled" as const) : ("archived" as const),
        };
      })
    );
  },
});

export const getDropSubscribers = query({
  args: {
    variantId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    if (args.variantId) {
      return await ctx.db
        .query("drop_alerts")
        .withIndex("by_variantId", (q) => q.eq("variantId", args.variantId!))
        .collect();
    }
    return await ctx.db.query("drop_alerts").collect();
  },
});

export const getDropSubscribersList = query({
  args: {
    variantId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    let alerts;
    if (args.variantId && args.variantId !== "all") {
      alerts = await ctx.db
        .query("drop_alerts")
        .withIndex("by_variantId", (q) => q.eq("variantId", args.variantId!))
        .collect();
    } else {
      alerts = await ctx.db.query("drop_alerts").collect();
    }

    const variants = await ctx.db.query("variants").collect();
    const variantMap = new Map(variants.map((v) => [v.variantId, v]));

    return alerts
      .map((a) => {
        const v = variantMap.get(a.variantId);
        return {
          _id: a._id,
          variantId: a.variantId,
          contact: a.contact,
          channel: a.channel,
          name: a.name,
          locale: a.locale,
          createdAt: a.createdAt,
          notifiedAt: a.notifiedAt,
          variantNameEn: v?.nameEn || a.variantId,
          variantNameEs: v?.nameEs || a.variantId,
          silhouette: v?.silhouette,
          dropDate: v?.dropDate,
          primaryHex: v?.primaryHex,
          image: v?.image,
        };
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  },
});

// ── Unified Product catalog (ADR 0015) ─────────────────────────────────────────

export const TEE_SIZES = ["S", "M", "L", "XL", "2XL"] as const;

/** Old Lifestyle Shot paths (still referenced by historical order snapshots) → canonical names */
const LIFESTYLE_RENAMES: Record<string, string> = {
  "/shirts/gothic-angel-white.jpg": "/shirts/angel-clover-white.jpg",
  "/shirts/eagle-clover-black.png": "/shirts/eagle-clover-black.jpg",
  "/shirts/eagle-clover-grey.png": "/shirts/eagle-clover-grey.jpg",
};
const renamed = (path: string) => LIFESTYLE_RENAMES[path] ?? path;

type CatalogShotsManifest = {
  caps: Record<string, { catalog: string }>;
  tees: Record<string, { colorways: Record<string, string> }>;
};
const SHOTS = catalogShots as CatalogShotsManifest;

/** Per-line stock check for checkout actions: SKU stock for tees, variant stock for caps. */
export const getLineStock = internalQuery({
  args: {
    variantId: v.string(),
    colorway: v.optional(v.string()),
    size: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const check = await checkStock(ctx, { ...args, quantity: 1 });
    return check.ok
      ? { ok: true as const, available: check.available }
      : { ok: false as const, reason: check.reason };
  },
});

/** One Product for its page: the variant (storage image resolved) plus SKU stock for tees. */
export const getProductBySlug = query({
  args: { slug: v.string(), allowUnavailable: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const variant = await getVariant(ctx, args.slug);
    if (!variant) return null;
    // Hidden products (and their SKU stock) are visible to Administrators only.
    if (variant.isAvailable === false && !(args.allowUnavailable && (await isAdmin(ctx)))) return null;
    const resolved = await resolveVariantWithStorageUrl(ctx, variant);
    const skus = hasSkus(variant)
      ? (await listSkus(ctx, variant.variantId)).map((s) => ({ colorway: s.colorway, size: s.size, stock: s.stock }))
      : [];
    return { ...resolved, skus };
  },
});

/** Admin: set one tee SKU's stock; the tee's aggregate stock follows. */
export const setTeeSkuStock = mutation({
  args: {
    variantId: v.string(),
    colorway: v.string(),
    size: v.string(),
    stock: v.number(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const variant = await getVariant(ctx, args.variantId);
    if (!variant) throw new ConvexError(`Variant ${args.variantId} not found`);
    if (!hasSkus(variant)) throw new ConvexError(`${args.variantId} is not a tee with colorways and sizes`);
    if (!variant.colorways!.some((c) => c.id === args.colorway) || !variant.sizes!.includes(args.size)) {
      throw new ConvexError(`${args.colorway} / ${args.size} is not offered for ${args.variantId}`);
    }
    if (!Number.isFinite(args.stock) || args.stock < 0) throw new ConvexError("Stock must be zero or more");
    await setSkuStock(ctx, variant, args.colorway, args.size, args.stock);
    return { success: true };
  },
});

/**
 * Split a tee's current stock across its SKUs: an even share each, remainder to the
 * default colorway first in the most common sizes. The sum is unchanged.
 */
function distributeStock(total: number, colorways: string[], defaultColorway: string) {
  const order = ["L", "M", "XL", "S", "2XL"];
  const cws = [defaultColorway, ...colorways.filter((c) => c !== defaultColorway)];
  const cells = order.flatMap((size) => cws.map((colorway) => ({ colorway, size })));
  const base = Math.floor(total / cells.length);
  let remainder = total - base * cells.length;
  return cells.map((cell) => ({ ...cell, stock: base + (remainder-- > 0 ? 1 : 0) }));
}

/**
 * Idempotent catalog migration (ADR 0015/0016). Run with:
 *   npx convex run products:migrateUnifiedCatalog
 * - Caps: set `catalogShot` from src/data/catalogShots.json.
 * - Tees: fill colorways, sizes, artwork and fit/fabric copy from src/data/caps.ts where the
 *   variant has none (never overwriting existing values), rewrite Lifestyle Shot paths that
 *   still use the old file names, and seed SKUs from the current stock (only when the tee
 *   has no SKUs yet).
 */
export const migrateUnifiedCatalog = internalMutation({
  args: {},
  handler: async (ctx) => {
    const report = { capsUpdated: 0, teesUpdated: 0, teesInserted: 0, skusSeeded: 0 };

    for (const [variantId, shot] of Object.entries(SHOTS.caps)) {
      const variant = await getVariant(ctx, variantId);
      if (variant && variant.catalogShot !== shot.catalog) {
        await ctx.db.patch("variants", variant._id, { catalogShot: shot.catalog });
        report.capsUpdated++;
      }
    }

    for (const tee of SHIRT_VARIANTS) {
      const shots = SHOTS.tees[tee.id]?.colorways ?? {};
      const colorways = (tee.colorways ?? []).map((c) => ({
        id: c.id,
        nameEn: c.nameEn,
        nameEs: c.nameEs,
        hex: c.hex,
        borderHex: c.borderHex,
        lifestyleImage: renamed(c.modelImage),
        catalogShot: shots[c.id] ?? renamed(c.modelImage),
      }));
      const defaultColorway = tee.defaultColorway ?? colorways[0]?.id;
      const teeFields = {
        silhouette: "tee",
        category: "apparel",
        image: renamed(tee.image),
        images: tee.images?.map(renamed),
        catalogShot: defaultColorway ? shots[defaultColorway] : undefined,
        graphicImage: tee.graphicImage,
        printPosition: tee.printPosition,
        fabricEn: tee.fabricEn,
        fabricEs: tee.fabricEs,
        fitEn: tee.fitEn,
        fitEs: tee.fitEs,
        defaultColorway,
        colorways,
        sizes: [...TEE_SIZES],
      };

      let variant = await getVariant(ctx, tee.id);
      if (variant) {
        // Fill only what is missing: re-running must never undo an Administrator's edits.
        const patch: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(teeFields)) {
          if (value !== undefined && variant[key as keyof typeof variant] === undefined) patch[key] = value;
        }
        // Canonical Lifestyle Shot names: rewrite only paths that still point at the old files.
        if (LIFESTYLE_RENAMES[variant.image]) patch.image = renamed(variant.image);
        if (variant.images?.some((path) => LIFESTYLE_RENAMES[path])) patch.images = variant.images.map(renamed);
        if (variant.colorways?.some((c) => LIFESTYLE_RENAMES[c.lifestyleImage])) {
          patch.colorways = variant.colorways.map((c) => ({ ...c, lifestyleImage: renamed(c.lifestyleImage) }));
        }
        if (Object.keys(patch).length > 0) {
          await ctx.db.patch("variants", variant._id, patch);
          report.teesUpdated++;
        }
      } else {
        await ctx.db.insert("variants", {
          variantId: tee.id,
          nameEn: tee.nameEn,
          nameEs: tee.nameEs,
          primaryHex: tee.primaryHex,
          secondaryHex: tee.secondaryHex,
          stock: tee.stock,
          priceUsd: tee.priceUsd,
          isFeatured: tee.isFeatured ?? false,
          isAvailable: true,
          taxCode: "txcd_30011000",
          ...teeFields,
        });
        report.teesInserted++;
      }
      variant = (await getVariant(ctx, tee.id))!;

      const existing = await listSkus(ctx, variant.variantId);
      if (existing.length === 0 && defaultColorway) {
        const cells = distributeStock(variant.stock, colorways.map((c) => c.id), defaultColorway);
        for (const cell of cells) {
          await ctx.db.insert("skus", { variantId: variant.variantId, ...cell });
        }
        report.skusSeeded += cells.length;
      }
    }

    return report;
  },
});

/**
 * One-shot repricing of every Heavyweight Tee (e.g. the $160 → $80 change). Existing orders
 * keep the price they were sold at. Run with:
 *   npx convex run products:setApparelPriceUsd '{"priceUsd": 80}'
 */
export const setApparelPriceUsd = internalMutation({
  args: { priceUsd: v.number() },
  handler: async (ctx, args) => {
    if (!Number.isFinite(args.priceUsd) || args.priceUsd <= 0) {
      throw new ConvexError("priceUsd must be a positive number");
    }
    const variants = await ctx.db.query("variants").take(500);
    let updated = 0;
    for (const variant of variants) {
      const isTee = variant.category === "apparel" || variant.silhouette === "tee";
      if (isTee && variant.priceUsd !== args.priceUsd) {
        await ctx.db.patch("variants", variant._id, { priceUsd: args.priceUsd });
        updated++;
      }
    }
    return { updated };
  },
});
